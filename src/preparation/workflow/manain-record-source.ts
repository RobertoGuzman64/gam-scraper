import type { VerifiedManainRecordSource } from "../../infrastructure/filesystem/catalog/manain-record-source.js";
import type { PreparationSource } from "../offline-document.js";

export const manainRecordPreparationSource = (verified: VerifiedManainRecordSource): PreparationSource => {
  const source = verified.snapshot.source;
  if (source.kind !== "manain-record") throw new Error("Procedencia técnica de Manain incompatible");
  return {
    providerId: "manain", prefix: "manain-record", scope: verified.recordSha256.slice(0, 16),
    catalogSha256: verified.recordSha256, productCount: verified.originalProducts.length,
    record: {
      quality: "partial", technicalSha256: verified.technicalSha256,
      sourceCsvSha256: source.sourceCsvSha256,
      discoveredProductUrls: source.discoveredProductUrls,
      discardedUrls: source.discardedUrls
    }
  };
};
