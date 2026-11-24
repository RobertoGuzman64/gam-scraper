import type { ImportCandidate } from "../../commercial/legacy-export/contracts.js";
import type { OfflinePreparation } from "../documents/offline-document.js";
import type { PublishedTechnicalProvenance, PublicationTechnicalProvenance } from "../../contracts/technical-provenance.js";
export { isPublicationTechnicalProvenance } from "../../contracts/technical-provenance.js";

const identity = (reference: string | null, sourceUrl: string): string =>
  JSON.stringify([reference, sourceUrl]);

export const buildPublicationTechnicalProvenance = (
  providerId: string, preparationSha256: string, selection: readonly ImportCandidate[],
  preparation: OfflinePreparation
): PublicationTechnicalProvenance | null => {
  const prepared = new Map(preparation.products.map((item) =>
    [identity(item.product.reference, item.product.sourceUrl), item] as const));
  if (prepared.size !== preparation.products.length) throw new Error("Preparaciones con identidad técnica duplicada");
  const products: PublishedTechnicalProvenance[] = [];
  let legacy = false;
  for (const product of selection) {
    const item = prepared.get(identity(product.reference, product.sourceUrl));
    if (!item || item.product.providerId !== providerId || product.providerId !== providerId) {
      throw new Error("Falta producto preparado para la selección publicada");
    }
    if (!item.technicalProvenance) {
      legacy = true;
      continue;
    }
    products.push({ reference: product.reference, sourceUrl: product.sourceUrl,
      technicalProvenance: item.technicalProvenance });
  }
  if (legacy) return null;
  return { version: 1, providerId, preparationSha256, products };
};
