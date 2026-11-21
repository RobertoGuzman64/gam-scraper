import type { ProductRecord } from "../../contracts/catalog.js";
import type { ImportCandidate } from "../../commercial/legacy-export/contracts.js";
import type { CommercialDeliveryProduct } from "../../commercial/export/commercial-export.js";
import { comparePublishedToCommercial, compareTechnicalFields } from "./field-differences.js";
import { productIdentity } from "./explorer-identity.js";
import type { PanelProviderEvidence, PanelProviderId } from "../evidence/types.js";
import type { PanelExplorerProduct, PanelProductDecision, PanelProductView, PanelCommercialView, PanelFieldProvenance, PanelSpecAddition, PanelFieldDifference } from "./types.js";

export const fromOriginal = (item: ProductRecord): PanelProductView => ({
  title: item.title, shortDescription: item.shortDescription,
  generalDescription: item.longDescription, category: item.categoryName,
  price: item.price, image: item.image, images: item.images ?? [], specs: item.specs ?? {}
});
export const fromPublication = (item: ImportCandidate): PanelProductView => ({
  title: item.title, shortDescription: item.description,
  generalDescription: item.description_general, category: item.category,
  price: item.price, image: item.image, images: item.images, specs: item.spec
});
const fromCommercial = (item: CommercialDeliveryProduct): PanelCommercialView => ({
  title: item.title, shortDescription: item.description,
  generalDescription: item.description_general, category: item.category,
  price: item.price, image: item.image, images: item.images, specs: item.spec,
  categorySellID: item.categorySellID, attributes: item.attributes
});

export const toExplorerProduct = (
  providerId: PanelProviderId, reference: string | null, sourceUrl: string, original: ProductRecord | null,
  published: ImportCandidate | null, commercial: CommercialDeliveryProduct | null, decision: PanelProductDecision | null,
  evidence: PanelProviderEvidence, accreditation: { readonly path: string; readonly sha256: string },
  changes: readonly PanelFieldDifference[], provenance: readonly PanelFieldProvenance[],
  specAdditions: readonly PanelSpecAddition[]
): PanelExplorerProduct => {
  const before = original ? fromOriginal(original) : null;
  const after = published ? fromPublication(published) : null;
  const exported = commercial ? fromCommercial(commercial) : null;
  return {
    identity: productIdentity(providerId, reference, sourceUrl), providerId, reference, sourceUrl,
    stage: !published ? "editorial-excluded" : !commercial ? "commercial-excluded" : "commercial",
    category: exported?.categorySellID === null ? "Sin categoría comercial" :
      exported?.category ?? after?.category ?? before?.category ?? null,
    original: before, published: after, commercial: exported,
    changes,
    specAdditions,
    provenance,
    commercialChanges: after && exported ? comparePublishedToCommercial(after, exported) : [],
    commercialTechnicalChanges: after && exported ? compareTechnicalFields(after.specs, exported.specs, "commercial") : [],
    decision,
    evidence: {
      original: before && evidence.original.status === "verified" ? evidence.original.artifact : null,
      publication: published ? evidence.publication : null,
      commercial: commercial ? evidence.commercial : null,
      accreditation: decision?.stage === "editorial" ? accreditation : null
    }
  };
};
