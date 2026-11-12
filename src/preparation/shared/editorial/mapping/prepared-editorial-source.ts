import type { ProductRecord } from "../../../../contracts/catalog.js";
import type { SourceEditorialEvidence } from "./source-editorial-evidence.js";
import { distinguishDescriptions } from "../../../../catalog/normalization/descriptions.js";
import { resolveReusableEditorial } from "../domain/editorial-composition.js";
import { resolveSourceEditorialClaims } from "../domain/editorial-source-claims.js";
import { resolveUnbrandedEditorial } from "../domain/editorial-unbranded-equipment.js";
import { resolveVerifiedEditorialUnitContext } from "../domain/editorial-unit-context.js";
import { cleanAuthenticatedSourceEditorial } from "../domain/editorial-text-hygiene.js";
import { resolveKnowledgeEditorial } from "./knowledge-editorial.js";
import { conciseVerifiedUnitGeneral, conciseSignedUnitGeneral, resolveEditorialIdentitySummary } from "../domain/editorial-identity-summary.js";
import { compressVerifiedSourceShort } from "../domain/editorial-source-brief.js";
import { editorialFamilyFromSourceGeneral } from "../domain/editorial-families.js";
import { resolveVerifiedTechnicalBrief } from "../domain/editorial-technical-brief.js";

const sourceHeightConflict = (record: ProductRecord): boolean => {
  const additional = record.specs?.["Título adicional"];
  const height = record.specs?.["Altura de trabajo"];
  const measured = typeof height === "string" ? /^(\d+(?:[.,]\d+)?)\s*m$/iu.exec(height.trim()) : null;
  if (typeof additional === "string" && typeof height === "string") {
    const titled = /\b(?:PLATAFORMA|BRAZO)\s+(?:ARTICULADA|TELESCOPICA|TIJERA)\s+(?:ELECTRICA|DIESEL)\s+(\d+(?:[.,]\d+)?)\s*MT\b/iu.exec(additional);
    if (titled?.[1] !== undefined &&
      (measured?.[1] === undefined || Number(titled[1].replace(",", ".")) !== Number(measured[1].replace(",", ".")))) return true;
  }
  const explicit = (text: string | null): number | null => {
    const match = /\baltura\s+de\s+trabajo\s+(?:de\s+)?(\d+(?:[.,]\d+)?)\s*(?:m|mt|metros?)\b/iu.exec(text ?? "");
    return match?.[1] === undefined ? null : Number(match[1].replace(",", "."));
  };
  const title = explicit(record.title);
  const general = explicit(record.longDescription);
  const publishedHeight = measured?.[1] === undefined ? null : Number(measured[1].replace(",", "."));
  if (general !== null && publishedHeight !== null && general !== publishedHeight) return true;
  return title !== null && (general !== null && title !== general ||
    publishedHeight !== null && title !== publishedHeight);
};

export const resolvePreparedEditorialSource = (
  record: ProductRecord,
  evidence: SourceEditorialEvidence,
  sourceUnitRecord: ProductRecord = record
) => {
  const heightConflict = sourceHeightConflict(record);
  const verified = evidence.sourceVerified && evidence.identityVerified && !heightConflict;
  const resolvedKnowledge = resolveKnowledgeEditorial(record, sourceUnitRecord);
  const knowledge = verified || resolvedKnowledge.identityOverride ||
    Boolean(resolvedKnowledge.short || resolvedKnowledge.general || resolvedKnowledge.title) ? resolvedKnowledge : null;
  const sourceFamily = verified && !sourceUnitRecord.shortDescription?.trim() ?
    editorialFamilyFromSourceGeneral(sourceUnitRecord.longDescription) : null;
  const familyOverride = knowledge?.familyOverride ?? sourceFamily;
  const composed = verified ? resolveUnbrandedEditorial(record) ?? resolveReusableEditorial(record, familyOverride) : { short: null, general: null };
  const general = knowledge?.general ?? (verified ? resolveSourceEditorialClaims(sourceUnitRecord, record, composed.general) : null);
  const recoveredShort = !record.shortDescription?.trim() ?
    (knowledge?.general ? conciseVerifiedUnitGeneral(sourceUnitRecord, knowledge.general) ??
      conciseSignedUnitGeneral(knowledge.general) : null) ??
      resolveEditorialIdentitySummary(record, familyOverride) ??
      (verified ? resolveVerifiedTechnicalBrief(sourceUnitRecord, record) : null) : null;
  const narrative = general && !knowledge?.general ? [knowledge?.familyGuidance, knowledge?.modelReference]
    .filter((part): part is string => Boolean(part)).join(" ") : "";
  const assembledGeneral = general ? `${general}${narrative ? ` ${narrative}` : ""}` : record.longDescription;
  const long = knowledge?.general ? assembledGeneral : resolveVerifiedEditorialUnitContext(sourceUnitRecord, assembledGeneral);
  const sourceClean = cleanAuthenticatedSourceEditorial(sourceUnitRecord,
    knowledge?.short ?? composed.short ?? record.shortDescription ?? recoveredShort, long);
  const compact = verified && !knowledge?.short && !composed.short ?
    compressVerifiedSourceShort(sourceUnitRecord, sourceClean.short, sourceClean.general) : null;
  return {
    verifiedTitle: knowledge?.title ?? null,
    descriptions: distinguishDescriptions(compact ?? sourceClean.short, sourceClean.general),
    heightConflict
  };
};
