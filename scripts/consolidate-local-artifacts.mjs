import { createHash, randomUUID } from "node:crypto";
import { constants } from "node:fs";
import { copyFile, lstat, mkdir, open, readFile, readdir, rename, rm, rmdir, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { basename, dirname, isAbsolute, join, relative, resolve, sep } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const providers = ["gam", "gomariz", "mercaeleva"];
const memberSuffixes = ["-preparation.manifest.json", "-preparation.json", "-diagnostics.json", "-comparison.json"];
const sha256 = (data) => createHash("sha256").update(data).digest("hex");
const isRecord = (value) => value !== null && typeof value === "object" && !Array.isArray(value);
const missing = (error) => error !== null && typeof error === "object" && error.code === "ENOENT";
const validSha = (value) => typeof value === "string" && /^[a-f0-9]{64}$/.test(value);

const regularFile = async (path) => {
  const info = await lstat(path);
  if (!info.isFile() || info.isSymbolicLink() || info.nlink !== 1) throw new Error(`Archivo no regular o compartido: ${path}`);
  return info;
};

const regularDirectory = async (path) => {
  const info = await lstat(path);
  if (!info.isDirectory() || info.isSymbolicLink()) throw new Error(`Directorio no regular: ${path}`);
};

const readJson = async (path) => {
  await regularFile(path);
  return JSON.parse(await readFile(path, "utf8"));
};

const list = async (path) => {
  try {
    await regularDirectory(path);
    return await readdir(path, { withFileTypes: true });
  } catch (error) {
    if (missing(error)) return [];
    throw error;
  }
};

const addUnit = (units, paths, reason) => {
  for (const path of paths) {
    if (units.has(path)) throw new Error(`Duplicado en el plan: ${path}`);
    units.set(path, reason);
  }
};

const preparedSets = async (root, provider) => {
  const folder = join(root, "storage", "prepared", provider);
  const names = (await list(folder)).map((entry) => {
    if (!entry.isFile() || entry.isSymbolicLink()) throw new Error(`Entrada desconocida en ${folder}: ${entry.name}`);
    return entry.name;
  });
  const grouped = new Map();
  for (const name of names) {
    const suffix = memberSuffixes.find((part) => name.endsWith(part));
    if (!suffix) throw new Error(`Artefacto de preparación sin clasificar: ${name}`);
    const id = name.slice(0, -suffix.length);
    if (!/^[a-zA-Z0-9_-]+$/.test(id)) throw new Error(`Prefijo de preparación inválido: ${name}`);
    grouped.set(id, [...(grouped.get(id) ?? []), name]);
  }
  const sets = [];
  for (const [id, members] of grouped) {
    for (const suffix of ["-preparation.json", "-preparation.manifest.json", "-diagnostics.json"]) {
      if (!members.includes(`${id}${suffix}`)) throw new Error(`Preparación incompleta: ${id}`);
    }
    const preparationPath = join(folder, `${id}-preparation.json`);
    const [raw, manifest, diagnostics] = await Promise.all([
      readFile(preparationPath),
      readJson(join(folder, `${id}-preparation.manifest.json`)),
      readJson(join(folder, `${id}-diagnostics.json`))
    ]);
    const preparation = JSON.parse(raw.toString("utf8"));
    if (!isRecord(preparation) || !isRecord(preparation.source) || !isRecord(manifest) ||
      manifest.version !== 1 || manifest.providerId !== provider ||
      manifest.preparationSha256 !== sha256(raw) || !validSha(manifest.catalogSha256) ||
      !isRecord(diagnostics) || diagnostics.providerId !== provider ||
      !isRecord(preparation.totals) || !Array.isArray(preparation.products) ||
      diagnostics.totals?.products !== preparation.products.length ||
      diagnostics.totals?.ready !== preparation.totals.ready ||
      diagnostics.totals?.review !== preparation.totals.review) {
      throw new Error(`Preparación no acreditada: ${id}`);
    }
    const stamp = Date.parse(preparation.preparedAt);
    if (!Number.isFinite(stamp) || preparation.source.providerId !== provider ||
      manifest.catalogSha256 !== preparation.source.catalogSha256) {
      throw new Error(`Identidad de preparación inválida: ${id}`);
    }
    for (const name of members) await regularFile(join(folder, name));
    const group = [provider, preparation.source.scope, preparation.source.prefix, preparation.source.catalogSha256].join(":");
    sets.push({ id, group, timestamp: stamp, sha: manifest.preparationSha256,
      paths: members.map((name) => join(folder, name)) });
  }
  return sets;
};

const publicationSets = async (root, provider, prepared) => {
  const folder = join(root, "catalogs", "providers", provider, "publications");
  const entries = await list(folder);
  const activePath = join(folder, "active.json");
  const active = await readJson(activePath);
  if (!isRecord(active) || active.version !== 1 || active.providerId !== provider || !validSha(active.approvalSha256)) {
    throw new Error(`Índice de publicación vigente inválido: ${provider}`);
  }
  const times = new Map(prepared.map((set) => [set.sha, set.timestamp]));
  const indexPath = join(root, "storage", "providers", provider, "publication-retention.json");
  let historic = { publications: [] };
  try { historic = await readJson(indexPath); }
  catch (error) { if (!missing(error)) throw error; }
  if (!Array.isArray(historic.publications) ||
    (historic.version !== undefined && (historic.version !== 1 || historic.providerId !== provider))) {
    throw new Error(`Índice de retención inválido: ${provider}`);
  }
  const result = [];
  for (const entry of entries) {
    if (entry.name === "active.json") continue;
    if (!entry.isDirectory() || entry.isSymbolicLink() || !/^[a-f0-9]{16,64}$/.test(entry.name)) {
      throw new Error(`Publicación sin clasificar: ${entry.name}`);
    }
    const directory = join(folder, entry.name);
    const files = (await list(directory)).map((child) => {
      if (!child.isFile() || child.isSymbolicLink()) throw new Error(`Miembro irregular: ${child.name}`);
      return child.name;
    }).sort();
    const expected = ["accreditation.json", `${provider}-publishable.json`, "manifest.json"].sort();
    if (JSON.stringify(files) !== JSON.stringify(expected)) throw new Error(`Publicación incompleta: ${directory}`);
    const manifest = await readJson(join(directory, "manifest.json"));
    const approvalBytes = await readFile(join(directory, "accreditation.json"));
    const productBytes = await readFile(join(directory, `${provider}-publishable.json`));
    const approval = sha256(approvalBytes);
    if (!isRecord(manifest) || manifest.version !== 1 || manifest.providerId !== provider ||
      manifest.approvalSha256 !== approval || !approval.startsWith(entry.name) ||
      manifest.files?.[`${provider}-publishable.json`] !== sha256(productBytes) ||
      manifest.files?.["accreditation.json"] !== approval) {
      throw new Error(`Integridad de publicación no acreditada: ${directory}`);
    }
    const stored = historic.publications.find((item) => item.approvalSha256 === approval &&
      item.preparationSha256 === manifest.preparationSha256);
    const stamp = times.get(manifest.preparationSha256) ?? (stored ? Date.parse(stored.preparedAt) : NaN);
    if (!Number.isFinite(stamp)) throw new Error(`Publicación sin fecha verificable: ${directory}`);
    result.push({ directory, approval, runId: manifest.runId, timestamp: stamp, prepSha: manifest.preparationSha256 });
  }
  if (!result.some((item) => item.approval === active.approvalSha256)) throw new Error(`Publicación activa ausente: ${provider}`);
  return { result, active: active.approvalSha256 };
};

const planForProvider = async (root, provider, units) => {
  const preparations = await preparedSets(root, provider);
  const groups = new Map();
  for (const prepared of preparations) groups.set(prepared.group, [...(groups.get(prepared.group) ?? []), prepared]);
  const keptPreps = new Set();
  for (const sets of groups.values()) {
    sets.sort((a, b) => b.timestamp - a.timestamp || b.id.localeCompare(a.id));
    if (new Set(sets.map((item) => item.timestamp)).size !== sets.length) throw new Error(`Fechas ambiguas: ${provider}`);
    for (const set of sets.slice(0, 2)) keptPreps.add(set.sha);
    for (const set of sets.slice(2)) addUnit(units, set.paths, `preparación anterior: ${provider}`);
  }
  if (preparations.length === 0) {
    const publicationsRoot = join(root, "catalogs", "providers", provider, "publications");
    if ((await list(publicationsRoot)).length === 0) return { prepared: 0, publications: 0, keptPrepared: 0, keptPublications: 0 };
  }
  const { result: publications, active } = await publicationSets(root, provider, preparations);
  publications.sort((a, b) => b.timestamp - a.timestamp || b.approval.localeCompare(a.approval));
  const keep = publications.slice(0, 2);
  if (!keep.some((item) => item.approval === active)) {
    throw new Error(`La publicación vigente no está entre las dos más recientes: ${provider}`);
  }
  for (const publication of publications.slice(2)) {
    addUnit(units, [publication.directory], `publicación anterior: ${provider}`);
  }
  const keepApprovals = new Set(keep.map((item) => item.approval));
  const preparedTimes = new Map(preparations.map((item) => [item.sha, item.timestamp]));
  const editorialFolder = join(root, "storage", "providers", provider, "editorial");
  const editorial = [];
  for (const entry of await list(editorialFolder)) {
    if (!entry.isFile() || entry.isSymbolicLink() || !entry.name.endsWith(".json")) {
      throw new Error(`Evidencia sin clasificar: ${join(editorialFolder, entry.name)}`);
    }
    const path = join(editorialFolder, entry.name);
    const data = await readJson(path);
    const preparedHash = Array.isArray(data?.sources) ? data.sources[0]?.preparationSha256 : undefined;
    if (typeof data?.runId !== "string" || !validSha(preparedHash)) {
      throw new Error(`Acreditación editorial irregular: ${path}`);
    }
    editorial.push({ path, runId: data.runId, timestamp: preparedTimes.get(preparedHash) ?? -1 });
  }
  editorial.sort((a, b) => b.timestamp - a.timestamp || b.runId.localeCompare(a.runId));
  for (const item of editorial.slice(2)) {
    addUnit(units, [item.path], `acreditación editorial histórica: ${provider}`);
  }
  const receiptFolder = join(root, "storage", "providers", provider, "deliveries");
  for (const entry of await list(receiptFolder)) {
    if (!entry.isFile() || entry.isSymbolicLink() || !entry.name.endsWith(".json")) {
      throw new Error(`Recibo sin clasificar: ${join(receiptFolder, entry.name)}`);
    }
    const path = join(receiptFolder, entry.name);
    const data = await readJson(path);
    if (typeof data?.approvalSha256 !== "string") throw new Error(`Recibo sin aprobación: ${path}`);
    if (!keepApprovals.has(data.approvalSha256)) addUnit(units, [path], `recibo histórico: ${provider}`);
  }
  return { prepared: preparations.length, publications: publications.length,
    keptPrepared: keptPreps.size, keptPublications: keep.length };
};

const additionalArtifacts = async (root, units) => {
  const runs = join(root, "storage", "runs");
  for (const entry of await list(runs)) {
    if (!entry.isDirectory() || entry.isSymbolicLink()) throw new Error(`Ejecución no clasificable: ${entry.name}`);
    const directory = join(runs, entry.name);
    const run = await readJson(join(directory, "run.json"));
    if (isRecord(run) && run.status === "failed" && run.runId === entry.name) {
      addUnit(units, [directory], "ejecución fallida histórica");
    }
  }
  for (const [provider, prefixes] of [["manain", ["prueba-manain-cdp", "prueba-manain"]],
    ["mercaeleva", ["scrape-mercaeleva"]]]) {
    const directory = join(root, "storage", "scraped", provider);
    for (const prefix of prefixes) {
      const summary = join(directory, `${prefix}-summary.json`);
      let data;
      try { data = await readJson(summary); }
      catch (error) { if (missing(error)) continue; throw error; }
      if (!isRecord(data) || data.quality?.status !== "blocked" || data.quality?.published !== false ||
        data.totals?.scrapedProducts !== 0) throw new Error(`Extracción de prueba no descartable: ${prefix}`);
      const files = (await list(directory)).filter((entry) => entry.isFile() &&
        entry.name.startsWith(`${prefix}-`) && /\.(json|csv)$/.test(entry.name));
      for (const entry of files) await regularFile(join(directory, entry.name));
      addUnit(units, files.map((entry) => join(directory, entry.name)).filter((path) => !units.has(path)), `extracción vacía: ${provider}`);
    }
  }
};

export const planConsolidation = async (root) => {
  const units = new Map();
  for (const provider of providers) await planForProvider(root, provider, units);
  await additionalArtifacts(root, units);
  const items = [...units].map(([path, reason]) => ({ path: relative(root, path).replaceAll(sep, "/"), reason }));
  if (items.some((item) => item.path.startsWith("../") || isAbsolute(item.path))) {
    throw new Error("Ruta fuera del repositorio");
  }
  return items.sort((a, b) => a.path.localeCompare(b.path));
};

const filesIn = async (path) => {
  const info = await lstat(path);
  if (info.isSymbolicLink()) throw new Error(`Enlace no permitido: ${path}`);
  if (info.isFile()) {
    if (info.nlink !== 1) throw new Error(`Archivo compartido: ${path}`);
    return [path];
  }
  if (!info.isDirectory()) throw new Error(`Artefacto no regular: ${path}`);
  const result = [];
  for (const entry of await readdir(path)) result.push(...await filesIn(join(path, entry)));
  return result;
};

const snapshot = async (root, items) => {
  const records = [];
  for (const item of items) {
    const full = join(root, item.path);
    const files = await filesIn(full);
    const contents = [];
    for (const file of files) {
      const info = await regularFile(file);
      contents.push({ path: relative(root, file).replaceAll(sep, "/"), size: info.size, sha256: sha256(await readFile(file)) });
    }
    records.push({ ...item, type: (await lstat(full)).isDirectory() ? "directory" : "file", files: contents });
  }
  return records;
};

const copyTree = async (source, destination) => {
  const info = await lstat(source);
  if (info.isFile()) {
    await regularFile(source);
    await mkdir(dirname(destination), { recursive: true });
    await copyFile(source, destination, constants.COPYFILE_EXCL);
    return;
  }
  await regularDirectory(source);
  await mkdir(dirname(destination), { recursive: true });
  await mkdir(destination);
  for (const name of await readdir(source)) await copyTree(join(source, name), join(destination, name));
};

const restoreTree = async (source, destination) => {
  const info = await lstat(source);
  let existing;
  try { existing = await lstat(destination); }
  catch (error) { if (!missing(error)) throw error; }
  if (info.isFile()) {
    if (existing) {
      if (!existing.isFile() || existing.isSymbolicLink() ||
        sha256(await readFile(source)) !== sha256(await readFile(destination))) {
        throw new Error(`Recuperación con conflicto: ${destination}`);
      }
      return;
    }
    await mkdir(dirname(destination), { recursive: true });
    await copyFile(source, destination, constants.COPYFILE_EXCL);
    return;
  }
  await regularDirectory(source);
  if (existing && (!existing.isDirectory() || existing.isSymbolicLink())) {
    throw new Error(`Recuperación con directorio alterado: ${destination}`);
  }
  if (!existing) await mkdir(destination, { recursive: true });
  for (const name of await readdir(source)) await restoreTree(join(source, name), join(destination, name));
};

const compareSnapshot = async (root, records) => {
  for (const record of records) {
    for (const file of record.files) {
      const path = join(root, file.path);
      const info = await regularFile(path);
      if (info.size !== file.size || sha256(await readFile(path)) !== file.sha256) {
        throw new Error(`Huella diferente: ${file.path}`);
      }
    }
  }
};

const runStatus = (root) => {
  const result = spawnSync(process.execPath, [join(root, "scripts", "tooling.mjs"), "estado"],
    { cwd: root, encoding: "utf8", timeout: 120_000 });
  if (result.error || result.status !== 0) {
    throw new Error(`Estado operativo no comprobable: ${result.stderr || result.error?.message || result.status}`);
  }
  return result.stdout.trim();
};

const retentionIndexes = async (root) => {
  const indexes = [];
  for (const provider of providers) {
    const prepared = await preparedSets(root, provider);
    if (prepared.length === 0) continue;
    const { result: publications, active } = await publicationSets(root, provider, prepared);
    publications.sort((a, b) => b.timestamp - a.timestamp || b.approval.localeCompare(a.approval));
    if (!publications.slice(0, 2).some((item) => item.approval === active)) {
      throw new Error(`La publicación vigente no está entre las dos últimas: ${provider}`);
    }
    const path = join(root, "storage", "providers", provider, "publication-retention.json");
    let previous = null;
    try { previous = await readFile(path); } catch (error) { if (!missing(error)) throw error; }
    const current = JSON.stringify({ version: 1, providerId: provider,
      publications: publications.slice(0, 2).map((item) => ({
        approvalSha256: item.approval, preparationSha256: item.prepSha,
        preparedAt: new Date(item.timestamp).toISOString()
      }))
    }, null, 2);
    indexes.push({ path, previous, current });
  }
  return indexes;
};

const writeIndexes = async (indexes) => {
  for (const entry of indexes) {
    await mkdir(dirname(entry.path), { recursive: true });
    const stage = `${entry.path}.${randomUUID()}.tmp`;
    try {
      await writeFile(stage, entry.current, { flag: "wx" });
      await rename(stage, entry.path);
    } finally { await rm(stage, { force: true }); }
  }
};

const restoreIndexes = async (indexes) => {
  for (const entry of indexes) {
    if (entry.previous === null) await rm(entry.path, { force: true });
    else await writeFile(entry.path, entry.previous);
  }
};

const cleanEmptyParents = async (root, items) => {
  const candidates = new Set(items.map((item) => dirname(join(root, item.path))));
  for (const folder of [...candidates].sort((a, b) => b.length - a.length)) {
    if (folder === root) continue;
    try { await rmdir(folder); } catch (error) {
      if (!missing(error) && error.code !== "ENOTEMPTY" && error.code !== "EEXIST") throw error;
    }
  }
};

export const consolidateLocalArtifacts = async (root, destination) => {
  root = resolve(root);
  destination = resolve(destination);
  if (destination === root || destination.startsWith(`${root}${sep}`) || root.startsWith(`${destination}${sep}`)) {
    throw new Error("El archivo externo debe estar fuera del repositorio y no contenerlo");
  }
  await regularDirectory(root);
  await regularDirectory(dirname(destination));
  try { await lstat(destination); throw new Error(`El destino ya existe: ${destination}`); }
  catch (error) { if (!missing(error)) throw error; }
  const lockPath = join(root, ".equipzilla-consolidation.lock");
  const lock = await open(lockPath, "wx");
  let records = [];
  let removed = [];
  let indexes = [];
  let indexed = false;
  let destinationCreated = false;
  try {
    const items = await planConsolidation(root);
    if (items.length === 0) return { versions: 0, files: 0, bytes: 0, destination: null };
    records = await snapshot(root, items);
    indexes = await retentionIndexes(root);
    const initialState = runStatus(root);
    await mkdir(destination);
    destinationCreated = true;
    for (const item of items) await copyTree(join(root, item.path), join(destination, item.path));
    await compareSnapshot(destination, records);
    await writeFile(join(destination, "manifest.json"), JSON.stringify({
      version: 1, originalRoot: root, createdAt: new Date().toISOString(), records
    }, null, 2), { flag: "wx" });
    await compareSnapshot(root, records);
    indexed = true;
    await writeIndexes(indexes);
    for (const record of records) {
      removed.push(record);
      await rm(join(root, record.path), { recursive: record.type === "directory" });
    }
    const finalState = runStatus(root);
    if (finalState !== initialState) throw new Error("El estado operativo cambió tras retirar los históricos");
    await cleanEmptyParents(root, items);
    const bytes = records.flatMap((record) => record.files).reduce((sum, file) => sum + file.size, 0);
    return { versions: records.length, files: records.flatMap((record) => record.files).length, bytes, destination };
  } catch (error) {
    const errors = [];
    for (const item of removed.slice().reverse()) {
      try {
        await restoreTree(join(destination, item.path), join(root, item.path));
      } catch (restoreError) { errors.push(`${item.path}: ${restoreError.message}`); }
    }
    if (indexed) {
      try { await restoreIndexes(indexes); }
      catch (restoreError) { errors.push(`Índices: ${restoreError.message}`); }
    }
    if (errors.length) throw new Error(`Consolidación fallida, recuperación incompleta: ${errors.join("; ")}`, { cause: error });
    if (destinationCreated) {
      try { await compareSnapshot(destination, records); } catch { }
    }
    throw error;
  } finally {
    await lock.close();
    await rm(lockPath, { force: true });
  }
};

export const restoreLocalArtifacts = async (root, archive) => {
  root = resolve(root);
  archive = resolve(archive);
  const manifest = await readJson(join(archive, "manifest.json"));
  if (manifest.version !== 1 || manifest.originalRoot !== root || !Array.isArray(manifest.records)) {
    throw new Error("Archivo externo no corresponde a este repositorio");
  }
  for (const item of manifest.records) {
    if (!item || typeof item.path !== "string" ||
      resolve(root, item.path) === root || !resolve(root, item.path).startsWith(`${root}${sep}`)) {
      throw new Error("Ruta inválida en el manifiesto de recuperación");
    }
    for (const file of item.files ?? []) {
      if (typeof file.path !== "string" || !resolve(root, file.path).startsWith(`${root}${sep}`)) {
        throw new Error("Miembro inválido en el manifiesto de recuperación");
      }
    }
  }
  await compareSnapshot(archive, manifest.records);
  for (const item of manifest.records) await restoreTree(join(archive, item.path), join(root, item.path));
  await compareSnapshot(root, manifest.records);
  return manifest.records.length;
};

const entryPoint = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (entryPoint) {
  const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
  const args = process.argv.slice(2);
  try {
    if (args[0] === "--restaurar" && args.length === 2) {
      const total = await restoreLocalArtifacts(root, args[1]);
      process.stdout.write(`RESTAURACIÓN | ${total} conjuntos recuperados\n`);
    } else if (args.length === 1 && args[0] === "--aplicar") {
      const timestamp = new Date().toISOString().replace(/[-:.]/g, "").slice(0, 15);
      const destination = join(homedir(), "Desktop", `equipzilla-historicos-${timestamp}-${randomUUID().slice(0, 8)}`);
      const result = await consolidateLocalArtifacts(root, destination);
      process.stdout.write(`CONSOLIDACIÓN | ${result.versions} conjuntos | ${result.files} archivos | ${(result.bytes / 1048576).toFixed(2)} MiB archivados\n`);
      if (result.destination) {
        process.stdout.write(`ARCHIVO EXTERNO | ${result.destination}\n`);
        process.stdout.write(`RECUPERAR | node scripts/consolidate-local-artifacts.mjs --restaurar "${result.destination}"\n`);
      }
    } else {
      throw new Error("Uso: node scripts/consolidate-local-artifacts.mjs --aplicar | --restaurar ruta-de-archivo");
    }
  } catch (error) {
    console.error(`CONSOLIDACIÓN BLOQUEADA | ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
  }
}
