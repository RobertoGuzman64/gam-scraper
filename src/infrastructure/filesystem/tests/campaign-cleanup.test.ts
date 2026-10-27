import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, readdir, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import type { ProductRecord } from "../../../contracts/catalog.js";
import type { CategoryConfig, CategoryScrapeResult } from "../../../contracts/scraping.js";
import { writeOutputs } from "../../../pipeline/publication/publish.js";
import { inspectCleanupArea } from "../campaign-cleanup.js";

const category: CategoryConfig = { key: "maquinaria", name: "Maquinaria", url: "https://example.test/maquinaria" };
const prefixes = new Map([
  ["gam", "scrape-gam"], ["gomariz", "scrape-gomariz"], ["mercaeleva", "scrape-mercaeleva"], ["manain", "scrape-manain"]
]);

const products = (providerId: string, date: string): CategoryScrapeResult => ({
  category, discoveredProductUrls: 12, failures: [],
  products: Array.from({ length: 12 }, (_, index): ProductRecord => ({
    providerId, categoryKey: category.key, categoryName: category.name,
    url: `https://example.test/${providerId}/${index}`,
    title: `Máquina ${index}`, shortDescription: null, longDescription: null,
    price: `${date} €`, reference: `${providerId}-${index}`, brand: null, model: null,
    year: null, location: null, country: null, horometer: null, serialNumber: null,
    image: null, specs: {}
  }))
});

const fixture = async (callback: (root: string, scraped: string, outside: string) => Promise<void>): Promise<void> => {
  const root = await mkdtemp(join(tmpdir(), "equipzilla-cleanup-inventory-"));
  const scraped = join(root, "storage", "scraped", "campaigns", "lote");
  const outside = join(root, "externo.txt");
  try {
    await writeFile(outside, "no borrar");
    for (const [providerId, prefix] of prefixes) {
      const path = join(scraped, providerId);
      await mkdir(path, { recursive: true });
      await writeOutputs(path, prefix, [products(providerId, "1000")], "2026-10-22T10:00:00Z", "2026-10-22T10:01:00Z");
      await writeOutputs(path, prefix, [products(providerId, "2000")], "2026-10-23T10:00:00Z", "2026-10-23T10:01:00Z");
    }
    await callback(root, scraped, outside);
  } finally { await rm(root, { recursive: true, force: true }); }
};

test("inventa y cuantifica CSV, snapshots e historiales que genera la publicación real", async () => {
  await fixture(async (root, scraped) => {
    const inventory = await inspectCleanupArea(root, scraped, "scraped", prefixes);
    assert.ok(inventory);
    assert.ok(inventory.bytes > 0);
    assert.ok(inventory.files > 0);
    assert.ok(inventory.breakdown.some(({ kind, files }) => kind === "csv" && files >= 8));
    assert.ok(inventory.breakdown.some(({ kind, files }) => kind === "snapshot" && files === 4));
    assert.ok(inventory.breakdown.some(({ kind, files }) => kind === "history" && files > 4));
    assert.deepEqual(await readdir(join(scraped, "gam", ".history")), ["scrape-gam"]);
  });
});

test("no admite archivos ajenos ni snapshots de otro prefijo y enumera todos los rechazos", async () => {
  await fixture(async (root, scraped, outside) => {
    const gam = join(scraped, "gam");
    await writeFile(join(gam, "factura.csv"), "privado");
    await writeFile(join(gam, "scrape-gam-notas.csv"), "notas particulares");
    await writeFile(join(gam, "otro-snapshot-de-prueba.json"), "{}");
    await writeFile(join(scraped, "gomariz", "documento-personal.txt"), "datos");
    await assert.rejects(inspectCleanupArea(root, scraped, "scraped", prefixes), (error: unknown) => {
      assert.ok(error instanceof Error);
      assert.match(error.message, /factura\.csv/);
      assert.match(error.message, /scrape-gam-notas\.csv/);
      assert.match(error.message, /otro-snapshot-de-prueba\.json/);
      assert.match(error.message, /documento-personal\.txt/);
      return true;
    });
    assert.equal(await readFile(outside, "utf8"), "no borrar");
  });
});

test("rechaza enlaces simbólicos y manifiestos históricos incompatibles", async () => {
  await fixture(async (root, scraped, outside) => {
    const gam = join(scraped, "gam");
    await symlink(outside, join(gam, "scrape-gam-falso.csv"));
    const history = join(gam, ".history", "scrape-gam");
    const archiveName = (await readdir(history)).find((name) => name.startsWith("archive-"));
    assert.ok(archiveName);
    const manifest = join(history, archiveName, "manifest.json");
    const original: unknown = JSON.parse(await readFile(manifest, "utf8"));
    assert.ok(original && typeof original === "object");
    await writeFile(manifest, JSON.stringify({ ...original, prefix: "otro-prefijo" }));
    await assert.rejects(inspectCleanupArea(root, scraped, "scraped", prefixes), /no reconocido|histórico inválido/i);
    assert.equal(await readFile(outside, "utf8"), "no borrar");
  });
});
