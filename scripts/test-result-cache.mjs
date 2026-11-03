import { createHash, randomUUID } from "node:crypto";
import { existsSync, lstatSync, readFileSync, readdirSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { join, relative, resolve } from "node:path";

const VERSION = 2;
const CACHE_PATH = resolve("dist", ".test-results-cache.json");
const SOURCE_DIRECTORIES = ["src", "scripts", "catalogs", "data", "interventions", "docs"];
const BUILD_DIRECTORIES = ["dist"];
const ROOT_FILES = ["package.json", "package-lock.json", "tsconfig.json", ".gitattributes", ".gitignore",
  ".env", ".env.local", ".env.test", ".env.test.local",
  "node_modules/.package-lock.json", "node_modules/typescript/package.json",
  "node_modules/cheerio/package.json", "node_modules/p-limit/package.json"];

export const CACHEABLE_TESTS = new Set([
  "dist/pipeline/publication/tests/individual-finish.test.js",
  "dist/pipeline/publication/tests/individual-accreditation-session.test.js"
]);

const canonical = (file) => relative(process.cwd(), resolve(file)).replaceAll("\\", "/");

const listFiles = (directory, compiled = false) => {
  if (!existsSync(directory)) return [];
  const entries = [];
  const visit = (path) => {
    for (const entry of readdirSync(path, { withFileTypes: true })) {
      const child = join(path, entry.name);
      if (entry.isSymbolicLink()) throw new Error(`Entrada simbólica no acreditable: ${child}`);
      if (entry.isDirectory()) visit(child);
      else if (entry.isFile() && (!compiled || entry.name.endsWith(".js"))) entries.push(child);
      else if (!entry.isFile()) throw new Error(`Entrada no regular: ${child}`);
    }
  };
  visit(directory);
  return entries;
};

export const fingerprintTestInputs = () => {
  const inputs = [
    ...SOURCE_DIRECTORIES.flatMap((directory) => listFiles(resolve(directory))),
    ...BUILD_DIRECTORIES.flatMap((directory) => listFiles(resolve(directory), true)),
    ...ROOT_FILES.filter((file) => existsSync(file)).map((file) => resolve(file))
  ].sort((a, b) => canonical(a).localeCompare(canonical(b)));
  if (inputs.length === 0) throw new Error("No hay entradas verificables para la caché");
  const hash = createHash("sha256");
  hash.update(JSON.stringify({ version: VERSION, root: process.cwd(), node: process.version,
    executable: process.execPath, platform: process.platform, architecture: process.arch,
    env: Object.fromEntries(Object.entries(process.env).sort(([left], [right]) => left.localeCompare(right))) }));
  for (const path of inputs) {
    const info = lstatSync(path);
    if (!info.isFile() || info.isSymbolicLink()) throw new Error(`Entrada no regular: ${path}`);
    hash.update(canonical(path));
    hash.update("\0");
    hash.update(readFileSync(path));
    hash.update("\0");
  }
  return hash.digest("hex");
};

const validCounts = (value) => value !== null && typeof value === "object" &&
  Number.isSafeInteger(value.passed) && value.passed > 0 &&
  value.failed === 0 && value.skipped === 0 && value.todo === 0;

export const loadTestResultsCache = (fingerprint) => {
  try {
    if (!existsSync(CACHE_PATH)) return new Map();
    const info = lstatSync(CACHE_PATH);
    if (!info.isFile() || info.isSymbolicLink()) return new Map();
    const data = JSON.parse(readFileSync(CACHE_PATH, "utf8"));
    if (data?.version !== VERSION || data.fingerprint !== fingerprint || !data.results ||
      typeof data.results !== "object" || Array.isArray(data.results)) return new Map();
    return new Map(Object.entries(data.results).filter(([name, counts]) =>
      CACHEABLE_TESTS.has(name) && validCounts(counts)));
  } catch {
    return new Map();
  }
};

export const saveTestResultsCache = (fingerprint, results) => {
  const entries = Object.fromEntries([...results].filter(([name, counts]) =>
    CACHEABLE_TESTS.has(name) && validCounts(counts)));
  const stage = `${CACHE_PATH}.${randomUUID()}.tmp`;
  try {
    if (existsSync(CACHE_PATH)) {
      const info = lstatSync(CACHE_PATH);
      if (!info.isFile() || info.isSymbolicLink()) throw new Error("La caché no es un archivo regular");
    }
    writeFileSync(stage, JSON.stringify({ version: VERSION, fingerprint, results: entries }));
    renameSync(stage, CACHE_PATH);
  } finally {
    rmSync(stage, { force: true });
  }
};

export const relativeCacheFile = canonical;

export const discardTestResultsCache = () => {
  if (!existsSync(CACHE_PATH)) return;
  const info = lstatSync(CACHE_PATH);
  if (!info.isFile() || info.isSymbolicLink()) throw new Error("La caché no es un archivo regular");
  rmSync(CACHE_PATH);
};
