import type { EditorialFacts } from "./editorial-facts.js";
import type { EditorialFamily } from "./editorial-families.js";
import { formatEditorialQuantity } from "./editorial-measurements.js";

export type EditorialUnitKnowledge = {
  readonly key: string;
  readonly brand: string;
  readonly model: string;
  readonly sourceUrl: string;
  readonly sourceDigest: string;
  readonly short: string | null;
  readonly general: string | null;
  readonly title: string | null;
  readonly evidenceSource: string;
  readonly priority: number;
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
  readonly evidenceSource: string;
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

const labels: Readonly<Record<EditorialConsensusMetric, readonly [string, string]>> = {
  workingHeightM: ["altura de trabajo", "m"],
  platformHeightM: ["altura de plataforma", "m"],
  lateralReachM: ["alcance lateral", "m"],
  liftingHeightM: ["altura de elevación", "m"],
  loadCapacityKg: ["capacidad de carga", "kg"],
  voltageV: ["voltaje", "V"],
  powerKva: ["potencia aparente", "kVA"],
  gradeabilityPercent: ["pendiente superable", "%"],
  energy: ["energía", ""]
};

const metrics: readonly EditorialConsensusMetric[] = [
  "workingHeightM", "platformHeightM", "lateralReachM", "liftingHeightM", "loadCapacityKg",
  "voltageV", "powerKva", "gradeabilityPercent", "energy"
];

export const resolveModelReference = (
  facts: EditorialFacts,
  knowledge: EditorialKnowledge
): string | null => {
  const entry = knowledge.models.get(editorialModelKey(facts.brand, facts.model, facts.family));
  if (!entry || entry.samples < 2 || entry.catalogReferences.length < 2) return null;
  const unknown: string[] = [];
  for (const key of metrics) {
    const value = entry.stable[key];
    if (value === undefined || facts[key] !== null) continue;
    const [label, unit] = labels[key];
    if (typeof value === "number") unknown.push(`${label} de ${formatEditorialQuantity(value)} ${unit}`);
    else if (key === "energy") unknown.push(`motorización ${value}`);
    if (unknown.length === 2) break;
  }
  if (unknown.length === 0) return null;
  return `Como referencia, otras fichas del catálogo del modelo ${facts.brand} ${facts.model} publican ${unknown.join(" y ")}; estos datos no acreditan por sí solos la configuración de esta unidad.`;
};

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

export const selectUnitKnowledge = (
  identity: EditorialUnitIdentity,
  knowledge: EditorialKnowledge,
  digest: string
): { readonly short: string | null; readonly general: string | null; readonly fallbackGeneral: string | null; readonly title: string | null } => {
  const matching = knowledge.units.get(identity.key)?.filter((entry) =>
    entry.sourceUrl === identity.sourceUrl && entry.sourceDigest === digest &&
    fold(entry.brand) === fold(identity.brand) && fold(entry.model) === fold(identity.model)) ?? [];
  return {
    short: matching.find((entry) => entry.short?.trim())?.short ?? null,
    general: matching.find((entry) => entry.usage !== "fallback" && entry.general?.trim())?.general ?? null,
    fallbackGeneral: matching.find((entry) => entry.usage === "fallback" && entry.general?.trim())?.general ?? null,
    title: matching.find((entry) => entry.title?.trim())?.title ?? null
  };
};
