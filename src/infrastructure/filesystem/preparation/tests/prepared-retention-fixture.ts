import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import type { ProductRecord } from "../../../../contracts/catalog.js";
import type { CategoryConfig, CategoryScrapeResult } from "../../../../contracts/scraping.js";
import { writeOutputs } from "../../../../scraping/output/publish.js";
import { prepareSavedCatalog } from "../../../../preparation/workflow/prepare.js";
import { offlinePreparationManifest, offlinePreparationManifestPath } from "../offline-preparation.js";

const category: CategoryConfig = { key: "maquinas", name: "Maquinaria", url: "https://example.test/maquinas" };

const product = (id: number): ProductRecord => ({
  providerId: "gam", categoryKey: category.key, categoryName: category.name,
  url: `https://example.test/maquina/${id}`, title: `Máquina ${id}`,
  shortDescription: null, longDescription: null, price: null, reference: `GAM-${id}`,
  brand: null, model: null, year: null, location: null, country: null,
  horometer: null, serialNumber: null, image: null, condition: null, images: [], specs: {}
});

export const createPreparedRetentionFixture = () => {
  const initialize = async () => {
    const root = await mkdtemp(join(tmpdir(), "equipzilla-retention-seed-"));
    try {
      const scraped = join(root, "storage", "scraped", "gam");
      const source = join(scraped, "lote-catalog.json");
      const products = Array.from({ length: 12 }, (_, index) => product(index + 1));
      const result: CategoryScrapeResult = { category, discoveredProductUrls: products.length, products, failures: [] };
      await writeOutputs(scraped, "lote", [result], "2026-10-21T12:00:00Z", "2026-10-21T12:00:00Z");
      const path = join(root, "storage", "prepared", "gam", "lote-v1-preparation.json");
      const prepared = await prepareSavedCatalog({ providerId: "gam", source, out: path, dryRun: false, compare: null });
      return { root, preparation: prepared.preparation, diagnostics: await readFile(prepared.diagnosticsFile, "utf8") };
    } catch (error) {
      await rm(root, { recursive: true, force: true });
      throw error;
    }
  };
  let seed: Promise<Awaited<ReturnType<typeof initialize>>> | undefined;
  const base = (): Promise<Awaited<ReturnType<typeof initialize>>> => seed ??= initialize();

  const withWorkspace = async (run: (root: string, source: string) => Promise<void>): Promise<void> => {
    const root = await mkdtemp(join(tmpdir(), "equipzilla-retention-"));
    try {
      const template = await base();
      await cp(join(template.root, "storage", "scraped"), join(root, "storage", "scraped"), { recursive: true });
      await run(root, join(root, "storage", "scraped", "gam", "lote-catalog.json"));
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  };

  const saveVersion = async (root: string, source: string, index: number): Promise<string> => {
    if (source !== join(root, "storage", "scraped", "gam", "lote-catalog.json")) {
      throw new Error("La versión de retención debe pertenecer al origen de la fixture");
    }
    const template = await base();
    const path = join(root, "storage", "prepared", "gam", `lote-v${index}-preparation.json`);
    const raw = JSON.stringify({
      ...template.preparation,
      preparedAt: `2026-10-${String(index).padStart(2, "0")}T12:00:00Z`
    }, null, 2);
    await mkdir(dirname(path), { recursive: true });
    await Promise.all([
      writeFile(path, raw, { flag: "wx" }),
      writeFile(offlinePreparationManifestPath(path), offlinePreparationManifest(raw, template.preparation), { flag: "wx" }),
      writeFile(path.replace(/-preparation\.json$/, "-diagnostics.json"), template.diagnostics, { flag: "wx" })
    ]);
    return path;
  };

  const close = async (): Promise<void> => {
    if (seed) await rm((await seed).root, { recursive: true, force: true });
  };

  return { withWorkspace, saveVersion, close };
};
