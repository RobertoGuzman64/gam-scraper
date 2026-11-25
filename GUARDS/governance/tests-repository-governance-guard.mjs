import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { inflateRawSync, gunzipSync } from "node:zlib";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { formatScriptStatus } from "../../scripts/terminal.mjs";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const excludedDirectories = new Set([".git", "node_modules", "dist", "storage", "output", "out", "reports", "coverage"]);
const scriptExtension = /\.(?:[cm]?[jt]s|[jt]sx|ps1|py|sh|cmd|bat)$/iu;
const externalScriptExtension = /\.(?:mjs|cjs|ps1|py|sh|cmd|bat)$/iu;
const phaseFileName = /(?:^|[-_.])(?:fase|phase)[-_.]?(?:\d+|[ivxlcdm]+)(?=$|[-_.])|(?:^|[-_.])(?:f\d+|operativa[-_.]?f\d+)(?=$|[-_.])/iu;
const temporaryFileName = /(?:^|[-_.])(?:temp|temporary|tmp|scratch|backup)(?=$|[-_.])|(?:~|\.(?:bak|orig|rej|swp|swo|tmp))$/iu;

const walk = (root, directory = "") => {
  const files = [];
  for (const entry of readdirSync(join(root, directory), { withFileTypes: true })) {
    const pathname = [directory, entry.name].filter(Boolean).join("/");
    if (entry.isDirectory()) {
      if (!(directory === "" && excludedDirectories.has(entry.name))) files.push(...walk(root, pathname));
    } else if (entry.isFile()) {
      files.push(pathname);
    }
  }
  return files;
};

const archiveLimit = 32 * 1024 * 1024;
const dataLimit = 12 * 1024 * 1024;
const replicaExcludedDirectories = new Set([".git", "node_modules", "dist", "storage", "output", "out", "reports", "coverage"]);

const replicaPaths = (root, directory = "") => {
  const paths = [];
  for (const entry of readdirSync(join(root, directory), { withFileTypes: true })) {
    const pathname = [directory, entry.name].filter(Boolean).join("/");
    if (entry.isDirectory()) {
      if (!(directory === "" && replicaExcludedDirectories.has(entry.name))) paths.push(...replicaPaths(root, pathname));
    } else if (entry.isFile()) {
      paths.push(pathname);
    }
  }
  return paths;
};

const digest = (value) => createHash("sha256").update(value).digest("hex");
const object = (value) => value !== null && typeof value === "object" && !Array.isArray(value);
const provider = (value) => object(value) && typeof value.providerId === "string" && value.providerId.length > 0 ? value.providerId : null;
const completeRecord = (value) => provider(value) && typeof value.title === "string" &&
  (typeof value.url === "string" || typeof value.sourceUrl === "string") &&
  (typeof value.reference === "string" || typeof value.categoryKey === "string" ||
    typeof value.categorySellID === "number") && Object.keys(value).length >= 6;
const commercialRecord = (value) => object(value) && typeof value.reference === "string" &&
  typeof value.title === "string" && typeof value.companyID === "number" &&
  Object.hasOwn(value, "categorySellID") && Object.hasOwn(value, "attributes");
const canonical = (value) => JSON.stringify(value, (_key, entry) => object(entry) ?
  Object.fromEntries(Object.keys(entry).sort().map((key) => [key, entry[key]])) : entry);

const records = (value) => {
  const items = Array.isArray(value) ? value : object(value) && Array.isArray(value.products) ? value.products :
    object(value) && Array.isArray(value.records) ? value.records : [];
  return items.map((entry) => object(entry) && object(entry.original) ? entry.original : entry)
    .filter((entry) => completeRecord(entry) || commercialRecord(entry));
};

const replicaManifest = (value) => object(value) && (
  (provider(value) && (
    typeof value.catalogSha256 === "string" ||
    typeof value.sourceCsvSha256 === "string" ||
    typeof value.approvalSha256 === "string" ||
    (typeof value.sha256 === "string" && Object.keys(value).length <= 5) ||
    (object(value.source) && typeof value.source.catalogSha256 === "string" && object(value.totals)) ||
    (object(value.artifacts) && typeof value.artifacts.catalogSha256 === "string" && object(value.totals)) ||
    (object(value.files) && object(value.totals) && typeof value.runId === "string")
  )) ||
  (object(value.source) && provider(value.source) && typeof value.source.catalogSha256 === "string" &&
    (Array.isArray(value.products) || object(value.fingerprints) || object(value.totals))) ||
  (object(value.artifacts) && typeof value.artifacts.catalogSha256 === "string" &&
    object(value.totals) && typeof value.startedAt === "string" && typeof value.endedAt === "string") ||
  (typeof value.runId === "string" && typeof value.approved === "boolean" &&
    Array.isArray(value.sources) && value.sources.some((entry) => provider(entry) &&
      typeof entry.catalogSha256 === "string"))
);

const zipContents = (buffer) => {
  if (buffer.length > archiveLimit) throw new Error("contenedor demasiado grande");
  let end = -1;
  for (let index = buffer.length - 22; index >= Math.max(0, buffer.length - 65557); index--) {
    if (buffer.readUInt32LE(index) === 0x06054b50) { end = index; break; }
  }
  if (end < 0) throw new Error("directorio ZIP ausente");
  const count = buffer.readUInt16LE(end + 10);
  const offset = buffer.readUInt32LE(end + 16);
  if (count === 65535 || offset === 0xffffffff || count > 1024) throw new Error("contenedor ZIP no acotado");
  const entries = [];
  let cursor = offset;
  let inflated = 0;
  for (let index = 0; index < count; index++) {
    if (cursor + 46 > buffer.length || buffer.readUInt32LE(cursor) !== 0x02014b50) {
      throw new Error("directorio ZIP inválido");
    }
    const compression = buffer.readUInt16LE(cursor + 10);
    const compressed = buffer.readUInt32LE(cursor + 20);
    const uncompressed = buffer.readUInt32LE(cursor + 24);
    const nameLength = buffer.readUInt16LE(cursor + 28);
    const extraLength = buffer.readUInt16LE(cursor + 30);
    const commentLength = buffer.readUInt16LE(cursor + 32);
    const local = buffer.readUInt32LE(cursor + 42);
    const name = buffer.subarray(cursor + 46, cursor + 46 + nameLength).toString("utf8");
    cursor += 46 + nameLength + extraLength + commentLength;
    if (name.endsWith("/")) continue;
    if (uncompressed > dataLimit || inflated + uncompressed > archiveLimit ||
      compressed > archiveLimit || local + 30 > buffer.length || buffer.readUInt32LE(local) !== 0x04034b50 ||
      (compression !== 0 && compression !== 8)) throw new Error("entrada ZIP no inspeccionable");
    const start = local + 30 + buffer.readUInt16LE(local + 26) + buffer.readUInt16LE(local + 28);
    if (start + compressed > buffer.length) throw new Error("entrada ZIP truncada");
    const bytes = buffer.subarray(start, start + compressed);
    const content = compression === 0 ? bytes : inflateRawSync(bytes, { maxOutputLength: dataLimit });
    if (content.length !== uncompressed) throw new Error("tamaño ZIP inconsistente");
    inflated += content.length;
    entries.push({ name, content });
  }
  return entries;
};

const isZip = (bytes) => bytes.length >= 4 && bytes.readUInt32LE(0) === 0x04034b50;
const isGzip = (bytes) => bytes.length >= 2 && bytes[0] === 0x1f && bytes[1] === 0x8b;
const jsonPayload = (bytes) => {
  const raw = bytes.toString("utf8").trimStart();
  if (!raw.startsWith("{") && !raw.startsWith("[")) return null;
  try { return JSON.parse(raw); } catch { return null; }
};

export const inspectCatalogReplicas = (root) => {
  const paths = replicaPaths(root);
  const catalogHashes = new Set();
  const catalogRecords = new Set();
  for (const pathname of paths.filter((entry) => entry.startsWith("catalogs/"))) {
    const bytes = readFileSync(join(root, pathname));
    catalogHashes.add(digest(bytes));
    if (!/\.json$/iu.test(pathname)) continue;
    const source = jsonPayload(bytes);
    if (source === null) continue;
    for (const entry of records(source)) catalogRecords.add(digest(canonical(entry)));
  }
  const findings = [];
  const distributed = new Map();
  const inspectPayload = (pathname, bytes, depth = 0) => {
    if (depth > 2) { findings.push(`R-CONTENEDOR-ANIDADO: ${pathname}`); return; }
    if (isZip(bytes) || isGzip(bytes)) {
      try {
        const entries = isZip(bytes) ? zipContents(bytes) :
          [{ name: "contenido", content: gunzipSync(bytes, { maxOutputLength: archiveLimit }) }];
        for (const entry of entries) {
          const internal = `${pathname}!${entry.name}`;
          if (/(?:^|\/)catalogs\//iu.test(entry.name.replaceAll("\\", "/"))) {
            findings.push(`R-CATALOGO-EMPAQUETADO: ${internal}`);
          }
          inspectPayload(internal, entry.content, depth + 1);
        }
      } catch (error) {
        findings.push(`R-CONTENEDOR-NO-INSPECCIONABLE: ${pathname} (${error instanceof Error ? error.message : String(error)})`);
      }
      return;
    }
    if (bytes.length > dataLimit) {
      if (/\.(?:json|jsonl|ndjson|evidence|zip|gz)$/iu.test(pathname) || /^[\s\ufeff]*[\[{]/u.test(bytes.subarray(0, 256).toString("utf8"))) {
        findings.push(`R-DATOS-NO-INSPECCIONABLES: ${pathname}`);
      }
      return;
    }
    if (/\.[cm]?[jt]sx?$/iu.test(pathname) && bytes.length <= dataLimit) {
      const code = bytes.toString("utf8");
      const count = (field) => (code.match(new RegExp(`(?:["']?${field}["']?)\\s*:`, "gu")) ?? []).length;
      if (Math.min(count("providerId"), count("title"), count("reference"),
        count("url") + count("sourceUrl")) >= 10) {
        findings.push(`R-REGISTROS-EMBEBIDOS: ${pathname}`);
      }
    }
    const value = jsonPayload(bytes);
    if (value === null) return;
    const entries = records(value);
    if (replicaManifest(value)) findings.push(`R-ARTEFACTO-CATALOGO: ${pathname}`);
    if (object(value) && Array.isArray(value.products) && entries.length >= 4 &&
      (provider(value) || entries.length >= 10)) findings.push(`R-REPLICA-CATALOGO: ${pathname}`);
    if (entries.length >= 10) findings.push(`R-DATASET-DE-MAQUINAS: ${pathname} (${entries.length} registros)`);
    if (entries.length >= 10 && entries.every(commercialRecord)) {
      findings.push(`R-EXPORTACION-COMERCIAL: ${pathname}`);
    }
    for (const entry of entries) {
      const identity = provider(entry) ?? (commercialRecord(entry) ? "comercial" : null);
      const fingerprint = digest(canonical(entry));
      if (catalogRecords.has(fingerprint)) findings.push(`R-REGISTRO-COPIADO: ${pathname}`);
      if (!identity) continue;
      const collection = distributed.get(identity) ?? new Map();
      const key = typeof entry.reference === "string" ? entry.reference :
        (typeof entry.url === "string" ? entry.url : entry.sourceUrl);
      collection.set(`${key}:${fingerprint}`, pathname);
      distributed.set(identity, collection);
    }
  };
  for (const pathname of paths.filter((entry) => !entry.startsWith("catalogs/"))) {
    const bytes = readFileSync(join(root, pathname));
    if (catalogHashes.has(digest(bytes)) && bytes.length > 0) {
      findings.push(`R-ARCHIVO-DUPLICADO: ${pathname}`);
    }
    inspectPayload(pathname, bytes);
  }
  for (const [identity, collection] of distributed) {
    const byFile = new Set(collection.values());
    if (collection.size >= 10 && byFile.size > 1) {
      findings.push(`R-CATALOGO-FRAGMENTADO: ${identity} (${collection.size} registros en ${byFile.size} archivos)`);
    }
  }
  return { findings: [...new Set(findings)].sort(), checkedPaths: paths.length };
};

const isScript = (pathname) => {
  if (/^(?:scripts|guards|GUARDS|interventions)\//u.test(pathname)) return scriptExtension.test(pathname);
  if (/^(?:tools|bin)\//u.test(pathname)) return scriptExtension.test(pathname);
  return externalScriptExtension.test(pathname) || (!pathname.includes("/") && scriptExtension.test(pathname));
};

export const repositoryInventory = (root) => {
  const paths = walk(root);
  const markdownPaths = paths.filter((pathname) => /\.md$/iu.test(pathname));
  const scriptPaths = paths.filter(isScript);
  const counts = { markdown: markdownPaths.length, scripts: scriptPaths.length };
  const packageJson = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
  return { paths, counts, markdownPaths, scriptPaths, npmScripts: packageJson.scripts ?? {}, npmBin: packageJson.bin ?? null };
};

const differences = (label, expected, actual, findings) => {
  for (const name of Object.keys(actual)) {
    if (!Object.hasOwn(expected, name)) findings.push(`${label} no autorizado: ${name}`);
    else if (actual[name] !== expected[name]) findings.push(`${label} modificado sin actualizar el contrato: ${name}`);
  }
  for (const name of Object.keys(expected)) {
    if (!Object.hasOwn(actual, name)) findings.push(`${label} eliminado o movido: ${name}`);
  }
};

const validPaths = (paths, extension) => Array.isArray(paths) &&
  paths.every((pathname) => typeof pathname === "string" && pathname.length > 0 &&
    !pathname.startsWith("/") && !pathname.includes("\\") &&
    pathname.split("/").every((part) => part.length > 0 && part !== "." && part !== "..") &&
    !excludedDirectories.has(pathname.split("/")[0]) && extension(pathname)) &&
  new Set(paths).size === paths.length;

export const inspectRepositoryGovernance = (root, policy) => {
  if (policy?.version !== 3 || !policy.maxCounts ||
    !Number.isSafeInteger(policy.maxCounts.markdown) || policy.maxCounts.markdown < 0 ||
    !Number.isSafeInteger(policy.maxCounts.scripts) || policy.maxCounts.scripts < 0 ||
    !policy.allowedPaths ||
    !validPaths(policy.allowedPaths.markdown, (pathname) => /\.md$/iu.test(pathname)) ||
    !validPaths(policy.allowedPaths.scripts, isScript) ||
    policy.allowedPaths.markdown.length !== policy.maxCounts.markdown ||
    policy.allowedPaths.scripts.length !== policy.maxCounts.scripts ||
    !policy.npmScripts || typeof policy.npmScripts !== "object" || Array.isArray(policy.npmScripts) ||
    !Object.hasOwn(policy, "npmBin")) {
    throw new Error("Contrato de gobernanza inválido");
  }
  const inventory = repositoryInventory(root);
  const findings = [...inspectCatalogReplicas(root).findings];
  if (inventory.counts.markdown > policy.maxCounts.markdown) {
    findings.push(`Exceso de Markdown: ${inventory.counts.markdown} (máximo ${policy.maxCounts.markdown})`);
  }
  if (inventory.counts.scripts > policy.maxCounts.scripts) {
    findings.push(`Exceso de scripts: ${inventory.counts.scripts} (máximo ${policy.maxCounts.scripts})`);
  }
  for (const [label, currentPaths, authorizedPaths] of [
    ["Markdown", inventory.markdownPaths, policy.allowedPaths.markdown],
    ["Script", inventory.scriptPaths, policy.allowedPaths.scripts]
  ]) {
    const authorized = new Set(authorizedPaths);
    for (const pathname of currentPaths) {
      if (!authorized.has(pathname)) findings.push(`${label} no autorizado: ${pathname}`);
    }
  }
  differences("Comando npm", policy.npmScripts, inventory.npmScripts, findings);
  if (JSON.stringify(inventory.npmBin) !== JSON.stringify(policy.npmBin)) {
    findings.push("Entradas ejecutables package.json/bin modificadas");
  }
  for (const pathname of inventory.paths) {
    if (pathname.startsWith("docs/") && !/\.md$/iu.test(pathname)) {
      findings.push(`Archivo no autorizado en docs/: ${pathname}`);
    }
    if (pathname.startsWith("scripts/") && !isScript(pathname)) {
      findings.push(`Archivo no autorizado en scripts/: ${pathname}`);
    }
    if (/^guards\//iu.test(pathname) && !pathname.startsWith("guards/")) {
      findings.push(`Ruta de guards con mayúsculas no autorizada: ${pathname}`);
    }
    if (pathname.startsWith("guards/") && pathname !== "guards/governance/repository-governance.json" &&
      !/\.md$/iu.test(pathname) && !isScript(pathname)) {
      findings.push(`Archivo no autorizado en guards/: ${pathname}`);
    }
    const fileName = pathname.split("/").at(-1);
    if (phaseFileName.test(fileName)) findings.push(`Nombre de fase prohibido: ${pathname}`);
    if (temporaryFileName.test(fileName) &&
      (/\.(?:md|txt)$/iu.test(pathname) || scriptExtension.test(pathname) || /^(?:docs|guards|GUARDS|scripts)\//u.test(pathname))) {
      findings.push(`Archivo temporal prohibido: ${pathname}`);
    }
  }
  if (existsSync(join(root, ".git"))) {
    try {
      const tracked = execFileSync("git", ["ls-files", "-z", "--", "reports"], { cwd: root, encoding: "utf8" });
      for (const pathname of tracked.split("\0").filter(Boolean)) {
        findings.push(`Artefacto reports/ versionado: ${pathname}`);
      }
    } catch {
      findings.push("No se ha podido comprobar el índice Git de reports/");
    }
  }
  return {
    findings,
    counts: {
      markdown: inventory.counts.markdown,
      scripts: inventory.counts.scripts,
      npmScripts: Object.keys(inventory.npmScripts).length
    }
  };
};

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const policy = JSON.parse(readFileSync(join(repositoryRoot, "guards/governance/repository-governance.json"), "utf8"));
    const result = inspectRepositoryGovernance(repositoryRoot, policy);
    for (const finding of result.findings) console.error(formatScriptStatus("FAIL", `GOBERNANZA | ${finding}`, process.stderr));
    const status = result.findings.length ? "FAIL" : "PASS";
    console.log(formatScriptStatus(status, `GOBERNANZA | ${result.counts.markdown} Markdown | ${result.counts.scripts} scripts | ${result.counts.npmScripts} comandos npm | ${result.findings.length} infracciones`));
    if (result.findings.length) process.exitCode = 1;
  } catch (error) {
    console.error(formatScriptStatus("FAIL", `GOBERNANZA | ${error instanceof Error ? error.message : String(error)}`, process.stderr));
    process.exitCode = 1;
  }
}
