import type { ProductRecord } from "../../../../contracts/catalog.js";
import { loadEditorialKnowledge, editorialSourceDigest } from "../../../../infrastructure/filesystem/editorial/knowledge.js";
import { resolveEditorialFacts } from "../domain/editorial-facts.js";
import { resolveTechnicalModelReference } from "../domain/editorial-model-technical-reference.js";
import { sameEditorialUnit, verifiedEditorialIdentity } from "../domain/editorial-source-contract.js";
import { editorialFamilyOf } from "../domain/editorial-families.js";
import { editorialIdentityKey, resolveFamilyGuidance, resolveModelReference, selectUnitKnowledge } from "../domain/editorial-knowledge.js";

export const resolveKnowledgeEditorial = (record: ProductRecord, sourceUnitRecord: ProductRecord = record) => {
  const knowledge = loadEditorialKnowledge();
  const rule = record.brand && record.model ? knowledge.modelRules.get(editorialIdentityKey(record.brand, record.model)) : null;
  const facts = resolveEditorialFacts(record, rule?.family ?? null);
  const sameIdentity = record.providerId === sourceUnitRecord.providerId &&
    record.reference === sourceUnitRecord.reference && record.url === sourceUnitRecord.url &&
    record.brand === sourceUnitRecord.brand && record.model === sourceUnitRecord.model &&
    record.title === sourceUnitRecord.title;
  const matchingIdentity = sourceUnitRecord.reference?.trim() ? {
    key: `${sourceUnitRecord.providerId}:${sourceUnitRecord.reference}`,
    sourceUrl: sourceUnitRecord.url, brand: sourceUnitRecord.brand ?? "", model: sourceUnitRecord.model ?? ""
  } : null;
  const originalDigest = matchingIdentity ? editorialSourceDigest(sourceUnitRecord) : null;
  const fold = (value: string): string => value.normalize("NFD").replace(/[\u0300-\u036f]/gu, "").toLocaleLowerCase("es").trim();
  const exception = matchingIdentity && originalDigest ? knowledge.units.get(matchingIdentity.key)?.find((entry) =>
    entry.identityOverride === true && entry.sourceDigest === originalDigest &&
    entry.sourceUrl === matchingIdentity.sourceUrl && fold(entry.brand) === fold(matchingIdentity.brand) &&
    fold(entry.model) === fold(matchingIdentity.model)) : undefined;
  const unit = sameIdentity && matchingIdentity && originalDigest ? selectUnitKnowledge(matchingIdentity, knowledge, originalDigest) : exception ?
    { short: exception.short, general: exception.usage === "fallback" ? null : exception.general,
      fallbackGeneral: exception.usage === "fallback" ? exception.general : null, title: exception.title } :
    { short: null, general: null, fallbackGeneral: null, title: null };
  const originalFacts = sameEditorialUnit(sourceUnitRecord, record) && verifiedEditorialIdentity(sourceUnitRecord)
    ? resolveEditorialFacts(sourceUnitRecord, rule?.family ?? null) : null;
  const titledFamily = editorialFamilyOf(record.title ?? "");
  const originalTitledFamily = editorialFamilyOf(sourceUnitRecord.title ?? "");
  const documentedReference = facts && originalFacts &&
    (!titledFamily || titledFamily === facts.family) &&
    (!originalTitledFamily || originalTitledFamily === facts.family) &&
    facts.family === originalFacts.family &&
    facts.workingHeightM === originalFacts.workingHeightM && facts.energy === originalFacts.energy
    ? resolveTechnicalModelReference(facts, knowledge) : null;
  const consensusReference = facts ? resolveModelReference(facts, knowledge) : null;
  const modelReference = [consensusReference, documentedReference]
    .filter((entry): entry is string => entry !== null).join(" ") || null;
  return {
    familyOverride: rule?.family ?? null,
    short: unit.short,
    general: unit.general,
    fallbackGeneral: unit.fallbackGeneral,
    title: unit.title,
    identityOverride: Boolean(exception),
    familyGuidance: facts ? resolveFamilyGuidance(facts, knowledge) : null,
    modelReference
  };
};
