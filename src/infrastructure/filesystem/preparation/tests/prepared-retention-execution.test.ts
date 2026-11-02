import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { link, lstat, mkdir, mkdtemp, open, readFile, readdir, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import type { ProductRecord } from "../../../../contracts/catalog.js";
import type { CategoryConfig, CategoryScrapeResult } from "../../../../contracts/scraping.js";
import { writeOutputs } from "../../../../pipeline/publication/publish.js";
import { prepareSavedCatalog } from "../../../../pipeline/preparation/prepare.js";
import { offlinePreparationManifest } from "../offline-preparation.js";
import { simulatePreparedRetention } from "../preparation-retention.js";
import { executePreparedRetention, type PreparedRetentionApproval } from "../prepared-retention-execution.js";
import { formatRetentionExecution } from "../../../../cli/reporting/retention-execution.js";

const category: CategoryConfig = { key: "maquinas", name: "Maquinaria", url: "https://example.test/maquinas" };
const product = (id: number): ProductRecord => ({
  providerId: "gam", categoryKey: category.key, categoryName: category.name,
  url: `https://example.test/maquina/${id}`, title: `Máquina ${id}`,
  shortDescription: null, longDescription: null, price: null, reference: `GAM-${id}`,
  brand: null, model: null, year: null, location: null, country: null,
  horometer: null, serialNumber: null, image: null, condition: null, images: [], specs: {}
});

const approval: PreparedRetentionApproval = {
  phase3Closed: true, externalReferencesVerified: true,
  writersCoordinated: true, familyApproved: true
};

const withWorkspace = async (run: (root: string, source: string) => Promise<void>): Promise<void> => {
  const root = await mkdtemp(join(tmpdir(), "equipzilla-retention-f4-"));
  try {
    const source = join(root, "storage", "scraped", "gam", "lote-catalog.json");
    const products = Array.from({ length: 12 }, (_, index) => product(index + 1));
    const result: CategoryScrapeResult = { category, discoveredProductUrls: products.length, products, failures: [] };
    await writeOutputs(join(root, "storage", "scraped", "gam"), "lote", [result], "2026-10-21T12:00:00Z", "2026-10-21T12:00:00Z");
    await run(root, source);
  } finally { await rm(root, { recursive: true, force: true }); }
};

const saveVersion = async (root: string, source: string, index: number): Promise<string> => {
  const path = join(root, "storage", "prepared", "gam", `lote-v${index}-preparation.json`);
  const result = await prepareSavedCatalog({ providerId: "gam", source, out: path, dryRun: false, compare: null });
  const parsed: unknown = JSON.parse(await readFile(path, "utf8"));
  if (typeof parsed !== "object" || parsed === null || !("preparedAt" in parsed)) throw new Error("Fixture inválido");
  const current = { ...parsed, preparedAt: `2026-10-${String(index).padStart(2, "0")}T12:00:00Z` };
  const raw = JSON.stringify(current, null, 2);
  await writeFile(path, raw);
  await writeFile(result.manifestFile, offlinePreparationManifest(raw, result.preparation));
  return path;
};

test("deniega mutaciones si no están aprobadas todas las puertas", async () => {
  await withWorkspace(async (root, source) => {
    const first = await saveVersion(root, source, 1);
    await saveVersion(root, source, 2);
    await saveVersion(root, source, 3);
    const planned = await simulatePreparedRetention(root, "gam");
    const result = await executePreparedRetention(root, "gam", planned, { ...approval, externalReferencesVerified: false });
    assert.equal(result.status, "sin_borrado_por_proteccion");
    assert.equal(result.deletedFiles, 0);
    assert.equal((await lstat(first)).isFile(), true);
  });
});

test("en directorio temporal retira una versión íntegra y conserva dos, con idempotencia", async () => {
  await withWorkspace(async (root, source) => {
    const first = await saveVersion(root, source, 1);
    const second = await saveVersion(root, source, 2);
    const third = await saveVersion(root, source, 3);
    const original = createHash("sha256").update(await readFile(second)).digest("hex");
    const planned = await simulatePreparedRetention(root, "gam");
    assert.equal(planned.candidates, 1);
    const result = await executePreparedRetention(root, "gam", planned, approval);
    assert.equal(result.status, "completada");
    assert.equal(result.deletedVersions, 1);
    assert.equal(result.deletedFiles, 3);
    assert.ok(result.deletedBytes > 0);
    await assert.rejects(lstat(first), { code: "ENOENT" });
    assert.equal((await lstat(second)).isFile(), true);
    assert.equal((await lstat(third)).isFile(), true);
    assert.equal(createHash("sha256").update(await readFile(second)).digest("hex"), original);
    const repeated = await executePreparedRetention(root, "gam", await simulatePreparedRetention(root, "gam"), approval);
    assert.equal(repeated.deletedVersions, 0);
    assert.equal(repeated.deletedFiles, 0);
    assert.deepEqual(formatRetentionExecution("gam", repeated), []);
    assert.ok(formatRetentionExecution("gam", result).some((line) => line.includes("Eliminados") || line.includes("eliminados")));
  });
});

test("bloquea planificación antigua cuando cambia una referencia o aparece otra versión", async () => {
  await withWorkspace(async (root, source) => {
    const first = await saveVersion(root, source, 1);
    await saveVersion(root, source, 2);
    await saveVersion(root, source, 3);
    const planned = await simulatePreparedRetention(root, "gam");
    const hash = createHash("sha256").update(await readFile(first)).digest("hex");
    const folder = join(root, "catalogs", "providers", "gam", "publications");
    await mkdir(folder, { recursive: true });
    await writeFile(join(folder, "active.json"), JSON.stringify({ preparationSha256: hash }));
    const result = await executePreparedRetention(root, "gam", planned, approval);
    assert.equal(result.deletedFiles, 0);
    assert.equal(result.status, "sin_borrado_por_proteccion");
    assert.equal((await lstat(first)).isFile(), true);
    await rm(join(folder, "active.json"));
    await saveVersion(root, source, 4);
    const changed = await executePreparedRetention(root, "gam", planned, approval);
    assert.equal(changed.deletedFiles, 0);
    assert.equal(changed.status, "sin_borrado_por_proteccion");
  });
});

test("un bloqueo exclusivo existente evita actuar sobre candidatos", async () => {
  await withWorkspace(async (root, source) => {
    const first = await saveVersion(root, source, 1);
    await saveVersion(root, source, 2);
    await saveVersion(root, source, 3);
    const planned = await simulatePreparedRetention(root, "gam");
    const lock = join(root, "storage", "prepared", ".retention-gam.lock");
    const handle = await open(lock, "wx");
    try {
      const result = await executePreparedRetention(root, "gam", planned, approval);
      assert.equal(result.deletedFiles, 0);
      assert.equal(result.status, "sin_borrado_por_proteccion");
      assert.equal((await lstat(first)).isFile(), true);
    } finally { await handle.close(); await rm(lock); }
  });
});

test("el ejecutor rechaza proveedores inválidos y directorios enlazados", async () => {
  await withWorkspace(async (root, source) => {
    const first = await saveVersion(root, source, 1);
    await saveVersion(root, source, 2);
    await saveVersion(root, source, 3);
    const planned = await simulatePreparedRetention(root, "gam");
    const invalid = await executePreparedRetention(root, "../externo", planned, approval);
    assert.equal(invalid.deletedFiles, 0);
    const prepared = join(root, "storage", "prepared");
    await rm(prepared, { recursive: true });
    await symlink(join(root, "storage", "scraped"), prepared, "dir");
    const linked = await executePreparedRetention(root, "gam", planned, approval);
    assert.equal(linked.deletedFiles, 0);
    assert.equal(linked.status, "sin_borrado_por_proteccion");
    assert.equal((await readdir(join(root, "storage", "scraped", "gam"))).includes("lote-catalog.json"), true);
    await assert.rejects(lstat(first), { code: "ENOENT" });
  });
});

test("borra todos los excedentes de una cohorte y no solo el más antiguo", async () => {
  await withWorkspace(async (root, source) => {
    const paths = [];
    for (let index = 1; index <= 5; index += 1) paths.push(await saveVersion(root, source, index));
    const planned = await simulatePreparedRetention(root, "gam");
    assert.equal(planned.candidates, 3);
    const result = await executePreparedRetention(root, "gam", planned, approval);
    assert.equal(result.status, "completada");
    assert.equal(result.deletedVersions, 3);
    assert.equal(result.deletedFiles, 9);
    for (const path of paths.slice(0, 3)) await assert.rejects(lstat(path), { code: "ENOENT" });
    for (const path of paths.slice(3)) assert.equal((await lstat(path)).isFile(), true);
  });
});

test("bloquea cambios de diagnósticos aunque la forma JSON siga siendo válida", async () => {
  await withWorkspace(async (root, source) => {
    const first = await saveVersion(root, source, 1);
    await saveVersion(root, source, 2);
    await saveVersion(root, source, 3);
    const planned = await simulatePreparedRetention(root, "gam");
    const path = first.replace(/-preparation\.json$/, "-diagnostics.json");
    const original = await readFile(path, "utf8");
    const altered: unknown = JSON.parse(original);
    if (typeof altered !== "object" || altered === null) throw new Error("Diagnóstico inválido");
    await writeFile(path, JSON.stringify({ ...altered, retentionUnexpected: true }, null, 2));
    const result = await executePreparedRetention(root, "gam", planned, approval);
    assert.equal(result.deletedFiles, 0);
    assert.equal(result.status, "sin_borrado_por_proteccion");
    assert.equal((await lstat(first)).isFile(), true);
  });
});

test("un archivo con enlaces duros impide retirar el conjunto", async () => {
  await withWorkspace(async (root, source) => {
    const first = await saveVersion(root, source, 1);
    await saveVersion(root, source, 2);
    await saveVersion(root, source, 3);
    const planned = await simulatePreparedRetention(root, "gam");
    await link(first, join(root, "copia-preparation.json"));
    const result = await executePreparedRetention(root, "gam", planned, approval);
    assert.equal(result.deletedFiles, 0);
    assert.equal(result.status, "incompleta");
    assert.equal((await lstat(first)).isFile(), true);
  });
});

test("conserva una preparación antigua acreditada y solo retira el excedente no referenciado", async () => {
  await withWorkspace(async (root, source) => {
    const first = await saveVersion(root, source, 1);
    const second = await saveVersion(root, source, 2);
    const third = await saveVersion(root, source, 3);
    const fourth = await saveVersion(root, source, 4);
    const hash = createHash("sha256").update(await readFile(first)).digest("hex");
    const folder = join(root, "catalogs", "providers", "gam", "publications");
    await mkdir(folder, { recursive: true });
    await writeFile(join(folder, "active.json"), JSON.stringify({ preparationSha256: hash }));
    const planned = await simulatePreparedRetention(root, "gam");
    assert.equal(planned.protected, 1);
    assert.equal(planned.candidates, 1);
    const result = await executePreparedRetention(root, "gam", planned, approval);
    assert.equal(result.status, "completada");
    assert.equal(result.deletedVersions, 1);
    assert.equal(result.deletedFiles, 3);
    assert.equal((await lstat(first)).isFile(), true);
    await assert.rejects(lstat(second), { code: "ENOENT" });
    assert.equal((await lstat(third)).isFile(), true);
    assert.equal((await lstat(fourth)).isFile(), true);
  });
});
