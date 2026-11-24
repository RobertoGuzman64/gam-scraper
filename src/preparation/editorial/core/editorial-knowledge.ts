import type { EditorialFacts } from "./editorial-facts.js";
import type { EditorialFamily } from "./editorial-families.js";

export type EditorialUnitKnowledge = {
  readonly key: string;
  readonly brand: string;
  readonly model: string;
  readonly sourceUrl: string;
  readonly sourceDigest: string;
  readonly short: string | null;
  readonly general: string | null;
  readonly title: string | null;
  readonly priority: number;
  readonly verificationUrl?: string;
  readonly manufacturerUrl?: string;
  readonly manufacturerSource?: string;
  readonly supplierSource?: string;
  readonly identityOverride?: boolean;
  readonly usage?: "fallback";
};

export type EditorialConsensusMetric =
  | "workingHeightM" | "platformHeightM" | "lateralReachM" | "liftingHeightM"
  | "loadCapacityKg" | "voltageV" | "powerKva" | "gradeabilityPercent" | "energy";

export type EditorialModelKnowledge = {
  readonly brand: string;
  readonly model: string;
  readonly family: EditorialFamily;
  readonly samples: number;
  readonly catalogReferences: readonly string[];
  readonly stable: Readonly<Partial<Record<EditorialConsensusMetric, number | string>>>;
};

export type EditorialFamilyGuidance = {
  readonly application: string;
  readonly caution: string;
};

export type EditorialVerifiedModelRule = {
  readonly brand: string;
  readonly model: string;
  readonly family: EditorialFamily;
  readonly manufacturerSource: string;
};

export type EditorialTechnicalModelReference = {
  readonly brand: string;
  readonly model: string;
  readonly family: EditorialFamily;
  readonly advertisedWorkHeight: string;
  readonly documentedWorkHeight: string;
  readonly platformHeight: string;
  readonly nominalCapacity: string;
  readonly characteristic: string | null;
  readonly energy: "eléctrica" | "diésel" | null;
  readonly sourceUrl: string;
};

export type EditorialKnowledge = {
  readonly units: ReadonlyMap<string, readonly EditorialUnitKnowledge[]>;
  readonly models: ReadonlyMap<string, EditorialModelKnowledge>;
  readonly families: Readonly<Partial<Record<EditorialFamily, EditorialFamilyGuidance>>>;
  readonly modelRules: ReadonlyMap<string, EditorialVerifiedModelRule>;
  readonly technicalReferences: ReadonlyMap<string, readonly EditorialTechnicalModelReference[]>;
};

const fold = (value: string): string => value.normalize("NFD")
  .replace(/[\u0300-\u036f]/gu, "").trim().toLocaleLowerCase("es");

export const editorialIdentityKey = (brand: string, model: string): string =>
  [fold(brand), fold(model)].join("|");

export const editorialModelKey = (brand: string, model: string, family: EditorialFamily): string =>
  [fold(brand), fold(model), family].join("|");

export const resolveFamilyGuidance = (facts: EditorialFacts, knowledge: EditorialKnowledge): string | null => {
  const guidance = knowledge.families[facts.family];
  return guidance ? `${guidance.application} ${guidance.caution}` : null;
};

export type EditorialUnitIdentity = {
  readonly key: string;
  readonly sourceUrl: string;
  readonly brand: string;
  readonly model: string;
};

const matchingUnitKnowledge = (
  identity: EditorialUnitIdentity,
  knowledge: EditorialKnowledge,
  digest: string
): readonly EditorialUnitKnowledge[] => knowledge.units.get(identity.key)?.filter((entry) =>
  entry.sourceUrl === identity.sourceUrl && entry.sourceDigest === digest &&
  fold(entry.brand) === fold(identity.brand) && fold(entry.model) === fold(identity.model)) ?? [];

type SelectedUnitKnowledge = {
  readonly short: string | null;
  readonly general: string | null;
  readonly fallbackGeneral: string | null;
  readonly title: string | null;
};

const selectEditorialTexts = (matching: readonly EditorialUnitKnowledge[]): SelectedUnitKnowledge => ({
  short: matching.find((entry) => entry.short?.trim())?.short ?? null,
  general: matching.find((entry) => entry.usage !== "fallback" && entry.general?.trim())?.general ?? null,
  fallbackGeneral: matching.find((entry) => entry.usage === "fallback" && entry.general?.trim())?.general ?? null,
  title: matching.find((entry) => entry.title?.trim())?.title ?? null
});

export const selectUnitKnowledge = (
  identity: EditorialUnitIdentity,
  knowledge: EditorialKnowledge,
  digest: string
): SelectedUnitKnowledge => selectEditorialTexts(matchingUnitKnowledge(identity, knowledge, digest));

export const selectIdentityOverrideKnowledge = (
  identity: EditorialUnitIdentity,
  knowledge: EditorialKnowledge,
  digest: string
): SelectedUnitKnowledge | null => {
  const matching = matchingUnitKnowledge(identity, knowledge, digest).filter((entry) => entry.identityOverride === true);
  return matching.length > 0 ? selectEditorialTexts(matching) : null;
};
