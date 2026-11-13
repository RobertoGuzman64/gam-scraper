import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { ProductRecord } from "../../../contracts/catalog.js";
import type {
  EditorialConsensusMetric, EditorialFamilyGuidance, EditorialKnowledge, EditorialModelKnowledge,
  EditorialUnitKnowledge, EditorialVerifiedModelRule, EditorialTechnicalModelReference
} from "../../../preparation/shared/editorial/domain/editorial-knowledge.js";
import type { EditorialFamily } from "../../../preparation/shared/editorial/domain/editorial-families.js";
import { isEditorialFamily } from "../../../preparation/shared/editorial/domain/editorial-families.js";
import { editorialIdentityKey, editorialModelKey } from "../../../preparation/shared/editorial/domain/editorial-knowledge.js";

const recordOf = (value: unknown): Record<string, unknown> | null =>
  typeof value === "object" && value !== null && !Array.isArray(value) ? Object.fromEntries(Object.entries(value)) : null;

const readKnowledgeFile = (name: string): Record<string, unknown> => {
  const parsed: unknown = JSON.parse(readFileSync(resolve(process.cwd(), "data/editorial/knowledge", name), "utf8"));
  const document = recordOf(parsed);
  if (!document || document.version !== 1) throw new Error(`Contrato editorial desconocido: ${name}`);
  return document;
};

const isString = (value: unknown): value is string => typeof value === "string";
const nullableString = (value: unknown): value is string | null => value === null || isString(value);

const readUnit = (value: unknown): EditorialUnitKnowledge => {
  const item = recordOf(value);
  if (!item || !isString(item.key) || !isString(item.brand) || !isString(item.model) ||
    !isString(item.sourceUrl) || !isString(item.sourceDigest) || !/^[a-f\d]{64}$/u.test(item.sourceDigest) ||
    !nullableString(item.short) || !nullableString(item.general) || !nullableString(item.title) || !isString(item.evidenceSource) ||
    typeof item.priority !== "number" ||
    item.usage !== undefined && item.usage !== "fallback") throw new Error("Evidencia de unidad editorial inválida");
  return {
    key: item.key, brand: item.brand, model: item.model, sourceUrl: item.sourceUrl,
    sourceDigest: item.sourceDigest, short: item.short, general: item.general, title: item.title,
    evidenceSource: item.evidenceSource, priority: item.priority,
    ...(item.identityOverride === true ? { identityOverride: true } : {}),
    ...(item.usage === "fallback" ? { usage: "fallback" as const } : {})
  };
};

const metricNames: readonly EditorialConsensusMetric[] = [
  "workingHeightM", "platformHeightM", "lateralReachM", "liftingHeightM", "loadCapacityKg",
  "voltageV", "powerKva", "gradeabilityPercent", "energy"
];

const readModel = (value: unknown): EditorialModelKnowledge => {
  const item = recordOf(value);
  const stable = recordOf(item?.stable);
  if (!item || !isString(item.brand) || !isString(item.model) || !isString(item.family) ||
    !isEditorialFamily(item.family) || typeof item.samples !== "number" || !Number.isSafeInteger(item.samples) || item.samples < 2 ||
    !Array.isArray(item.catalogReferences) || !item.catalogReferences.every(isString) || !stable ||
    Object.entries(stable).some(([key, entry]) => !metricNames.some((name) => name === key) ||
      typeof entry !== "number" && typeof entry !== "string")) throw new Error("Consenso editorial inválido");
  const values: Partial<Record<EditorialConsensusMetric, number | string>> = {};
  for (const name of metricNames) {
    const value = stable[name];
    if (typeof value === "number" || typeof value === "string") values[name] = value;
  }
  return { brand: item.brand, model: item.model, family: item.family,
    samples: item.samples, catalogReferences: item.catalogReferences, stable: values };
};

let cached: EditorialKnowledge | null = null;

export const loadEditorialKnowledge = (): EditorialKnowledge => {
  if (cached) return cached;
  const unitRaw = readKnowledgeFile("verified-units.json").entries;
  const modelRaw = readKnowledgeFile("model-consensus.json").entries;
  const familyRaw = recordOf(readKnowledgeFile("family-guidance.json").entries);
  const modelRuleRaw = readKnowledgeFile("manufacturer-models.json").entries;
  const technicalReferenceRaw = readKnowledgeFile("model-technical-references.json").entries;
  if (!Array.isArray(unitRaw) || !Array.isArray(modelRaw) || !familyRaw || !Array.isArray(modelRuleRaw) || !Array.isArray(technicalReferenceRaw)) throw new Error("Índices editoriales incompletos");
  const units = new Map<string, EditorialUnitKnowledge[]>();
  for (const raw of unitRaw) {
    const item = readUnit(raw);
    const group = units.get(item.key) ?? [];
    group.push(item);
    units.set(item.key, group);
  }
  for (const entries of units.values()) entries.sort((a, b) => b.priority - a.priority || a.evidenceSource.localeCompare(b.evidenceSource));
  const models = new Map<string, EditorialModelKnowledge>();
  for (const raw of modelRaw) {
    const item = readModel(raw);
    const key = editorialModelKey(item.brand, item.model, item.family);
    if (models.has(key)) throw new Error(`Colisión de identidad editorial: ${key}`);
    models.set(key, item);
  }
  const families: Partial<Record<EditorialFamily, EditorialFamilyGuidance>> = {};
  for (const [family, raw] of Object.entries(familyRaw)) {
    const value = recordOf(raw);
    if (!isString(value?.application) || !isString(value.caution)) throw new Error(`Familia editorial inválida: ${family}`);
    if (!isEditorialFamily(family)) throw new Error(`Familia editorial no reconocida: ${family}`);
    families[family] = { application: value.application, caution: value.caution };
  }
  const modelRules = new Map<string, EditorialVerifiedModelRule>();
  for (const raw of modelRuleRaw) {
    const value = recordOf(raw);
    if (!isString(value?.brand) || !isString(value.model) || !isString(value.family) ||
      !isEditorialFamily(value.family) || !isString(value.manufacturerSource) ||
      !isString(value.evidenceSource)) throw new Error("Regla editorial de fabricante inválida");
    const key = editorialIdentityKey(value.brand, value.model);
    if (modelRules.has(key)) throw new Error(`Colisión de regla de fabricante: ${key}`);
    modelRules.set(key, {
      brand: value.brand, model: value.model, family: value.family,
      manufacturerSource: value.manufacturerSource, evidenceSource: value.evidenceSource
    });
  }
  const technicalReferences = new Map<string, EditorialTechnicalModelReference[]>();
  for (const raw of technicalReferenceRaw) {
    const value = recordOf(raw);
    if (!value || !isString(value.brand) || !value.brand.trim() || !isString(value.model) || !value.model.trim() ||
      !isString(value.family) || !isEditorialFamily(value.family) ||
      !isString(value.advertisedWorkHeight) || !isString(value.documentedWorkHeight) ||
      !isString(value.platformHeight) || !isString(value.nominalCapacity) ||
      !nullableString(value.characteristic) ||
      value.energy !== null && value.energy !== "eléctrica" && value.energy !== "diésel" ||
      !isString(value.sourceUrl) || !/^https:\/\/[^/]+/u.test(value.sourceUrl)) {
      throw new Error("Referencia documental de modelo inválida");
    }
    const document: EditorialTechnicalModelReference = {
      brand: value.brand, model: value.model, family: value.family,
      advertisedWorkHeight: value.advertisedWorkHeight, documentedWorkHeight: value.documentedWorkHeight,
      platformHeight: value.platformHeight, nominalCapacity: value.nominalCapacity,
      characteristic: value.characteristic, energy: value.energy, sourceUrl: value.sourceUrl
    };
    const key = editorialIdentityKey(document.brand, document.model);
    const group = technicalReferences.get(key) ?? [];
    group.push(document);
    technicalReferences.set(key, group);
  }
  cached = { units, models, families, modelRules, technicalReferences };
  return cached;
};

const digestFields = [
  "url", "title", "brand", "model", "externalReference", "condition", "categoryKey",
  "year", "horometer", "shortDescription", "longDescription", "specs"
] as const;

export const editorialSourceDigest = (record: ProductRecord): string => {
  const values: Record<string, unknown> = {};
  for (const field of digestFields) if (record[field] !== undefined) values[field] = record[field];
  return createHash("sha256").update(JSON.stringify(values)).digest("hex");
};
