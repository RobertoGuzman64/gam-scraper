import type { ProductRecord } from "../../../contracts/catalog.js";
import { loadEditorialKnowledge, editorialSourceDigest } from "../../../infrastructure/filesystem/editorial-knowledge.js";
import { reconcileInitialTechnicalEvidence } from "../../technical/preparation-technical-stages.js";
import { resolveEditorialFacts } from "./editorial-facts.js";
import { hasCorroboratedEditorialCapacityReconciliation, sameEditorialUnit, verifiedEditorialIdentity } from "./editorial-source-contract.js";
import { editorialIdentityKey, resolveFamilyGuidance, selectUnitKnowledge, selectIdentityOverrideKnowledge } from "./editorial-knowledge.js";
import type { EditorialUnitIdentity } from "./editorial-knowledge.js";

const sameEditorialOrigin = (source: ProductRecord, prepared: ProductRecord): boolean =>
  Boolean(source.reference?.trim()) && source.providerId === prepared.providerId &&
  source.reference === prepared.reference && source.url === prepared.url &&
  source.condition === prepared.condition;

const hasCorroboratedEditorialModelReconciliation = (
  source: ProductRecord, prepared: ProductRecord
): boolean => {
  if (!sameEditorialOrigin(source, prepared) || !verifiedEditorialIdentity(source) ||
    source.model === prepared.model || source.brand !== prepared.brand ||
    source.year !== prepared.year || source.horometer !== prepared.horometer ||
    source.serialNumber !== prepared.serialNumber) return false;
  const reconciled = reconcileInitialTechnicalEvidence(source);
  return reconciled !== source && sameEditorialUnit(reconciled, prepared) &&
    reconciled.title === prepared.title &&
    reconciled.shortDescription === prepared.shortDescription &&
    (reconciled.longDescription === prepared.longDescription ||
      source.longDescription === prepared.longDescription) &&
    reconciled.specs?.Marca === prepared.specs?.Marca &&
    reconciled.specs?.Modelo === prepared.specs?.Modelo;
};

export const resolveEditorialUnitIdentity = (record: ProductRecord): EditorialUnitIdentity | null =>
  record.reference?.trim() ? {
    key: `${record.providerId}:${record.reference}`,
    sourceUrl: record.url, brand: record.brand ?? "", model: record.model ?? ""
  } : null;

export const resolveKnowledgeEditorial = (record: ProductRecord, sourceUnitRecord: ProductRecord = record) => {
  const knowledge = loadEditorialKnowledge();
  const rule = record.brand && record.model ? knowledge.modelRules.get(editorialIdentityKey(record.brand, record.model)) : null;
  const facts = resolveEditorialFacts(record, rule?.family ?? null);
  const sameIdentity = sameEditorialOrigin(sourceUnitRecord, record) &&
    (sameEditorialUnit(sourceUnitRecord, record) &&
      (record.title === sourceUnitRecord.title ||
        hasCorroboratedEditorialCapacityReconciliation(sourceUnitRecord, record)) ||
      hasCorroboratedEditorialModelReconciliation(sourceUnitRecord, record));
  const matchingIdentity = resolveEditorialUnitIdentity(sourceUnitRecord);
  const originalDigest = matchingIdentity ? editorialSourceDigest(sourceUnitRecord) : null;
  const exception = sameEditorialOrigin(sourceUnitRecord, record) && matchingIdentity && originalDigest
    ? selectIdentityOverrideKnowledge(matchingIdentity, knowledge, originalDigest) : null;
  const unit = sameIdentity && matchingIdentity && originalDigest ? selectUnitKnowledge(matchingIdentity, knowledge, originalDigest) :
    exception ?? { short: null, general: null, fallbackGeneral: null, title: null };
  return {
    familyOverride: rule?.family ?? null,
    short: unit.short,
    general: unit.general,
    fallbackGeneral: unit.fallbackGeneral,
    title: unit.title,
    identityOverride: Boolean(exception),
    familyGuidance: facts ? resolveFamilyGuidance(facts, knowledge) : null
  };
};
