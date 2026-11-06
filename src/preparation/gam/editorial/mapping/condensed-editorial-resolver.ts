import { createHash } from "node:crypto";
import type { ProductRecord } from "../../../../contracts/catalog.js";
import type { EditorialEvidence } from "../evidence/contracts.js";
import { multiSectorPrimaryEvidence } from "../evidence/multi-sector-primary.js";
import { multiSectorSecondaryEvidence } from "../evidence/multi-sector-secondary.js";
import { multiSectorTertiaryEvidence } from "../evidence/multi-sector-tertiary.js";
import { cleaningEvidence } from "../evidence/cleaning.js";
import { forkliftsEvidence } from "../evidence/forklifts.js";
import { handlingEvidence } from "../evidence/handling.js";
import { platformsEvidence } from "../evidence/platforms.js";
import { warehouseEvidence } from "../evidence/warehouse.js";
import { hysterEvidence } from "../evidence/hyster.js";
import { tennantEvidence } from "../evidence/tennant.js";

export const verifyGamEditorialEvidence = (
  record: ProductRecord,
  evidenceSet: Readonly<Record<string, EditorialEvidence>>
): EditorialEvidence | null => {
  if (record.providerId !== "gam" || record.condition !== "Nuevo" || !record.reference ||
    !record.longDescription || !record.title || !record.brand || !record.model) return null;
  const entry = evidenceSet[record.reference];
  if (!entry || record.url !== entry.url || record.title !== entry.title ||
    record.categoryKey !== entry.categoryKey || record.brand !== entry.brand ||
    record.model !== entry.model || record.externalReference !== entry.model ||
    Object.keys(record.specs ?? {}).length !== Object.keys(entry.sourceSpecs).length ||
    Object.entries(entry.sourceSpecs).some(([key, value]) => record.specs?.[key] !== value)) return null;
  const fingerprint = createHash("sha256").update(record.longDescription.trim()).digest("hex");
  return fingerprint === entry.sourceHash ? entry : null;
};

export const createGamCondensedEditorialResolver = (
  evidenceSet: Readonly<Record<string, EditorialEvidence>>,
  requireMatchingSourceShort = false
): {
  readonly general: (record: ProductRecord) => string | null;
  readonly short: (record: ProductRecord) => string | null;
} => ({
  general: (record) => {
    const entry = verifyGamEditorialEvidence(record, evidenceSet);
    return entry && (!requireMatchingSourceShort || entry.originalShort === record.shortDescription)
      ? entry.general : null;
  },
  short: (record) => {
    const entry = verifyGamEditorialEvidence(record, evidenceSet);
    return entry?.originalShort && record.shortDescription === entry.originalShort
      ? entry.revisedShort ?? null : null;
  }
});

const resolversInPriorityOrder = [
  createGamCondensedEditorialResolver(multiSectorPrimaryEvidence),
  createGamCondensedEditorialResolver(multiSectorSecondaryEvidence),
  createGamCondensedEditorialResolver(multiSectorTertiaryEvidence, true),
  createGamCondensedEditorialResolver(cleaningEvidence, true),
  createGamCondensedEditorialResolver(forkliftsEvidence, true),
  createGamCondensedEditorialResolver(handlingEvidence, true),
  createGamCondensedEditorialResolver(platformsEvidence, true),
  createGamCondensedEditorialResolver(warehouseEvidence, true),
  createGamCondensedEditorialResolver(hysterEvidence, true),
  createGamCondensedEditorialResolver(tennantEvidence, true)
];

export const resolveGamCondensedEditorialGeneral = (record: ProductRecord): string | null => {
  for (const resolver of resolversInPriorityOrder) {
    const general = resolver.general(record);
    if (general !== null) return general;
  }
  return null;
};

export const resolveGamCondensedEditorialShort = (record: ProductRecord): string | null => {
  for (const resolver of resolversInPriorityOrder) {
    const short = resolver.short(record);
    if (short !== null) return short;
  }
  return null;
};
