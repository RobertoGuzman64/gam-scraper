import { technicalDocumentClaimSha256 } from "../../../contracts/technical-provenance.js";
import type { TechnicalDocumentReference, TechnicalDocumentVerification } from "../../../contracts/technical-provenance.js";

import type { ReviewedModelDocument, ReviewedModelFact } from "./models/types.js";
import { accessEquipmentDocuments } from "./models/access-equipment.js";
import { cleaningEquipmentDocuments } from "./models/cleaning-equipment.js";
import { constructionEquipmentDocuments } from "./models/construction-equipment.js";
import { genieDocuments } from "./models/genie.js";
import { handlingEquipmentDocuments } from "./models/handling-equipment.js";
import { haulotteDocuments } from "./models/haulotte.js";
import { hysterDocuments } from "./models/hyster.js";
import { jlgDocuments } from "./models/jlg.js";
import { lgmgDocuments } from "./models/lgmg.js";
import { logitransDocuments } from "./models/logitrans.js";
import { manitouDocuments } from "./models/manitou.js";
import { mobilityDocuments } from "./models/mobility.js";
import { modulaDocuments } from "./models/modula.js";
import { powerAndLightingDocuments } from "./models/power-and-lighting.js";
import { yaleDocuments } from "./models/yale.js";

const documents: readonly ReviewedModelDocument[] = [
  ...accessEquipmentDocuments,
  ...cleaningEquipmentDocuments,
  ...constructionEquipmentDocuments,
  ...genieDocuments,
  ...handlingEquipmentDocuments,
  ...haulotteDocuments,
  ...hysterDocuments,
  ...jlgDocuments,
  ...lgmgDocuments,
  ...logitransDocuments,
  ...manitouDocuments,
  ...mobilityDocuments,
  ...modulaDocuments,
  ...powerAndLightingDocuments,
  ...yaleDocuments,
];

const claimHash = (document: ReviewedModelDocument, fact: ReviewedModelFact): string =>
  technicalDocumentClaimSha256(document, fact.field, fact.value, document.reviewedOn, fact.support);

export const reviewedModelDocumentVerification = (
  document: TechnicalDocumentReference, field: string, value: string
): TechnicalDocumentVerification | null => {
  const matches = documents.filter((entry) => entry.url === document.url &&
    entry.brand === document.brand && entry.model === document.model).flatMap((entry) =>
    entry.facts.filter((fact) => fact.field === field && fact.value === value).map((fact) => ({ entry, fact })));
  if (matches.length > 1) throw new Error("Acreditación documental repetida");
  const matched = matches[0];
  if (!matched) return null;
  return { kind: "reviewed-model-fact", reviewedOn: matched.entry.reviewedOn,
    support: matched.fact.support, claimSha256: claimHash(matched.entry, matched.fact) };
};

export const reviewedModelDocumentClaims = (): readonly {
  readonly document: TechnicalDocumentReference;
  readonly field: string;
  readonly value: string;
  readonly verification: TechnicalDocumentVerification;
}[] => documents.flatMap((entry) => entry.facts.map((fact) => ({
  document: { url: entry.url, brand: entry.brand, model: entry.model },
  field: fact.field, value: fact.value,
  verification: { kind: "reviewed-model-fact", reviewedOn: entry.reviewedOn,
    support: fact.support, claimSha256: claimHash(entry, fact) }
})));

export const reusableReviewedModelClaims = (brand: string, model: string) => documents
  .filter((entry) => entry.brand === brand && entry.model === model && entry.reuse !== undefined)
  .flatMap((entry) => {
    const reuse = entry.reuse;
    if (!reuse) return [];
    const facts = documents.filter((document) => document.brand === brand && document.model === model &&
      document.url === entry.url).flatMap((document) => document.facts.filter((fact) => reuse.fields.includes(fact.field)));
    return [{ url: entry.url, compatibility: reuse.compatibility, fallback: reuse.fallback === true, facts }];
  });
