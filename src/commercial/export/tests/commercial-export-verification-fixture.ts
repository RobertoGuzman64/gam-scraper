import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { buildCommercialDeliveryPlan, type CommercialExportFile } from "../commercial-export.js";
import type { CommercialExportPlan } from "../../projection/export-projection.js";
import { createZipArchive } from "../../../infrastructure/archive/zip.js";

export const createFile = (name: string, content: string): CommercialExportFile => ({
  name, content, sha256: createHash("sha256").update(content).digest("hex"), bytes: Buffer.byteLength(content)
});

export const emptyPlan = (): CommercialExportPlan => ({
  version: 1, providerId: "gam", publicationSha256: "a".repeat(64), environment: null, total: 0,
  products: [], excluded: [], exceptions: [], summary: {
    exported: 0, categorized: 0, pendingCategory: 0, excludedLots: 0, excludedTools: 0,
    excludedAccessories: 0, attributes: 0, withLogo: 0, withPrice: 0, withCompany: 0
  }
});

export const filesForProvider = (plan: CommercialExportPlan = emptyPlan()): CommercialExportFile[] => {
  const product = createFile(`${plan.providerId}-commercial.json`, `${JSON.stringify(buildCommercialDeliveryPlan(plan))}\n`);
  const manifest = {
    version: 2, environment: null, taxonomySha256: "b".repeat(64), attributesSha256: "c".repeat(64),
    logosSha256: "d".repeat(64), companiesSha256: "e".repeat(64),
    providers: [{ providerId: plan.providerId, publicationSha256: plan.publicationSha256, originalCount: plan.total,
      ...plan.summary, excluded: plan.excluded.length, exceptions: plan.exceptions.length,
      file: product.name, sha256: product.sha256, bytes: product.bytes }]
  };
  return [product, createFile("commercial-manifest.json", `${JSON.stringify(manifest)}\n`)];
};

export const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value);

export const withManifest = (files: readonly CommercialExportFile[], change: (manifest: Record<string, unknown>) => void): CommercialExportFile[] =>
  files.map((entry) => {
    if (entry.name !== "commercial-manifest.json") return entry;
    const manifest: unknown = JSON.parse(entry.content);
    assert.ok(isRecord(manifest));
    change(manifest);
    return createFile(entry.name, `${JSON.stringify(manifest, null, 2)}\n`);
  });

export const planWithProduct = (): CommercialExportPlan => ({
  ...emptyPlan(), total: 1,
  products: [{
    providerId: "gam", sourceUrl: "https://example.com/product", reference: "product-1",
    title: "Producto de prueba", categorySellID: 16, category: "Carretillas",
    condition: "Segunda_Mano", price: 50, description_title: "Producto de prueba",
    description: "Ficha de prueba", description_general: "Descripción de prueba",
    image: null, images: [], spec: {}, attributes: [{ attributeID: 1, value: 42 }],
    logoID: 5, metadata: { tags: [], keywords: [], featured: false }
  }],
  summary: {
    exported: 1, categorized: 1, pendingCategory: 0, excludedLots: 0, excludedTools: 0,
    excludedAccessories: 0, attributes: 1, withLogo: 1, withPrice: 1, withCompany: 0
  }
});

export const packCommercial = (files: readonly CommercialExportFile[]): Buffer => createZipArchive(files.map((file) => ({
  name: file.name, data: file.content
})));
