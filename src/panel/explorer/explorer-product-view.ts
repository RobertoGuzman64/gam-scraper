import type { ProductTechnicalProvenance } from "../../contracts/technical-provenance.js";
import type { ProductRecord } from "../../contracts/catalog.js";
import type { ImportCandidate } from "../../commercial/legacy-export/contracts.js";
import type { CommercialDeliveryProduct } from "../../commercial/export/commercial-export.js";
import { resolvePanelFieldProvenance } from "./field-provenance.js";
import { classifyPublishedTechnicalAdditions } from "../../preparation/technical-spec-classification.js";
import { compareOriginalToPublished, comparePublishedToCommercial, compareTechnicalFields } from "./field-differences.js";
import { productIdentity } from "./explorer-identity.js";
import type { PanelProviderEvidence, PanelProviderId } from "../evidence/types.js";
import type { PanelUnitKnowledgeEvidence } from "../evidence/knowledge-evidence.js";
import type { PanelExplorerProduct, PanelProductDecision, PanelProductView, PanelCommercialView } from "./types.js";

const fromOriginal = (item: ProductRecord): PanelProductView => ({
  title: item.title, shortDescription: item.shortDescription,
  generalDescription: item.longDescription, category: item.categoryName,
  price: item.price, image: item.image, images: item.images ?? [], specs: item.specs ?? {}
});
const fromPublication = (item: ImportCandidate): PanelProductView => ({
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
  knowledge: PanelUnitKnowledgeEvidence | null,
  emitted: ProductTechnicalProvenance | null = null
): PanelExplorerProduct => {
  const before = original ? fromOriginal(original) : null;
  const after = published ? fromPublication(published) : null;
  const exported = commercial ? fromCommercial(commercial) : null;
  const changes = before && after ? compareOriginalToPublished(before, after) : [];
  if (emitted && emitted.entries.some((entry) => !changes.some((difference) =>
    difference.group === "technical" && difference.change === "added" &&
    difference.field === entry.field && difference.after === entry.value))) {
    throw new Error("Evidencia productiva incompatible con especificaciones publicadas");
  }
  const provenance = resolvePanelFieldProvenance(original, after, changes, evidence, knowledge, reference, sourceUrl, emitted);
  return {
    identity: productIdentity(providerId, reference, sourceUrl), providerId, reference, sourceUrl,
    stage: !published ? "editorial-excluded" : !commercial ? "commercial-excluded" : "commercial",
    category: exported?.categorySellID === null ? "Sin categoría comercial" :
      exported?.category ?? after?.category ?? before?.category ?? null,
    original: before, published: after, commercial: exported,
    changes,
    specAdditions: classifyPublishedTechnicalAdditions(original, emitted, providerId, reference, sourceUrl,
      evidence.original.status === "verified", changes.filter((difference) =>
        difference.group === "technical" && difference.change === "added").map((difference) =>
        ({ field: difference.field, value: difference.after ?? "" }))),
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
