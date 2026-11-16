import { createHash } from "node:crypto";
import { lstat, readFile, readdir } from "node:fs/promises";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const archivePattern = /^archive-\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-\d{3}Z-[\da-f-]{36}$/;
const sha256 = (value) => createHash("sha256").update(value).digest("hex");
const record = (value) => value !== null && typeof value === "object" && !Array.isArray(value);
const missing = (error) => error instanceof Error && error.code === "ENOENT";

const readRegular = async (path) => {
  const info = await lstat(path);
  if (!info.isFile() || info.isSymbolicLink()) throw new Error(`Archivo no regular: ${path}`);
  return readFile(path, "utf8");
};

const optionalReadRegular = async (path) => {
  try { return await readRegular(path); }
  catch (error) { if (missing(error)) return null; throw error; }
};

const readJson = async (path) => JSON.parse(await readRegular(path));

const requireSource = (manifest, providerId) => {
  const source = manifest?.source;
  if (!record(manifest) || manifest.version !== 1 || manifest.providerId !== providerId ||
    !record(source) || source.providerId !== providerId ||
    (source.prefix !== undefined && (typeof source.prefix !== "string" || !/^[a-zA-Z0-9_-]+$/.test(source.prefix))) ||
    (source.scope !== undefined && (typeof source.scope !== "string" || !/^[a-f0-9]{16}$/.test(source.scope))) ||
    typeof source.catalogSha256 !== "string" || !/^[a-f0-9]{64}$/.test(source.catalogSha256) ||
    !Number.isSafeInteger(source.productCount) || source.productCount < 1) {
    throw new Error(`Publicación activa de ${providerId} sin procedencia válida`);
  }
  return source;
};

const validateTriplet = async (path, expected, portableAlias = false) => {
  const raw = await optionalReadRegular(path);
  if (raw === null) return { state: "AUSENTE", path };
  const digest = sha256(raw);
  try {
    const prefix = basename(path).slice(0, -"-catalog.json".length);
    const folder = dirname(path);
    const catalog = JSON.parse(raw);
    const manifest = await readJson(join(folder, `${prefix}-catalog.manifest.json`));
    const summary = await readJson(join(folder, `${prefix}-summary.json`));
    if (!record(catalog) || catalog.version !== 1 || !record(catalog.quality) ||
      catalog.quality.status !== "complete" || catalog.quality.published !== true ||
      !Array.isArray(catalog.products) || catalog.products.length !== catalog.productCount ||
      !record(manifest) || manifest.version !== 1 || !record(summary) ||
      !record(summary.quality) || summary.quality.status !== "complete" || summary.quality.published !== true ||
      !record(summary.totals) || !record(summary.artifacts) ||
      (catalog.prefix !== prefix && !(portableAlias && prefix === `scrape-${expected.providerId}`)) ||
      manifest.prefix !== catalog.prefix ||
      catalog.providerId !== expected.providerId || manifest.providerId !== catalog.providerId ||
      manifest.scope !== catalog.scope || manifest.productCount !== catalog.productCount ||
      manifest.startedAt !== catalog.startedAt || manifest.endedAt !== catalog.endedAt ||
      manifest.catalogSha256 !== digest || summary.artifacts.catalogSha256 !== digest ||
      summary.totals.scrapedProducts !== catalog.productCount ||
      summary.startedAt !== catalog.startedAt || summary.endedAt !== catalog.endedAt) {
      throw new Error("Catálogo, manifest y summary no acreditan los mismos bytes y corte");
    }
    const matches = digest === expected.catalogSha256 && catalog.productCount === expected.productCount &&
      (expected.scope === undefined || catalog.scope === expected.scope) &&
      (expected.prefix === undefined || catalog.prefix === expected.prefix);
    return { state: matches ? "COINCIDE" : "OTRO_CORTE", path, sha256: digest,
      productCount: catalog.productCount, scope: catalog.scope };
  } catch (error) {
    return { state: "INVALIDO", path, sha256: digest,
      reason: error instanceof Error ? error.message : String(error) };
  }
};

const inspectArchive = async (root, providerId, prefix, expected) => {
  const directory = join(root, "storage", "scraped", providerId, ".history", prefix);
  let entries;
  try { entries = await readdir(directory, { withFileTypes: true }); }
  catch (error) { if (missing(error)) return { directory, entries: [] }; throw error; }
  const results = [];
  for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
    if (!archivePattern.test(entry.name)) continue;
    if (!entry.isDirectory() || entry.isSymbolicLink()) {
      results.push({ state: "INVALIDO", path: join(directory, entry.name), reason: "Histórico no regular" });
      continue;
    }
    results.push(await validateTriplet(join(directory, entry.name, `${prefix}-catalog.json`), expected));
  }
  return { directory, entries: results };
};

const currentCatalogPath = async (root, providerId, prefix) => {
  const directory = join(root, "catalogs", "providers", providerId, "original");
  let files;
  try { files = await readdir(directory); }
  catch (error) { if (missing(error)) return join(directory, `${prefix}-catalog.json`); throw error; }
  const catalogs = files.filter((name) => name.endsWith("-catalog.json"));
  if (catalogs.length > 1) throw new Error(`Original portátil ambiguo para ${providerId}`);
  return join(directory, catalogs[0] ?? `${prefix}-catalog.json`);
};

const activeSources = async (root) => {
  const base = join(root, "catalogs", "providers");
  const directories = await readdir(base, { withFileTypes: true });
  const sources = [];
  for (const entry of directories.sort((a, b) => a.name.localeCompare(b.name))) {
    if (!entry.isDirectory() || entry.isSymbolicLink()) continue;
    const providerId = entry.name;
    const indexFile = join(base, providerId, "publications", "active.json");
    if (await optionalReadRegular(indexFile) === null) continue;
    const index = await readJson(indexFile);
    if (!record(index) || index.version !== 1 || index.providerId !== providerId ||
      typeof index.approvalSha256 !== "string" || !/^[a-f0-9]{64}$/.test(index.approvalSha256)) {
      throw new Error(`Índice activo inválido: ${indexFile}`);
    }
    const manifestFile = join(base, providerId, "publications", index.approvalSha256.slice(0, 12), "manifest.json");
    const manifest = await readJson(manifestFile);
    if (manifest.approvalSha256 !== index.approvalSha256) {
      throw new Error(`Publicación ${providerId} no coincide con el índice activo`);
    }
    const source = requireSource(manifest, providerId);
    sources.push({ providerId, manifestFile, expected: source });
  }
  return sources;
};

const parseArgs = (args) => {
  let root = process.cwd();
  let candidate = null;
  let json = false;
  for (let i = 0; i < args.length; i += 1) {
    if (args[i] === "--root" && args[i + 1]) root = args[++i];
    else if (args[i] === "--candidate" && args[i + 1]) candidate = args[++i];
    else if (args[i] === "--json") json = true;
    else throw new Error(`Argumento no admitido: ${args[i]}`);
  }
  return { root: resolve(root), candidate: candidate === null ? null : resolve(candidate), json };
};

export const inspectPublicationOriginals = async (root, candidate = null) => {
  const sources = await activeSources(root);
  const candidateSource = candidate === null ? null : JSON.parse(await readRegular(candidate));
  if (candidateSource !== null && (!record(candidateSource) ||
    !sources.some(({ providerId }) => providerId === candidateSource.providerId))) {
    throw new Error(`Candidato sin proveedor publicado: ${candidate}`);
  }
  const items = [];
  for (const { providerId, manifestFile, expected: source } of sources) {
    const currentPath = await currentCatalogPath(root, providerId, source.prefix ?? `scrape-${providerId}`);
    const currentRaw = await optionalReadRegular(currentPath);
    const currentPrefix = currentRaw === null ? null : JSON.parse(currentRaw).prefix;
    const prefix = source.prefix ?? currentPrefix;
    if (typeof prefix !== "string" || !/^[a-zA-Z0-9_-]+$/.test(prefix)) {
      throw new Error(`Sin prefijo canónico para localizar el histórico de ${providerId}`);
    }
    const expected = { ...source, prefix };
    const current = await validateTriplet(currentPath, expected, true);
    const archives = await inspectArchive(root, providerId, prefix, expected);
    const candidateResult = candidateSource?.providerId === providerId ? await validateTriplet(candidate, expected) : null;
    const available = current.state === "COINCIDE" || archives.entries.some((item) => item.state === "COINCIDE");
    items.push({ providerId, manifestFile, expected, current, archives, candidate: candidateResult,
      available, diagnosis: available ? "ORIGINAL_DISPONIBLE" : "HISTORICO_NO_DISPONIBLE" });
  }
  return { version: 1, mode: "SOLO_LECTURA", sources: items,
    complete: items.length > 0 && items.every((item) => item.available),
    invalid: items.some((item) => item.current.state === "INVALIDO" ||
      item.archives.entries.some((archive) => archive.state === "INVALIDO")) };
};

const present = (report) => {
  console.log(`PROCEDENCIA | ${report.sources.length} publicaciones activas | ${report.complete ? "fuentes disponibles" : "comparación parcialmente no disponible"} | solo lectura`);
  for (const item of report.sources) {
    console.log(`${item.providerId} | ${item.diagnosis} | ${item.expected.productCount} productos | SHA ${item.expected.catalogSha256}`);
    console.log(`  Publicación: ${item.manifestFile}`);
    console.log(`  Vigente: ${item.current.state} ${item.current.sha256 ?? ""}`.trimEnd());
    console.log(`  Archivo histórico: ${item.archives.directory} | ${item.archives.entries.length} cortes`);
    for (const archive of item.archives.entries) {
      console.log(`    ${archive.state}: ${archive.path}${archive.reason ? ` (${archive.reason})` : ""}`);
    }
    if (item.candidate) {
      console.log(`  CANDIDATO EXTERNO (NO RECUPERADO): ${item.candidate.state} | ${item.candidate.path}${item.candidate.reason ? ` (${item.candidate.reason})` : ""}`);
    }
  }
};

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const options = parseArgs(process.argv.slice(2));
    const report = await inspectPublicationOriginals(options.root, options.candidate);
    if (options.json) console.log(JSON.stringify(report, null, 2));
    else present(report);
    process.exitCode = report.invalid ? 1 : report.complete ? 0 : 2;
  } catch (error) {
    console.error(`PROCEDENCIA | ERROR | ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
  }
}
