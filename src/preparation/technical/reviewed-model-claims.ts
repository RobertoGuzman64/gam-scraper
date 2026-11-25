import { technicalDocumentClaimSha256 } from "../../contracts/technical-provenance.js";
import type { TechnicalDocumentReference, TechnicalDocumentVerification } from "../../contracts/technical-provenance.js";

import type { ReviewedModelDocument, ReviewedModelFact } from "./reviewed-model-evidence/types.js";
import { accessEquipmentDocuments } from "./reviewed-model-evidence/access-equipment.js";
import { cleaningEquipmentDocuments } from "./reviewed-model-evidence/cleaning-equipment.js";
import { constructionEquipmentDocuments } from "./reviewed-model-evidence/construction-equipment.js";
import { genieDocuments } from "./reviewed-model-evidence/genie.js";
import { handlingEquipmentDocuments } from "./reviewed-model-evidence/handling-equipment.js";
import { haulotteDocuments } from "./reviewed-model-evidence/haulotte.js";
import { hysterDocuments } from "./reviewed-model-evidence/hyster.js";
import { jlgDocuments } from "./reviewed-model-evidence/jlg.js";
import { lgmgDocuments } from "./reviewed-model-evidence/lgmg.js";
import { logitransDocuments } from "./reviewed-model-evidence/logitrans.js";
import { manitouDocuments } from "./reviewed-model-evidence/manitou.js";
import { mobilityDocuments } from "./reviewed-model-evidence/mobility.js";
import { modulaDocuments } from "./reviewed-model-evidence/modula.js";
import { powerAndLightingDocuments } from "./reviewed-model-evidence/power-and-lighting.js";
import { yaleDocuments } from "./reviewed-model-evidence/yale.js";

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
