import type { ProductRecord } from "../../../../contracts/catalog.js";
import { loadEditorialKnowledge, editorialSourceDigest } from "../../../../infrastructure/filesystem/editorial/knowledge.js";
import { resolveEditorialFacts } from "../domain/editorial-facts.js";
import { resolveTechnicalModelReference } from "../domain/editorial-model-technical-reference.js";
import { sameEditorialUnit, verifiedEditorialIdentity } from "../domain/editorial-source-contract.js";
import { editorialFamilyOf } from "../domain/editorial-families.js";
import { editorialIdentityKey, resolveFamilyGuidance, resolveModelReference, selectUnitKnowledge, selectIdentityOverrideKnowledge } from "../domain/editorial-knowledge.js";

const sameEditorialOrigin = (source: ProductRecord, prepared: ProductRecord): boolean =>
  Boolean(source.reference?.trim()) && source.providerId === prepared.providerId &&
  source.reference === prepared.reference && source.url === prepared.url &&
  source.condition === prepared.condition;

export const resolveKnowledgeEditorial = (record: ProductRecord, sourceUnitRecord: ProductRecord = record) => {
  const knowledge = loadEditorialKnowledge();
  const rule = record.brand && record.model ? knowledge.modelRules.get(editorialIdentityKey(record.brand, record.model)) : null;
  const facts = resolveEditorialFacts(record, rule?.family ?? null);
  const sameIdentity = sameEditorialOrigin(sourceUnitRecord, record) &&
    sameEditorialUnit(sourceUnitRecord, record) &&
    record.title === sourceUnitRecord.title;
  const matchingIdentity = sourceUnitRecord.reference?.trim() ? {
    key: `${sourceUnitRecord.providerId}:${sourceUnitRecord.reference}`,
    sourceUrl: sourceUnitRecord.url, brand: sourceUnitRecord.brand ?? "", model: sourceUnitRecord.model ?? ""
  } : null;
  const originalDigest = matchingIdentity ? editorialSourceDigest(sourceUnitRecord) : null;
  const exception = sameEditorialOrigin(sourceUnitRecord, record) && matchingIdentity && originalDigest
    ? selectIdentityOverrideKnowledge(matchingIdentity, knowledge, originalDigest) : null;
  const unit = sameIdentity && matchingIdentity && originalDigest ? selectUnitKnowledge(matchingIdentity, knowledge, originalDigest) :
    exception ?? { short: null, general: null, fallbackGeneral: null, title: null };
  const originalFacts = sameEditorialOrigin(sourceUnitRecord, record) &&
    sameEditorialUnit(sourceUnitRecord, record) && verifiedEditorialIdentity(sourceUnitRecord)
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
