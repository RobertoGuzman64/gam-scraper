import { createHash } from "node:crypto";
import { readPortableOriginalArtifacts } from "../catalog/originals/portable-original.js";
import { readVerifiedManainRecordSource } from "../catalog/originals/manain-record-source.js";
import { manainRecordPreparationSource } from "../../../preparation/workflow/manain-record-source.js";
import { loadPreparationInputs } from "./preparation-inputs.js";
import { prepareImportBatch } from "../../../preparation/product/batch-identity.js";
import type { PreparationFingerprints, PreparationSource } from "../../../preparation/documents/offline-document.js";
import type { ProductRecord } from "../../../contracts/catalog.js";

export const readEditorialAuditSource = async (workspace: string, providerId: string): Promise<{
  records: readonly ProductRecord[]; source: PreparationSource; startedAt: string | null; endedAt: string | null;
}> => {
  if (providerId === "manain") {
    const verified = await readVerifiedManainRecordSource(workspace).catch((error: unknown) => {
      if (error instanceof Error && "code" in error && error.code === "ENOENT") {
        throw new Error(`Falta registro parcial de ${providerId}: ${error.message}`, { cause: error });
      }
      throw error;
    });
    return { records: verified.originalProducts, source: manainRecordPreparationSource(verified),
      startedAt: null, endedAt: null };
  }
  const { catalog, files } = await readPortableOriginalArtifacts(workspace, providerId);
  const original = files.find((file) => file.name.endsWith("-catalog.json"));
  if (!original) throw new Error(`Original canónico ausente: ${providerId}`);
  return { records: catalog.products, source: {
    providerId: catalog.providerId, prefix: catalog.prefix, scope: catalog.scope,
    catalogSha256: createHash("sha256").update(original.content).digest("hex"),
    productCount: catalog.productCount
  }, startedAt: catalog.startedAt, endedAt: catalog.endedAt };
};

export const loadEditorialAuditPopulation = async (workspace: string, providerId: string, fingerprints: PreparationFingerprints) => {
  const { records, ...provenance } = await readEditorialAuditSource(workspace, providerId);
  const prepared = prepareImportBatch(records).products;
  if (prepared.length !== records.length || prepared.some(({ product }, index) =>
    product.providerId !== providerId || product.sourceUrl !== records[index]?.url)) {
    throw new Error(`Preparación no conciliada con el origen: ${providerId}`);
  }
  return { records, prepared, provenance: { ...provenance, fingerprints } };
};

export const editorialAuditFingerprints = async () => (await loadPreparationInputs()).fingerprints;
