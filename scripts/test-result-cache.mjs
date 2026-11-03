import { createHash, randomUUID } from "node:crypto";
import { existsSync, lstatSync, readFileSync, readdirSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { isBuiltin } from "node:module";
import { extname, join, relative, resolve } from "node:path";

const VERSION = 4;
const CACHE_PATH = resolve("dist", ".test-results-cache.json");
const DATA_DIRECTORIES = ["catalogs", "data", "interventions", "docs"];
const SOURCE_DIRECTORIES = ["src", "scripts"];
const ROOT_FILES = ["README.md", "package.json", "package-lock.json", "tsconfig.json", ".gitattributes", ".gitignore",
  ".env", ".env.local", ".env.test", ".env.test.local",
  "node_modules/.package-lock.json", "node_modules/typescript/package.json",
  "node_modules/cheerio/package.json", "node_modules/p-limit/package.json",
  "scripts/run-tests.mjs", "scripts/test-result-cache.mjs", "scripts/test-performance.mjs", "scripts/test-runner-observability.mjs",
  "scripts/test-runner-execution.mjs", "scripts/test-runner-worker.mjs", "scripts/test-runner-ui.mjs",
  "scripts/run-build.mjs", "scripts/build-cache.mjs", "scripts/terminal.mjs"];
const PURE_ROOT_FILES = new Set([
  "package.json", "package-lock.json", "tsconfig.json",
  "node_modules/.package-lock.json", "node_modules/typescript/package.json",
  "node_modules/cheerio/package.json", "node_modules/p-limit/package.json",
  "scripts/run-tests.mjs", "scripts/test-result-cache.mjs", "scripts/test-performance.mjs", "scripts/test-runner-observability.mjs",
  "scripts/test-runner-execution.mjs", "scripts/test-runner-worker.mjs", "scripts/test-runner-ui.mjs",
  "scripts/run-build.mjs", "scripts/build-cache.mjs", "scripts/terminal.mjs"
]);
const EXTERNAL_DATA_ACCESS = /\b(?:node:fs(?:\/promises)?|fs\/promises|process\.(?:binding|loadEnvFile))\b/u;
const AUDITED_FAMILIES = [
  "src/catalog/preparation/tests/",
  "src/catalog/coverage/tests/",
  "src/catalog/editorial/tests/",
  "src/catalog/diagnostics/tests/",
  "src/catalog/legacy-export/tests/",
  "src/catalog/tests/",
  "src/scraping/providers/",
  "src/scraping/tests/",
  "src/cli/options/tests/",
  "src/cli/reporting/tests/",
  "src/tools/gam/tests/",
  "src/tools/gam/seed/tests/"
];
const REJECTED_TEST_OPERATIONS = [
  /\b(?:spawn|spawnSync|exec|execSync|execFile|execFileSync|fork)\s*\(/u,
  /\b(?:writeFile|writeFileSync|appendFile|appendFileSync|mkdir|mkdirSync|mkdtemp|mkdtempSync|copyFile|copyFileSync|cpSync|rename|renameSync|unlink|unlinkSync|rmSync|rmdir|rmdirSync|symlink|symlinkSync|createWriteStream)\b/u,
  /\b(?:cp|rm)\s*\(/u,
  /\b(?:fetch|setTimeout|setInterval|Math\.random|Date\.now|randomUUID|performance\.now|randomBytes|randomInt)\s*\(/u,
  /\bnew\s+Date\s*\(/u,
  /\b(?:process\.chdir|process\.exit|process\.kill)\s*\(/u,
  /\b(?:process\.env|process\.argv|node:child_process|node:net|node:http|node:https|node:dgram|node:worker_threads)\b/u,
  /\btmpdir\s*\(/u,
  /\b(?:eval|Function|createRequire)\s*\(/u
];

const REJECTED_MODULE_OPERATIONS = [
  /\b(?:node:child_process|node:net|node:http|node:https|node:dgram|node:worker_threads)\b/u,
  /\b(?:fetch|createRequire)\s*\(/u
];

const canonical = (file) => relative(process.cwd(), resolve(file)).replaceAll("\\", "/");
export const relativeCacheFile = canonical;
const hashBytes = (buffer) => createHash("sha256").update(buffer).digest("hex");

const readRegular = (path) => {
  const stat = lstatSync(path);
  if (!stat.isFile() || stat.isSymbolicLink()) throw new Error(`Entrada no regular: ${path}`);
  return readFileSync(path);
};

const walkFiles = (directory, accept = () => true) => {
  if (!existsSync(directory)) return [];
  const root = lstatSync(directory);
  if (!root.isDirectory() || root.isSymbolicLink()) throw new Error(`Directorio no acreditable: ${directory}`);
  const paths = [];
  const visit = (path) => {
    for (const item of readdirSync(path, { withFileTypes: true })) {
      const child = join(path, item.name);
      if (item.isSymbolicLink()) throw new Error(`Entrada simbólica no acreditable: ${child}`);
      if (item.isDirectory()) visit(child);
      else if (item.isFile() && accept(child)) paths.push(child);
      else if (!item.isFile()) throw new Error(`Entrada no regular: ${child}`);
    }
  };
  visit(directory);
  return paths;
};

const sharedFingerprint = (withExternalData) => {
  const inputs = [
    ...(withExternalData ? DATA_DIRECTORIES.flatMap((directory) => walkFiles(resolve(directory))) : []),
    ...(withExternalData ? SOURCE_DIRECTORIES.flatMap((directory) => walkFiles(resolve(directory), (path) =>
      !/\.(?:ts|tsx|js|mjs|cjs)$/u.test(path))) : []),
    ...ROOT_FILES.filter((path) => (withExternalData || PURE_ROOT_FILES.has(path)) && existsSync(path))
      .map((path) => resolve(path))
  ].sort((left, right) => canonical(left).localeCompare(canonical(right)));
  const sha = createHash("sha256");
  sha.update(JSON.stringify({ version: VERSION, withExternalData, root: process.cwd(), node: process.version,
    executable: process.execPath, platform: process.platform, architecture: process.arch,
    env: Object.fromEntries(Object.entries(process.env).sort(([left], [right]) => left.localeCompare(right))) }));
  for (const file of inputs) {
    sha.update(canonical(file));
    sha.update("\0");
    sha.update(readRegular(file));
    sha.update("\0");
  }
  return sha.digest("hex");
};

const importsOf = (code) => {
  if (/\b(?:require|createRequire|eval)\s*\(|\bimport\s*\(/u.test(code)) return null;
  const imports = [];
  const statements = /\b(?:import|export)\s+[^;]{0,2000}?\bfrom\s*["']([^"']+)["']/gu;
  for (const match of code.matchAll(statements)) imports.push(match[1]);
  const sideEffects = /\bimport\s*["']([^"']+)["']/gu;
  for (const match of code.matchAll(sideEffects)) imports.push(match[1]);
  return imports;
};

const resolveDependency = (importer, specifier) => {
  if (isBuiltin(specifier)) return undefined;
  if (!specifier.startsWith("./") && !specifier.startsWith("../")) return null;
  const candidate = resolve(importer, "..", specifier);
  if (!candidate.startsWith(`${resolve("dist")}/`) && !candidate.startsWith(`${resolve("dist")}\\`) &&
    !candidate.startsWith(`${resolve("scripts")}/`) && !candidate.startsWith(`${resolve("scripts")}\\`)) return null;
  if (!existsSync(candidate) || !lstatSync(candidate).isFile() || lstatSync(candidate).isSymbolicLink()) return null;
  return candidate;
};

const sourceOf = (path) => {
  const name = canonical(path);
  if (!name.startsWith("dist/") || extname(path) !== ".js") return null;
  return resolve("src", name.slice(5).replace(/\.js$/u, ".ts"));
};

const auditedSource = (file) => {
  const source = sourceOf(file);
  if (!source || !existsSync(source) || !AUDITED_FAMILIES.some((prefix) => canonical(source).startsWith(prefix))) return null;
  const text = readRegular(source).toString("utf8");
  if (REJECTED_TEST_OPERATIONS.some((expression) => expression.test(text))) return null;
  return source;
};

const moduleFingerprint = (file, hashes, visiting = new Set()) => {
  const path = resolve(file);
  if (hashes.has(path)) return hashes.get(path);
  if (visiting.has(path)) return null;
  visiting.add(path);
  const content = readRegular(path);
  const code = content.toString("utf8");
  if (!LEGACY_AUDITED_SUITES.has(canonical(path)) && REJECTED_MODULE_OPERATIONS.some((pattern) => pattern.test(code))) return null;
  const dependencies = importsOf(code);
  if (dependencies === null) return null;
  const parts = [canonical(path), hashBytes(content)];
  let withExternalData = EXTERNAL_DATA_ACCESS.test(code) || /\b(?:node:)?fs(?:\/promises)?["']/u.test(code);
  const source = sourceOf(path);
  if (source) {
    if (!existsSync(source)) return null;
    const sourceContent = readRegular(source);
    const sourceText = sourceContent.toString("utf8");
    parts.push(canonical(source), hashBytes(sourceContent));
    withExternalData ||= EXTERNAL_DATA_ACCESS.test(sourceText) ||
      /\b(?:node:)?fs(?:\/promises)?["']/u.test(sourceText);
  }
  for (const specifier of dependencies) {
    const dependency = resolveDependency(path, specifier);
    if (dependency === null) return null;
    if (dependency === undefined) continue;
    const fingerprint = moduleFingerprint(dependency, hashes, visiting);
    if (fingerprint === null) return null;
    parts.push(canonical(dependency), fingerprint.digest);
    withExternalData ||= fingerprint.withExternalData;
  }
  visiting.delete(path);
  const fingerprint = { digest: hashBytes(Buffer.from(parts.join("\0"))), withExternalData };
  hashes.set(path, fingerprint);
  return fingerprint;
};


const legacyFingerprint = () => {
  const files = [
    ...SOURCE_DIRECTORIES.flatMap((directory) => walkFiles(resolve(directory))),
    ...walkFiles(resolve("dist"), (path) => path.endsWith(".js"))
  ].sort((left, right) => canonical(left).localeCompare(canonical(right)));
  const sha = createHash("sha256");
  for (const file of files) {
    sha.update(canonical(file));
    sha.update("\0");
    sha.update(readRegular(file));
    sha.update("\0");
  }
  return sha.digest("hex");
};
export const fingerprintTestInputs = (files) => {
  const shared = new Map();
  const sharedFor = (withExternalData) => {
    if (!shared.has(withExternalData)) shared.set(withExternalData, sharedFingerprint(withExternalData));
    return shared.get(withExternalData);
  };
  const hashes = new Map();
  const fingerprints = new Map();
  const legacy = files.some((file) => LEGACY_AUDITED_SUITES.has(canonical(file)))
    ? legacyFingerprint() : null;
  for (const file of files) {
    const name = canonical(file);
    if (LEGACY_AUDITED_SUITES.has(name)) {
      fingerprints.set(name, hashBytes(Buffer.from(`${sharedFor(true)}\0${legacy}\0${name}`)));
      continue;
    }
    if (!auditedSource(file)) continue;
    const digest = moduleFingerprint(file, hashes);
    if (digest !== null) fingerprints.set(name, hashBytes(Buffer.from(`${sharedFor(digest.withExternalData)}\0${digest.digest}`)));
  }
  return fingerprints;
};

const LEGACY_AUDITED_SUITES = new Set([
  "dist/pipeline/publication/tests/individual-finish.test.js",
  "dist/pipeline/publication/tests/individual-finish-cycle.test.js",
  "dist/pipeline/publication/tests/individual-finish-editorial.test.js",
  "dist/pipeline/publication/tests/individual-accreditation-session.test.js"
]);

const validCounts = (value) => value !== null && typeof value === "object" &&
  Number.isSafeInteger(value.passed) && value.passed > 0 &&
  value.failed === 0 && value.skipped === 0 && value.todo === 0;

export const loadTestResultsCache = (fingerprints) => {
  try {
    if (!existsSync(CACHE_PATH)) return new Map();
    const data = JSON.parse(readRegular(CACHE_PATH).toString("utf8"));
    if (data?.version !== VERSION || !data.results ||
      typeof data.results !== "object" || Array.isArray(data.results)) return new Map();
    return new Map(Object.entries(data.results).filter(([name, value]) =>
      fingerprints.get(name) === value.fingerprint && validCounts(value)));
  } catch {
    return new Map();
  }
};

export const saveTestResultsCache = (fingerprints, results) => {
  const entries = Object.fromEntries([...results].filter(([name, value]) =>
    fingerprints.get(name) === value.fingerprint && validCounts(value)));
  const stage = `${CACHE_PATH}.${randomUUID()}.tmp`;
  try {
    if (existsSync(CACHE_PATH)) readRegular(CACHE_PATH);
    writeFileSync(stage, JSON.stringify({ version: VERSION, results: entries }));
    renameSync(stage, CACHE_PATH);
  } finally {
    rmSync(stage, { force: true });
  }
};

export const discardTestResultsCache = () => {
  if (!existsSync(CACHE_PATH)) return;
  readRegular(CACHE_PATH);
  rmSync(CACHE_PATH);
};
