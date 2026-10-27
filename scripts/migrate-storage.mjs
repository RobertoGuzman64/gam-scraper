import { createHash } from "node:crypto";
import { lstat, readFile, readdir, rename } from "node:fs/promises";
import { dirname, isAbsolute, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const exists = async (path) => {
  try { return await lstat(path); }
  catch (error) { if (error?.code === "ENOENT") return null; throw error; }
};
const assertDirectory = async (path) => {
  const entry = await exists(path);
  if (entry && !entry.isDirectory()) throw new Error(`Expected a directory: ${path}`);
  return entry !== null;
};
const ensureMissing = async (path) => {
  if (await exists(path)) throw new Error(`Destination already exists: ${path}`);
};
const digest = (data) => createHash("sha256").update(data).digest("hex");
const verifyReference = async (directory, legacy) => {
  const reportName = legacy ? "diferencias.json" : "differences.json";
  const expected = ["gam.json", "gomariz.json", "mercaeleva.json", "manifest.json", reportName];
  const entries = await readdir(directory, { withFileTypes: true });
  if (entries.length !== expected.length || entries.some((entry) => !entry.isFile() || !expected.includes(entry.name))) {
    throw new Error(`Unexpected reference files: ${directory}`);
  }
  const manifest = JSON.parse(await readFile(join(directory, "manifest.json"), "utf8"));
  if (manifest.version !== 1 || !Array.isArray(manifest.catalogs) || manifest.catalogs.length !== 3) {
    throw new Error("Invalid reference manifest");
  }
  const report = await readFile(join(directory, reportName));
  if (digest(report) !== manifest.differencesSha256) throw new Error("Reference report SHA256 mismatch");
  for (const providerId of ["gam", "gomariz", "mercaeleva"]) {
    const record = manifest.catalogs.find((catalog) => catalog.providerId === providerId);
    if (!record || typeof record.sha256 !== "string" ||
      digest(await readFile(join(directory, `${providerId}.json`))) !== record.sha256) {
      throw new Error(`Reference catalog SHA256 mismatch: ${providerId}`);
    }
  }
};

const migrateTransfer = async (directory) => {
  const destination = resolve(directory);
  const path = relative(root, destination);
  if (!path || (path !== ".." && !path.startsWith(`..${sep}`) && !isAbsolute(path))) {
    throw new Error("Transfer directory must be outside the repository");
  }
  if (!(await assertDirectory(destination))) throw new Error(`Transfer directory does not exist: ${destination}`);
  const old = join(destination, "diferencias.json");
  const hasOld = await exists(old);
  await verifyReference(destination, hasOld !== null);
  if (hasOld) await rename(old, join(destination, "differences.json"));
  await verifyReference(destination, false);
  console.log(`PASS | Reference transfer migrated: ${destination}`);
};

const legacyReference = join(root, "data", "referencia");
const currentReference = join(root, "data", "reference");
const legacyDirectories = [
  [join(root, "storage", "campanas"), join(root, "storage", "campaigns")],
  [join(root, "storage", "scraped", "campanas"), join(root, "storage", "scraped", "campaigns")]
];

try {
  if (process.argv.length === 4 && process.argv[2] === "--transfer") {
    await migrateTransfer(process.argv[3]);
    process.exit(0);
  }
  if (process.argv.length !== 2) throw new Error("Usage: node scripts/migrate-storage.mjs [--transfer <external-directory>]");
  const legacyExists = await assertDirectory(legacyReference);
  const currentExists = await assertDirectory(currentReference);
  if (legacyExists && currentExists) throw new Error("Both legacy and current reference directories exist");
  for (const name of [".referencia-anterior", ".referencia-candidata", ".referencia-bloqueo"]) {
    if (await exists(join(root, "data", name))) {
      throw new Error(`Legacy reference transaction pending: ${name}. Recover it before migration`);
    }
  }
  if (legacyExists) await verifyReference(legacyReference, true);
  else if (currentExists) {
    const oldReport = await exists(join(currentReference, "diferencias.json"));
    await verifyReference(currentReference, oldReport !== null);
  }
  for (const [source, target] of legacyDirectories) {
    if (!(await assertDirectory(source))) continue;
    await ensureMissing(target);
    if ((await readdir(source)).length > 0) {
      throw new Error(`Legacy campaign data is not empty: ${source}. Complete and clean the campaign before migrating`);
    }
  }
  if (legacyExists) {
    await rename(legacyReference, currentReference);
    console.log("MIGRATED | data/reference");
  }
  if (await assertDirectory(currentReference)) {
    const oldReport = join(currentReference, "diferencias.json");
    if (await exists(oldReport)) await rename(oldReport, join(currentReference, "differences.json"));
    await verifyReference(currentReference, false);
  }
  for (const [source, target] of legacyDirectories) {
    if (await assertDirectory(source)) {
      await rename(source, target);
      console.log(`MIGRATED | ${target.slice(root.length + 1)}`);
    }
  }
  console.log("PASS | Storage naming migration completed");
} catch (error) {
  console.error(`FAIL | ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
}
