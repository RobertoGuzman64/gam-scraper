import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { copyFile, lstat, mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { parseIndividualCatalogProviders } from "../../../cli/options/individual-catalog.js";
import { readOfflinePreparation } from "../../../infrastructure/filesystem/preparation/offline-preparation.js";
import { validateManainRecordPreparation } from "../offline.js";
import { readVerifiedManainRecordSource } from "../../../infrastructure/filesystem/catalog/manain-record-source.js";
import { runPrepareIndividual } from "../../../cli/commands/catalog/prepare-individual.js";

const source = join(process.cwd(), "catalogs", "providers", "manain");

const setup = async (): Promise<string> => {
  const root = await mkdtemp(join(tmpdir(), "equipzilla-manain-prepare-"));
  try {
    const active: unknown = JSON.parse(await readFile(join(source, "technical", "active.json"), "utf8"));
    if (active === null || typeof active !== "object" || Array.isArray(active) ||
      !("sha256" in active) || typeof active.sha256 !== "string") {
      throw new Error("Selector técnico de prueba inválido");
    }
    const base = join(root, "catalogs", "providers", "manain");
    const version = join("technical", "versions", active.sha256);
    await mkdir(join(base, "records"), { recursive: true });
    await mkdir(join(base, version), { recursive: true });
    await copyFile(join(source, "records", "manain-record.json"), join(base, "records", "manain-record.json"));
    await copyFile(join(source, "technical", "active.json"), join(base, "technical", "active.json"));
    for (const name of ["snapshot.json", "manifest.json"]) {
      await copyFile(join(source, version, name), join(base, version, name));
    }
    return root;
  } catch (error) {
    await rm(root, { recursive: true, force: true });
    throw error;
  }
};

const prepare = (workspace: string, dryRun = false) => runPrepareIndividual([
  "--proveedor", "manain", ...(dryRun ? ["--simular"] : [])
], workspace);

const preparationFile = async (workspace: string): Promise<string> => {
  const directory = join(workspace, "storage", "prepared", "manain");
  const names = (await readdir(directory)).filter((name) => name.endsWith("-preparation.json"));
  assert.equal(names.length, 1);
  return join(directory, names[0]!);
};

test("la preparación admite Manain por selección explícita y conserva FINISH restringido", () => {
  assert.deepEqual(parseIndividualCatalogProviders([], true).providerIds, ["gam", "gomariz", "mercaeleva"]);
  assert.deepEqual(parseIndividualCatalogProviders(["--proveedor", "manain"], true).providerIds, ["manain"]);
  assert.throws(() => parseIndividualCatalogProviders(["--proveedor", "manain"]), /requiere/);
});

test("Manain: simulación prepara el registro real sin escrituras ni alterar el original", async () => {
  const root = await setup();
  try {
    const path = join(root, "catalogs", "providers", "manain", "records", "manain-record.json");
    const before = await readFile(path);
    assert.equal(await prepare(root, true), true);
    assert.deepEqual(await readFile(path), before);
    await assert.rejects(lstat(join(root, "storage")), { code: "ENOENT" });
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("Manain: genera una preparación verificable, la reutiliza y conserva el origen partial", async () => {
  const root = await setup();
  try {
    const recordFile = join(root, "catalogs", "providers", "manain", "records", "manain-record.json");
    const originalSha = createHash("sha256").update(await readFile(recordFile)).digest("hex");
    assert.equal(await prepare(root), true);
    const path = await preparationFile(root);
    const prepared = await readOfflinePreparation(path, "manain");
    assert.equal(prepared.source.catalogSha256, originalSha);
    assert.equal(prepared.source.record?.quality, "partial");
    const verified = await readVerifiedManainRecordSource(root);
    assert.equal(verified.snapshot.source.kind, "manain-record");
    if (verified.snapshot.source.kind !== "manain-record") throw new Error("Origen técnico Manain no verificado");
    assert.equal(prepared.source.record?.discoveredProductUrls, verified.snapshot.source.discoveredProductUrls);
    assert.equal(prepared.products.length, verified.originalProducts.length);
    assert.equal(prepared.totals.ready + prepared.totals.review, verified.originalProducts.length);
    assert.equal(prepared.quality, "complete");
    await validateManainRecordPreparation(root, path);
    const bytes = await readFile(path);
    const timestamp = (await lstat(path)).mtimeMs;
    assert.equal(await prepare(root), true);
    assert.equal(await preparationFile(root), path);
    assert.equal((await lstat(path)).mtimeMs, timestamp);
    assert.deepEqual(await readFile(path), bytes);
    assert.equal(createHash("sha256").update(await readFile(recordFile)).digest("hex"), originalSha);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("Manain: la corrupción de la preparación impide reutilización sin sobrescribir", async () => {
  const root = await setup();
  try {
    assert.equal(await prepare(root), true);
    const path = await preparationFile(root);
    const tampered = `${await readFile(path, "utf8")} `;
    await writeFile(path, tampered);
    assert.equal(await prepare(root), false);
    assert.equal(await readFile(path, "utf8"), tampered);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
