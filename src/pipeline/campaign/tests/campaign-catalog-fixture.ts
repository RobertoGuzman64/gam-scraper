import { copyFile, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { readCanonicalCatalog, writeCanonicalCatalog } from "../../../infrastructure/filesystem/canonical-catalog.js";
import type { CanonicalCatalog } from "../../../catalog/canonical-catalog.js";

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

export const copyCampaignTestCatalog = async (
  fixtures: string, destination: string, providerId: string, prefix: string
): Promise<CanonicalCatalog> => {
  const original = join(fixtures, providerId, `${prefix}-catalog.json`);
  const target = join(destination, `${prefix}-catalog.json`);
  if (providerId !== "gam") {
    for (const suffix of ["-catalog.json", "-catalog.manifest.json", "-summary.json"]) {
      await copyFile(join(fixtures, providerId, `${prefix}${suffix}`), join(destination, `${prefix}${suffix}`));
    }
    return readCanonicalCatalog(target);
  }
  const catalog = await readCanonicalCatalog(original);
  const products = catalog.products.slice(0, 16);
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
