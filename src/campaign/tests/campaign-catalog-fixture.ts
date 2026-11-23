import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { readCanonicalCatalog, writeCanonicalCatalog } from "../../infrastructure/filesystem/catalog/canonical-catalog.js";
import type { CanonicalCatalog } from "../../catalog/canonical-catalog.js";
import type { ProductRecord } from "../../contracts/catalog.js";

export const copyCampaignTestCatalog = async (
  destination: string, providerId: string, prefix: string
): Promise<CanonicalCatalog> => {
  const startedAt = "2026-10-22T08:46:28.582Z";
  const endedAt = "2026-10-22T08:52:45.412Z";
  const count = providerId === "manain" ? 1 : 4;
  const products: ProductRecord[] = Array.from({ length: count }, (_, index) => ({
    providerId,
    categoryKey: "plataformas-elevadoras",
    categoryName: "Plataformas elevadoras",
    url: `https://example.test/${providerId}/producto-${index + 1}`,
    reference: `${providerId.toUpperCase()}-${index + 1}`,
    title: "Plataforma elevadora",
    brand: "JLG",
    model: "Plataforma",
    shortDescription: "Plataforma elevadora",
    longDescription: "Plataforma elevadora para trabajos en altura",
    price: null,
    year: null,
    location: null,
    country: null,
    horometer: null,
    serialNumber: null,
    image: null
  }));
  const catalogSha256 = await writeCanonicalCatalog(
    destination, prefix, "a".repeat(16), startedAt, endedAt, products
  );
  await writeFile(join(destination, `${prefix}-summary.json`), JSON.stringify({
    startedAt, endedAt, quality: { status: "complete", published: true },
    totals: { scrapedProducts: products.length }, artifacts: { catalogSha256 }
  }));
  return readCanonicalCatalog(join(destination, `${prefix}-catalog.json`));
};


export { reuseWorkspaceTestFixture as reuseCampaignTestFixture } from "../../testing/builders/reusable-workspace-fixture.js";
