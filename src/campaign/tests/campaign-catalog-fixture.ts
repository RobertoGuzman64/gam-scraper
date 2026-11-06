import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { readCanonicalCatalog, writeCanonicalCatalog } from "../../infrastructure/filesystem/catalog/canonical-catalog.js";
import type { CanonicalCatalog } from "../../catalog/canonical-catalog.js";
import type { ProductRecord } from "../../contracts/catalog.js";

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

export const copyCampaignTestCatalog = async (
  fixtures: string, destination: string, providerId: string, prefix: string
): Promise<CanonicalCatalog> => {
  if (providerId === "manain") {
    const startedAt = "2026-10-22T08:46:28.582Z";
    const endedAt = "2026-10-22T08:52:45.412Z";
    const product: ProductRecord = {
      providerId, categoryKey: "venta", categoryName: "Maquinaria en venta",
      url: "https://manain.com/producto/venda-elevacio-tisores-jlg-530lrt/",
      reference: "MA3904", title: "JLG 530LRT", brand: "JLG", model: "530LRT",
      shortDescription: null, longDescription: null, price: null,
      year: null, location: null, country: null, horometer: null,
      serialNumber: null, image: null
    };
    const catalogSha256 = await writeCanonicalCatalog(destination, prefix, "a".repeat(16), startedAt, endedAt, [product]);
    await writeFile(join(destination, `${prefix}-summary.json`), JSON.stringify({
      startedAt, endedAt, quality: { status: "complete", published: true },
      totals: { scrapedProducts: 1 }, artifacts: { catalogSha256 }
    }));
    return readCanonicalCatalog(join(destination, `${prefix}-catalog.json`));
  }
  const original = join(fixtures, providerId, `${prefix}-catalog.json`);
  const target = join(destination, `${prefix}-catalog.json`);
  const catalog = await readCanonicalCatalog(original);
  const products = catalog.products.slice(0, 4);
  const catalogSha256 = await writeCanonicalCatalog(
    destination, prefix, catalog.scope, catalog.startedAt, catalog.endedAt, products
  );
  const input: unknown = JSON.parse(await readFile(join(fixtures, providerId, `${prefix}-summary.json`), "utf8"));
  if (!isRecord(input) || !isRecord(input.totals) || !isRecord(input.artifacts)) {
    throw new Error("El resumen del catálogo de prueba no tiene el contrato esperado");
  }
  await writeFile(join(destination, `${prefix}-summary.json`), JSON.stringify({
    ...input,
    totals: { ...input.totals, scrapedProducts: products.length },
    artifacts: { ...input.artifacts, catalogSha256 }
  }, null, 2));
  return readCanonicalCatalog(target);
};


export { reuseWorkspaceTestFixture as reuseCampaignTestFixture } from "../../testing/builders/reusable-workspace-fixture.js";
