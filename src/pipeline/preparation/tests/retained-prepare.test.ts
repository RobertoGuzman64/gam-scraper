import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { lstat, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import type { ProductRecord } from "../../../contracts/catalog.js";
import type { CategoryConfig, CategoryScrapeResult } from "../../../contracts/scraping.js";
import { writeOutputs } from "../../publication/publish.js";
import { prepareSavedCatalogWithRetention } from "../retained-prepare.js";

const category: CategoryConfig = { key: "maquinas", name: "Maquinaria", url: "https://example.test/maquinas" };
const product = (id: number): ProductRecord => ({
  providerId: "gam", categoryKey: category.key, categoryName: category.name,
  url: `https://example.test/maquina/${id}`, title: `Máquina ${id}`,
  shortDescription: null, longDescription: null, price: null, reference: `GAM-${id}`,
  brand: null, model: null, year: null, location: null, country: null,
  horometer: null, serialNumber: null, image: null, condition: null, images: [], specs: {}
});

const withWorkspace = async (run: (root: string, source: string) => Promise<void>): Promise<void> => {
  const root = await mkdtemp(join(tmpdir(), "equipzilla-retention-automatic-"));
  try {
    const source = join(root, "storage", "scraped", "gam", "lote-catalog.json");
    const products = Array.from({ length: 12 }, (_, index) => product(index + 1));
    const result: CategoryScrapeResult = { category, discoveredProductUrls: products.length, products, failures: [] };
    await writeOutputs(join(root, "storage", "scraped", "gam"), "lote", [result], "2026-10-21T12:00:00Z", "2026-10-21T12:00:00Z");
    await run(root, source);
  } finally { await rm(root, { recursive: true, force: true }); }
};

const save = async (root: string, source: string, id: string, compare: string | null = null) => {
  const out = join(root, "storage", "prepared", "gam", `lote-${id}-preparation.json`);
  const result = await prepareSavedCatalogWithRetention({ providerId: "gam", source, out, compare, dryRun: false });
  return { out, result };
};

const dateVersion = async (path: string, date: string): Promise<void> => {
  const data: unknown = JSON.parse(await readFile(path, "utf8"));
  if (typeof data !== "object" || data === null) throw new Error("Preparación inválida");
  const raw = JSON.stringify({ ...data, preparedAt: date }, null, 2);
  await writeFile(path, raw);
  const manifestPath = path.replace(/-preparation\.json$/, "-preparation.manifest.json");
  const manifest: unknown = JSON.parse(await readFile(manifestPath, "utf8"));
  if (typeof manifest !== "object" || manifest === null) throw new Error("Manifest inválido");
  await writeFile(manifestPath, JSON.stringify({ ...manifest, preparationSha256: createHash("sha256").update(raw).digest("hex") }, null, 2));
};

test("la tercera preparación válida rota automáticamente el conjunto más antiguo", async () => {
  await withWorkspace(async (root, source) => {
    const first = await save(root, source, "a");
    await dateVersion(first.out, "2026-10-21T12:00:00Z");
    const second = await save(root, source, "b");
    await dateVersion(second.out, "2026-10-22T12:00:00Z");
    const third = await save(root, source, "c");
    assert.equal(third.result.retention?.deletedVersions, 1);
    assert.equal(third.result.retention?.deletedFiles, 3);
    await assert.rejects(lstat(first.out), { code: "ENOENT" });
    assert.equal((await lstat(second.out)).isFile(), true);
    assert.equal((await lstat(third.out)).isFile(), true);
  });
});

test("una acreditación con SHA protege una preparación incluso por encima de dos", async () => {
  await withWorkspace(async (root, source) => {
    const first = await save(root, source, "a");
    await dateVersion(first.out, "2026-10-21T12:00:00Z");
    const hash = createHash("sha256").update(await readFile(first.out)).digest("hex");
    const folder = join(root, "catalogs", "providers", "gam", "publications");
    await mkdir(folder, { recursive: true });
    await writeFile(join(folder, "active.json"), JSON.stringify({ preparationSha256: hash }));
    const second = await save(root, source, "b");
    await dateVersion(second.out, "2026-10-22T12:00:00Z");
    const third = await save(root, source, "c");
    assert.equal(third.result.retention?.deletedVersions, 0);
    assert.equal(third.result.retention?.protectedVersions, 1);
    assert.equal((await lstat(first.out)).isFile(), true);
    assert.equal((await lstat(second.out)).isFile(), true);
    assert.equal((await lstat(third.out)).isFile(), true);
  });
});

test("un bloqueo concurrente impide escribir una nueva preparación", async () => {
  await withWorkspace(async (root, source) => {
    const parent = join(root, "storage", "prepared");
    await mkdir(join(parent, "gam"), { recursive: true });
    const lock = join(parent, ".retention-gam.lock");
    await writeFile(lock, "otro proceso");
    const path = join(parent, "gam", "lote-locked-preparation.json");
    await assert.rejects(
      prepareSavedCatalogWithRetention({ providerId: "gam", source, out: path, compare: null, dryRun: false }),
      { code: "EEXIST" }
    );
    await assert.rejects(lstat(path), { code: "ENOENT" });
  });
});

test("simular una preparación nunca activa la rotación", async () => {
  await withWorkspace(async (root, source) => {
    const first = await save(root, source, "a");
    const dry = await prepareSavedCatalogWithRetention({
      providerId: "gam", source, out: join(root, "storage", "prepared", "gam", "lote-b-preparation.json"),
      compare: null, dryRun: true
    });
    assert.equal(dry.retention, null);
    assert.equal((await lstat(first.out)).isFile(), true);
  });
});
