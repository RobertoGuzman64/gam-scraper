import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { lstat, readFile, readdir } from "node:fs/promises";
import { basename, join, relative, resolve, sep } from "node:path";

const families = [
  ["originales", /^catalogs\/providers\/[^/]+\/original\//, "mantener", "Original canónico protegido; nombre y manifest vinculados"],
  ["publicaciones", /^catalogs\/providers\/[^/]+\/publications\//, "mantener", "Acreditaciones, índices y publicaciones protegidos"],
  ["manain", /^catalogs\/providers\/[^/]+\/records\//, "mantener", "Registro de origen protegido"],
  ["campanas-portables", /^catalogs\/campaigns\//, "mantener", "Publicación de campaña y manifiestos acreditados"],
  ["selecciones", /^catalogs\/active\.json$/, "mantener", "Índice global activo protegido"],
  ["extracciones", /^storage\/scraped\//, "bloqueado", "Requiere clasificación con catalog-retention y referencias históricas"],
  ["preparaciones", /^storage\/prepared\//, "bloqueado", "Requiere verificar manifest, origen y referencias de campañas"],
  ["ejecuciones", /^storage\/runs\//, "bloqueado", "Requiere verificar runId, cierre y política run-retention"],
  ["campanas", /^storage\/campaigns\//, "mantener", "Conservar hasta acreditar referencias de campaña"],
  ["intervenciones", /^storage\/interventions\//, "mantener", "Evidencia y procedencia técnica/editorial protegidas"],
  ["editorial-entregas", /^storage\/providers\//, "mantener", "Recibos y decisiones acreditadas protegidos"],
  ["diagnosticos", /^storage\/diagnostics\//, "bloqueado", "Ciclo de vida pendiente de clasificar"],
  ["normalizados-semillas", /^storage\/(?:normalized|seeds)\//, "bloqueado", "Derivados con procedencia y lectores por confirmar"],
  ["otras-rutas", /^(?:catalogs|storage)\//, "bloqueado", "Familia desconocida: no es migrable sin contrato"],
];

const ignore = new Set(["node_modules", "dist", ".git"]);

const parseArgs = (args) => {
  let root = process.cwd();
  const external = [];
  let json = false;
  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (arg === "--root" && args[i + 1]) root = args[++i];
    else if (arg === "--external" && args[i + 1]) external.push(args[++i]);
    else if (arg === "--json") json = true;
    else throw new Error(`Argumento no reconocido: ${arg}`);
  }
  return { root: resolve(root), external: external.map((value) => resolve(value)), json };
};

const sha256 = async (path) => {
  const hash = createHash("sha256");
  for await (const chunk of createReadStream(path)) hash.update(chunk);
  return hash.digest("hex");
};

const collect = async (base, path, files, blocked, missing) => {
  let info;
  try { info = await lstat(path); }
  catch (error) {
    if (error instanceof Error && error.code === "ENOENT") {
      missing.push(path);
      return;
    }
    throw error;
  }
  if (info.isSymbolicLink()) {
    blocked.push({ path, reason: "Enlace simbólico: excluido sin seguir el destino" });
    return;
  }
  if (info.isFile()) {
    files.push({ path, relative: relative(base, path).split(sep).join("/"), size: info.size, sha256: await sha256(path) });
    return;
  }
  if (!info.isDirectory()) {
    blocked.push({ path, reason: "Entrada no regular" });
    return;
  }
  for (const entry of (await readdir(path, { withFileTypes: true })).sort((a, b) => a.name.localeCompare(b.name))) {
    if (ignore.has(entry.name)) continue;
    await collect(base, join(path, entry.name), files, blocked, missing);
  }
};

const classOf = (entry, isExternal) => {
  if (isExternal) return {
    family: basename(entry.path).toLowerCase().endsWith(".zip") ? "zip-externos" : "externos",
    state: "bloqueado", reason: "Ruta externa: propiedad, recibos y dependencias sin acreditar"
  };
  const match = families.find(([, pattern]) => pattern.test(entry.relative));
  return match ? { family: match[0], state: match[2], reason: match[3] } : {
    family: "otros", state: "bloqueado", reason: "Ruta no clasificada"
  };
};

const summarize = (files, external) => {
  const groups = new Map();
  const rows = files.map((file) => ({ ...file, ...classOf(file, external) }));
  for (const file of rows) {
    const previous = groups.get(file.family) ?? { family: file.family, files: 0, bytes: 0, mantener: 0, migrable: 0, bloqueado: 0, reason: file.reason };
    previous.files += 1;
    previous.bytes += file.size;
    previous[file.state] += 1;
    groups.set(file.family, previous);
  }
  return { groups: [...groups.values()].sort((a, b) => a.family.localeCompare(b.family)), files: rows };
};

const verifyOriginals = async (files) => {
  const originals = files.filter((file) => file.family === "originales" && file.relative.endsWith("-catalog.json"));
  const issues = [];
  const verified = [];
  const byPath = new Map(files.map((file) => [file.path, file]));
  for (const original of originals) {
    const prefix = original.path.slice(0, -"-catalog.json".length);
    const manifest = byPath.get(`${prefix}-catalog.manifest.json`);
    const summary = byPath.get(`${prefix}-summary.json`);
    if (!manifest || !summary) {
      issues.push({ path: original.relative, reason: "Original incompleto: faltan manifest o summary" });
      continue;
    }
    try {
      const rawManifest = JSON.parse(await readFile(manifest.path, "utf8"));
      const rawCatalog = JSON.parse(await readFile(original.path, "utf8"));
      const rawSummary = JSON.parse(await readFile(summary.path, "utf8"));
      const name = basename(prefix);
      if (rawManifest.catalogSha256 !== original.sha256 || rawCatalog.prefix !== name ||
        rawManifest.prefix !== name || rawCatalog.providerId !== rawManifest.providerId ||
        rawCatalog.productCount !== rawManifest.productCount ||
        rawSummary?.artifacts?.catalogSha256 !== original.sha256) {
        issues.push({ path: original.relative, reason: "Original y manifest/summary no concuerdan" });
      } else verified.push(original.relative);
    } catch (error) {
      issues.push({ path: original.relative, reason: `JSON o manifest inválido: ${error instanceof Error ? error.message : String(error)}` });
    }
  }
  return { verified, issues };
};

const verifyActive = async (root) => {
  const issues = [];
  const rootDirectory = join(root, "catalogs", "providers");
  let providers;
  try { providers = await readdir(rootDirectory, { withFileTypes: true }); }
  catch (error) { if (error instanceof Error && error.code === "ENOENT") return issues; throw error; }
  for (const provider of providers.filter((entry) => entry.isDirectory())) {
    const file = join(rootDirectory, provider.name, "publications", "active.json");
    let raw;
    try { raw = await readFile(file, "utf8"); }
    catch (error) { if (error instanceof Error && error.code === "ENOENT") continue; throw error; }
    try {
      const active = JSON.parse(raw);
      if (active.providerId !== provider.name || !/^[a-f0-9]{64}$/.test(active.approvalSha256)) {
        throw new Error("Índice activo inválido");
      }
      const directory = join(rootDirectory, provider.name, "publications");
      const entries = await readdir(directory, { withFileTypes: true });
      const matches = entries.filter((entry) => /^[a-f0-9]{12,64}$/.test(entry.name) && active.approvalSha256.startsWith(entry.name));
      if (matches.length !== 1) throw new Error("Publicación activa ausente o alias ambiguo");
      const accreditation = join(directory, matches[0].name, "accreditation.json");
      if (await sha256(accreditation) !== active.approvalSha256) throw new Error("SHA de publicación activa discrepante");
    } catch (error) {
      issues.push({ path: relative(root, file).split(sep).join("/"), reason: error instanceof Error ? error.message : String(error) });
    }
  }
  return issues;
};

const main = async () => {
  const args = parseArgs(process.argv.slice(2));
  const internal = [];
  const blocked = [];
  const missing = [];
  for (const target of [join(args.root, "catalogs"), join(args.root, "storage")]) {
    await collect(args.root, target, internal, blocked, missing);
  }
  const external = [];
  for (const target of args.external) await collect(target, target, external, blocked, missing);
  const internalReport = summarize(internal, false);
  const externalReport = summarize(external, true);
  const originalValidation = await verifyOriginals(internalReport.files);
  const activeIssues = await verifyActive(args.root);
  const result = {
    mode: "SIMULACION_SOLO_LECTURA", root: args.root,
    counts: { internal: internal.length, external: external.length, files: internal.length + external.length,
      bytes: [...internal, ...external].reduce((sum, file) => sum + file.size, 0), eliminations: 0, migrations: 0 },
    families: [...internalReport.groups, ...externalReport.groups],
    originals: originalValidation,
    issues: [...blocked, ...activeIssues, ...originalValidation.issues],
    missingRoots: missing,
    ...(args.json ? { entries: [...internalReport.files, ...externalReport.files] } : {})
  };
  if (args.json) process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  else {
    process.stdout.write(`INVENTARIO EQUIPZILLA | SIMULACIÓN, CERO CAMBIOS\n`);
    process.stdout.write(`Archivos: ${result.counts.files} | Bytes: ${result.counts.bytes} | Migraciones: 0 | Borrados: 0\n`);
    for (const group of result.families) process.stdout.write(`${group.family}: ${group.files} archivos, ${group.mantener} mantener, ${group.bloqueado} bloqueados, ${group.migrable} migrables\n`);
    process.stdout.write(`Originales verificados por manifest/summary: ${result.originals.verified.length} | Incidencias: ${result.issues.length} | Raíces ausentes: ${missing.length}\n`);
    for (const issue of result.issues) process.stdout.write(`BLOQUEO | ${issue.path} | ${issue.reason}\n`);
    for (const path of missing) process.stdout.write(`NO INCLUIDO | ${path}\n`);
  }
  if (result.issues.length) process.exitCode = 1;
};

await main().catch((error) => {
  process.stderr.write(`Inventario fallido: ${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
