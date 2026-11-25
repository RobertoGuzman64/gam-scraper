import type { ProductRecord } from "../../../contracts/catalog.js";
import type { DocumentedTechnicalSource, TechnicalDocumentReference } from "../../../contracts/technical-provenance.js";
import { originalRecordFingerprint } from "../../../catalog/identity-fingerprint.js";

type ReviewedCatalogModelIdentity = {
  readonly providerId: string;
  readonly reference: string;
  readonly fingerprint: string;
  readonly title: string;
  readonly descriptionEvidence: string;
  readonly unitReference?: string;
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
  },
  {
    providerId: "gam", reference: "6971",
    fingerprint: "5b3c6e61fc07e2819be18ed54a8c2ea971023df1995f94b7fb500fc553788091",
    title: "Lote 11", descriptionEvidence: "Adquiere este lote completo",
    unitReference: "GAM-01397",
    sourceUrl: "https://machineryline.es/-/venta/carretillas-electricas/UniCarriers/1Q2L25Q--25090213332743096600",
    brand: "UniCarriers", model: "1Q2L25Q"
  },
  {
    providerId: "gam", reference: "6987",
    fingerprint: "ef382bc316af50de1e22c8f6c45cc8a37b076fa98bea9dacfc3c38f70ad24cf8",
    title: "Lote 12", descriptionEvidence: "Adquiere este lote completo",
    unitReference: "GAM-19513",
    sourceUrl: "https://online.gamrentals.com/en/electric-pallets/5827-2017-yale-mp20",
    brand: "YALE", model: "MP20"
  },
  {
    providerId: "gam", reference: "6994",
    fingerprint: "2e95a90ba65f7758c108376b121e9ec352297ac3ed884072ed9459e886f37e8d",
    title: "Lote 17", descriptionEvidence: "Adquiere este lote completo",
    sourceUrl: "https://online.gamrentals.com/fichas-tecnicas/es/MP18.pdf",
    brand: "Yale", model: "MP16"
  }
];

export const reviewedCatalogModelIdentity = (
  record: ProductRecord, sourceUrl: string
): TechnicalDocumentReference | null => {
  if (record.brand !== null || record.model !== null || !record.longDescription) return null;
  const matches = identities.filter((entry) => entry.providerId === record.providerId &&
    entry.reference === record.reference && entry.sourceUrl === sourceUrl &&
    entry.title === record.title && record.longDescription?.includes(entry.descriptionEvidence) &&
    (entry.unitReference === undefined || entry.unitReference === record.externalReference) &&
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
