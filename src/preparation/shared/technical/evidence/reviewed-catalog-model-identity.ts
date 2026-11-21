import type { ProductRecord } from "../../../../contracts/catalog.js";
import type { DocumentedTechnicalSource, TechnicalDocumentReference } from "../../../../contracts/technical-provenance.js";
import { originalRecordFingerprint } from "../../../../catalog/identity-fingerprint.js";

type ReviewedCatalogModelIdentity = {
  readonly providerId: string;
  readonly reference: string;
  readonly fingerprint: string;
  readonly title: string;
  readonly descriptionEvidence: string;
  readonly sourceUrl: string;
  readonly brand: string;
  readonly model: string;
};

const identities: readonly ReviewedCatalogModelIdentity[] = [
  {
    providerId: "gam", reference: "6805",
    fingerprint: "fbe2471c664bd812cede8e0d4b36416b99468c008563582374f5d1e7b5fdcf73",
    title: "LVNENG LX05", descriptionEvidence: "La LVNENG LX05 es un ciclomotor eléctrico",
    sourceUrl: "https://www.lvnengebike.com/LX05.html", brand: "LVNENG", model: "LX05"
  },
  {
    providerId: "gam", reference: "6189",
    fingerprint: "1eab90d7e679168098a68db669d215409b3c30f6828699ad61edfee5a24874a1",
    title: "PLATAFORMA SOBRE CAMIÓN ELÉCTRICA 20M CTE MP 24 C FIB",
    descriptionEvidence: "La plataforma sobre camión telescópico CTE MP 24 C",
    sourceUrl: "https://ctelift.com/nuovi-prodotti-cte-2021/", brand: "CTE", model: "MP 24 C"
  },
  {
    providerId: "gam", reference: "6190",
    fingerprint: "95289b9ce12ab843eeabfe7b18aa9a9bf65be0e6b9bceb27b4e72147aa3ccbc3",
    title: "PLATAFORMA SOBRE CAMIÓN TELESCÓPICO CTE B-LIFT 27.2 FIB",
    descriptionEvidence: "La plataforma sobre camión telescópico CTE B-LIFT 27.2 FIB",
    sourceUrl: "https://www.ctelift.com/wp-content/uploads/2020/11/B-LIFT-27.2_2021-05_EN.pdf",
    brand: "CTE", model: "B-LIFT 27.2"
  }
];

export const reviewedCatalogModelIdentity = (
  record: ProductRecord, sourceUrl: string
): TechnicalDocumentReference | null => {
  if (record.brand !== null || record.model !== null || !record.longDescription) return null;
  const matches = identities.filter((entry) => entry.providerId === record.providerId &&
    entry.reference === record.reference && entry.sourceUrl === sourceUrl &&
    entry.title === record.title && record.longDescription?.includes(entry.descriptionEvidence) &&
    entry.fingerprint === originalRecordFingerprint(record));
  if (matches.length !== 1) return null;
  const matched = matches[0]!;
  return { url: sourceUrl, brand: matched.brand, model: matched.model };
};

export const matchesReviewedCatalogModelIdentity = (
  original: ProductRecord, document: TechnicalDocumentReference
): boolean => {
  const identity = reviewedCatalogModelIdentity(original, document.url);
  return identity !== null && identity.brand === document.brand && identity.model === document.model;
};

export const matchesDocumentedTechnicalIdentity = (
  original: ProductRecord, source: DocumentedTechnicalSource
): boolean => original.brand === source.document.brand && original.model === source.document.model ||
  source.scope === "document-reference" && matchesReviewedCatalogModelIdentity(original, source.document);
