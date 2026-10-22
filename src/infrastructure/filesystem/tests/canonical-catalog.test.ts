import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import type { ProductRecord } from "../../../contracts/catalog.js";
import type { CategoryConfig, CategoryScrapeResult } from "../../../contracts/scraping.js";
import { writeOutputs } from "../../../pipeline/publication/publish.js";
import { readCanonicalCatalog } from "../canonical-catalog.js";

const category: CategoryConfig = { key: "venta", name: "Venta", url: "https://test.example/venta" };
const stamp = (day: number): string => `2026-10-${String(day).padStart(2, "0")}T10:00:00Z`;

const product = (reference: string, price: string | null): ProductRecord => ({
  providerId: "proveedor-prueba", categoryKey: category.key, categoryName: category.name,
  url: `https://test.example/${reference}`, title: `Máquina ${reference}`,
  shortDescription: null, longDescription: "Técnica demostrada", price, reference,
  brand: null, model: null, year: null, location: null, country: null, horometer: null,
  serialNumber: null, image: null, images: ["https://test.example/a.jpg", "https://test.example/b.jpg"],
  condition: null, breadcrumbs: ["Catálogo", "Maquinaria"], specs: { Altura: "2 m", Activa: true, Valores: [2, false, "3"] }
});

const result = (price: string | null, failures: CategoryScrapeResult["failures"] = []): CategoryScrapeResult => ({
  category,
  products: Array.from({ length: 12 }, (_, index) => product(`REF-${index + 1}`, price)),
  discoveredProductUrls: 12,
  failures
});

const withDir = async (callback: (dir: string) => Promise<void>): Promise<void> => {
  const dir = await mkdtemp(join(tmpdir(), "canonico-equipzilla-"));
  try { await callback(dir); } finally { await rm(dir, { recursive: true, force: true }); }
};

const paths = (dir: string) => ({
  canonical: join(dir, "inventario-catalog.json"),
  manifest: join(dir, "inventario-catalog.manifest.json"),
  summary: join(dir, "inventario-summary.json")
});

test("publica ProductRecord canónico íntegro y permite relectura offline sin importador", async () => {
  await withDir(async (dir) => {
    await writeOutputs(dir, "inventario", [result(null)], stamp(1), stamp(1));
    const source = await readCanonicalCatalog(paths(dir).canonical);
    assert.equal(source.version, 1);
    assert.equal(source.quality.published, true);
    assert.equal(source.productCount, 12);
    assert.deepEqual(source.products, result(null).products);
    assert.equal(source.products[0]?.price, null);
    assert.deepEqual(source.products[0]?.specs?.Valores, [2, false, "3"]);
    const text = await readFile(paths(dir).canonical, "utf8");
    const summary: unknown = JSON.parse(await readFile(paths(dir).summary, "utf8"));
    assert.ok(summary && typeof summary === "object" && "artifacts" in summary);
    assert.ok(summary.artifacts && typeof summary.artifacts === "object" && "catalogSha256" in summary.artifacts);
    assert.equal(summary.artifacts.catalogSha256, createHash("sha256").update(text).digest("hex"));
  });
});

test("rechaza truncamiento, manifest manipulado y mezclas entre ejecuciones", async () => {
  await withDir(async (dir) => {
    await writeOutputs(dir, "inventario", [result("1000 €")], stamp(1), stamp(1));
    const { canonical, manifest, summary } = paths(dir);
    const raw = await readFile(canonical, "utf8");
    const rawManifest = await readFile(manifest, "utf8");
    await writeFile(canonical, raw.slice(0, 150));
    await assert.rejects(readCanonicalCatalog(canonical));
    await writeFile(canonical, raw);
    const wrong: unknown = JSON.parse(rawManifest);
    assert.ok(wrong && typeof wrong === "object" && "catalogSha256" in wrong);
    wrong.catalogSha256 = "f".repeat(64);
    await writeFile(manifest, JSON.stringify(wrong));
    await assert.rejects(readCanonicalCatalog(canonical), /ejecuciones distintas/);
    await writeFile(manifest, rawManifest);
    const active = join(dir, ".history", "inventario", "active.json");
    const activeContent = await readFile(active, "utf8");
    await writeFile(active, JSON.stringify({ version: 1, summary: { quality: { status: "complete", published: true }, artifacts: { catalogSha256: "0".repeat(64) } } }));
    await assert.rejects(readCanonicalCatalog(canonical), /publicación completa/);
    await writeFile(active, activeContent);
    assert.equal((await readCanonicalCatalog(canonical)).productCount, 12);
    assert.ok((await readFile(summary, "utf8")).includes("catalogSha256"));
  });
});

test("una extracción parcial no modifica el catálogo canónico publicado", async () => {
  await withDir(async (dir) => {
    await writeOutputs(dir, "inventario", [result("1000 €")], stamp(1), stamp(1));
    const before = await readFile(paths(dir).canonical, "utf8");
    await assert.rejects(writeOutputs(dir, "inventario", [result(null, [{ url: "https://test.example/error", error: "HTTP 503" }])], stamp(2), stamp(2)), /Extracción partial/);
    assert.equal(await readFile(paths(dir).canonical, "utf8"), before);
    assert.equal((await readCanonicalCatalog(paths(dir).canonical)).productCount, 12);
  });
});

test("el historial versiona catálogos completos y permite relectura histórica", async () => {
  await withDir(async (dir) => {
    for (let day = 1; day <= 4; day += 1) {
      await writeOutputs(dir, "inventario", [result(`${day}000 €`)], stamp(day), stamp(day));
    }
    const historyRoot = join(dir, ".history", "inventario");
    const archives = (await readdir(historyRoot)).filter((name) => name.startsWith("archive-")).sort();
    assert.equal(archives.length, 2);
    const archived = join(historyRoot, archives[0]!, "inventario-catalog.json");
    const previous = await readCanonicalCatalog(archived);
    assert.equal(previous.products[0]?.price, "2000 €");
    assert.equal((await readCanonicalCatalog(paths(dir).canonical)).products[0]?.price, "4000 €");
  });
});

test("un archivo canónico no puede ocultar productos ni duplicar identidades con hash actualizado", async () => {
  await withDir(async (dir) => {
    await writeOutputs(dir, "inventario", [result("1000 €")], stamp(1), stamp(1));
    const { canonical, manifest } = paths(dir);
    const parsed: unknown = JSON.parse(await readFile(canonical, "utf8"));
    assert.ok(parsed && typeof parsed === "object" && "products" in parsed && Array.isArray(parsed.products));
    parsed.products[1] = parsed.products[0];
    const raw = JSON.stringify(parsed, null, 2);
    await writeFile(canonical, raw);
    const metadata: unknown = JSON.parse(await readFile(manifest, "utf8"));
    assert.ok(metadata && typeof metadata === "object" && "catalogSha256" in metadata);
    metadata.catalogSha256 = createHash("sha256").update(raw).digest("hex");
    await writeFile(manifest, JSON.stringify(metadata));
    await assert.rejects(readCanonicalCatalog(canonical), /Identidad duplicada/);
  });
});

test("si falla la publicación nueva, restaura el catálogo, CSV y metadatos previos", async () => {
  await withDir(async (dir) => {
    await writeOutputs(dir, "inventario", [result("1000 €")], stamp(1), stamp(1));
    const beforeCatalog = await readFile(paths(dir).canonical, "utf8");
    const beforeCsv = await readFile(join(dir, "inventario-all.csv"), "utf8");
    const beforeSummary = await readFile(paths(dir).summary, "utf8");
    await assert.rejects(writeOutputs(dir, "inventario", [result("2000 €")], "fecha-invalida", stamp(2)), /contrato inválido/);
    assert.equal(await readFile(paths(dir).canonical, "utf8"), beforeCatalog);
    assert.equal(await readFile(join(dir, "inventario-all.csv"), "utf8"), beforeCsv);
    assert.equal(await readFile(paths(dir).summary, "utf8"), beforeSummary);
    assert.equal((await readCanonicalCatalog(paths(dir).canonical)).products[0]?.price, "1000 €");
  });
});

test("migra una publicación histórica sin archivo canónico sin inventar contenido", async () => {
  await withDir(async (dir) => {
    await writeOutputs(dir, "inventario", [result("1000 €")], stamp(1), stamp(1));
    const activePath = join(dir, ".history", "inventario", "active.json");
    const active: unknown = JSON.parse(await readFile(activePath, "utf8"));
    assert.ok(active && typeof active === "object" && "summary" in active &&
      active.summary && typeof active.summary === "object" && "artifacts" in active.summary &&
      active.summary.artifacts && typeof active.summary.artifacts === "object");
    Reflect.deleteProperty(active.summary.artifacts, "catalogSha256");
    await writeFile(activePath, JSON.stringify(active));
    await writeFile(paths(dir).summary, JSON.stringify(active.summary));
    await rm(paths(dir).canonical);
    await rm(paths(dir).manifest);
    await writeOutputs(dir, "inventario", [result("2000 €")], stamp(2), stamp(2));
    const history = join(dir, ".history", "inventario");
    const archive = (await readdir(history)).find((name) => name.startsWith("archive-"));
    assert.ok(archive);
    const names = await readdir(join(history, archive));
    assert.ok(!names.includes("inventario-catalog.json"));
    assert.ok(names.includes("inventario-all.csv"));
    assert.equal((await readCanonicalCatalog(paths(dir).canonical)).products[0]?.price, "2000 €");
  });
});
