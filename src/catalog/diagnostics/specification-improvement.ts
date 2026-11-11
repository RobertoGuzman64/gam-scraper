import { createHash } from "node:crypto";
import { buildProductIdentity } from "../identity.js";
import { fold } from "../../preparation/shared/classification/mapping/category-utils.js";
import { technicalPriorityFamily, publishedTechnicalKeys, hasEssentialTechnicalSpec, type PriorityTechnicalFamily, type TechnicalPriority } from "./specification-family-priorities.js";
import { analyzeTechnicalDensity, isTechnicalSpecificationKey, type TechnicalDensity } from "./technical-density.js";
import { normalizedSpecKey, specHasValue } from "./content-gaps-source.js";
import type { DescriptionCoverageInput } from "./description-coverage.js";

export type SpecificationImprovementException = {
  readonly id: string;
  readonly fingerprint: string;
  readonly reviewedBy: string;
  readonly reviewedAt: string;
  readonly rationale: string;
  readonly evidence: string;
};
export type SpecificationImprovementExceptionRegistry = {
  readonly version: 1;
  readonly exceptions: readonly SpecificationImprovementException[];
};
export type SpecificationImprovementCase = {
  readonly id: string;
  readonly fingerprint: string;
  readonly providerId: string;
  readonly reference: string | null;
  readonly url: string;
  readonly title: string | null;
  readonly priority: TechnicalPriority | "P3";
  readonly family: string | null;
  readonly field: string;
  readonly kind: "cobertura" | "diferenciacion";
  readonly technicalCount: number;
  readonly missingToTarget: number;
  readonly status: "pendiente" | "exceptuado";
  readonly evidence?: { readonly kind: "cohorte" | "mismo_modelo"; readonly observed: number; readonly comparable: number };
};
export type SpecificationImprovementFamily = {
  readonly name: string;
  readonly priority: TechnicalPriority;
  readonly products: number;
  readonly pending: number;
  readonly coverage: number;
  readonly differentiation: number;
};
export type SpecificationImprovementCampaign = {
  readonly providerId: string;
  readonly family: string;
  readonly priority: TechnicalPriority | "P3";
  readonly field: string;
  readonly kind: SpecificationImprovementCase["kind"];
  readonly pending: number;
  readonly references: readonly string[];
};
export type SpecificationImprovementAudit = {
  readonly note: string;
  readonly criteria: {
    readonly minimumTechnicalSpecs: number;
    readonly minimumComparable: number;
    readonly minimumObserved: number;
    readonly minimumCoveragePercent: number;
    readonly minimumSameModelPeers: number;
  };
  readonly totals: {
    readonly products: number;
    readonly analyzedPriorityFamilies: number;
    readonly coveragePending: number;
    readonly differentiationPending: number;
    readonly totalPending: number;
    readonly controlledExceptions: number;
    readonly staleExceptions: number;
    readonly priorityP1: number;
    readonly priorityP2: number;
    readonly priorityP3: number;
  };
  readonly families: readonly SpecificationImprovementFamily[];
  readonly campaigns: readonly SpecificationImprovementCampaign[];
  readonly cases: readonly SpecificationImprovementCase[];
  readonly staleExceptions: readonly SpecificationImprovementException[];
};

type AnalyzedProduct = {
  readonly input: DescriptionCoverageInput;
  readonly identity: string;
  readonly family: PriorityTechnicalFamily | null;
  readonly keys: readonly string[];
  readonly model: string | null;
  readonly technicalCount: number;
  readonly fingerprint: string;
};

const MIN_COMPARABLE = 3;
const MIN_OBSERVED = 2;
const MIN_COVERAGE_PERCENT = 60;
const MIN_SAME_MODEL_PEERS = 2;
const digest = (value: string): string => createHash("sha256").update(value).digest("hex");
const compare = (a: string, b: string): number => a < b ? -1 : a > b ? 1 : 0;
const priorityOrder = { P1: 0, P2: 1, P3: 2 } as const;
const nonempty = (value: unknown): value is string => typeof value === "string" && value.trim() !== "" && value === value.trim();
const record = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);

export const parseSpecificationImprovementExceptions = (raw: unknown): SpecificationImprovementExceptionRegistry => {
  if (!record(raw) || raw.version !== 1 || !Array.isArray(raw.exceptions)) {
    throw new Error("Registro de excepciones de specs incompatible");
  }
  const exceptions: SpecificationImprovementException[] = [];
  const unique = new Set<string>();
  for (const item of raw.exceptions) {
    if (!record(item) || !nonempty(item.id) || !nonempty(item.fingerprint) ||
      !/^[a-f0-9]{64}$/u.test(item.fingerprint) || !nonempty(item.reviewedBy) ||
      !nonempty(item.reviewedAt) || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/u.test(item.reviewedAt) ||
      !Number.isFinite(Date.parse(item.reviewedAt)) || !nonempty(item.rationale) || !nonempty(item.evidence)) {
      throw new Error("Excepción técnica sin identidad, revisión o evidencia válida");
    }
    if (unique.has(item.id)) throw new Error(`Excepción técnica duplicada: ${item.id}`);
    unique.add(item.id);
    exceptions.push({ id: item.id, fingerprint: item.fingerprint, reviewedBy: item.reviewedBy,
      reviewedAt: item.reviewedAt, rationale: item.rationale, evidence: item.evidence });
  }
  return { version: 1, exceptions };
};

const modelIdentity = (input: DescriptionCoverageInput): string | null => {
  const brand = input.source.brand ?? input.published.spec.Marca;
  const model = input.source.model ?? input.published.spec.Modelo;
  if (typeof brand !== "string" || typeof model !== "string" || !brand.trim() || !model.trim()) return null;
  return JSON.stringify([input.source.providerId, fold(brand), fold(model)]);
};

export const analyzeSpecificationImprovement = (
  inputs: readonly DescriptionCoverageInput[], registry: SpecificationImprovementExceptionRegistry,
  density: TechnicalDensity = analyzeTechnicalDensity(inputs.map((input) => input.published))
): SpecificationImprovementAudit => {
  const verified = parseSpecificationImprovementExceptions(registry);
  if (density.totals.products !== inputs.length) throw new Error("Poblaciones incompatibles para auditoría de specs");
  const exceptions = new Map(verified.exceptions.map((item) => [item.id, item]));
  const activeExceptions = new Set<string>();
  const cases: SpecificationImprovementCase[] = [];
  const familyState = new Map<string, { priority: TechnicalPriority; products: number; pending: number; coverage: number; differentiation: number }>();
  const seen = new Set<string>();
  const grouped = new Map<string, AnalyzedProduct[]>();
  const modelGrouped = new Map<string, AnalyzedProduct[]>();
  const products: AnalyzedProduct[] = [];
  const minimum = density.target.minimum;
  for (const input of inputs) {
    const identity = buildProductIdentity(input.source).key;
    if (seen.has(identity)) throw new Error(`Identidad duplicada en auditoría de specs: ${identity}`);
    seen.add(identity);
    const publishedIdentity = buildProductIdentity({ providerId: input.published.providerId,
      reference: input.published.reference, serialNumber: null, url: input.published.sourceUrl }).key;
    if (identity !== publishedIdentity) throw new Error(`Identidad publicada inconsistente: ${identity}`);
    const family = technicalPriorityFamily(input);
    if (family) {
      const state = familyState.get(family.name) ?? { priority: family.priority, products: 0, pending: 0, coverage: 0, differentiation: 0 };
      state.products++;
      familyState.set(family.name, state);
    }
    const count = new Set(Object.entries(input.published.spec)
      .filter(([key, value]) => isTechnicalSpecificationKey(key) && specHasValue(value))
      .map(([key]) => normalizedSpecKey(key))).size;
    const fingerprint = digest(JSON.stringify({ identity, title: input.published.title,
      specs: Object.entries(input.published.spec).sort(([a], [b]) => compare(a, b)) }));
    const current: AnalyzedProduct = { input, identity, family, keys: publishedTechnicalKeys(input.published.spec),
      model: modelIdentity(input), technicalCount: count, fingerprint };
    products.push(current);
    if (!family) continue;
    const groupKey = JSON.stringify([input.published.providerId, family.name]);
    const group = grouped.get(groupKey) ?? [];
    group.push(current);
    grouped.set(groupKey, group);
    if (current.model) {
      const peerKey = JSON.stringify([family.name, current.model]);
      const peers = modelGrouped.get(peerKey) ?? [];
      peers.push(current);
      modelGrouped.set(peerKey, peers);
    }
  }
  const add = (product: AnalyzedProduct, kind: SpecificationImprovementCase["kind"], field: string,
    missingToTarget: number, evidence?: SpecificationImprovementCase["evidence"]): void => {
    const { input, identity, family, fingerprint, technicalCount } = product;
    const id = JSON.stringify([identity, kind, field]);
    const exception = exceptions.get(id);
    const status = exception?.fingerprint === fingerprint ? "exceptuado" : "pendiente";
    if (status === "exceptuado") activeExceptions.add(id);
    if (status === "pendiente" && family) {
      const state = familyState.get(family.name);
      if (!state) throw new Error(`Familia no indexada: ${family.name}`);
      state.pending++;
      if (kind === "cobertura") state.coverage++;
      else state.differentiation++;
    }
    cases.push({ id, fingerprint, providerId: input.published.providerId, reference: input.published.reference,
      url: input.published.sourceUrl, title: input.published.title, priority: family?.priority ?? "P3",
      family: family?.name ?? null, field, kind, technicalCount, missingToTarget, status,
      ...(evidence ? { evidence } : {}) });
  };
  for (const product of products) {
    if (product.technicalCount < minimum) add(product, "cobertura", `mínimo ${minimum} specs`, minimum - product.technicalCount);
    const { family } = product;
    if (!family) continue;
    const peers = grouped.get(JSON.stringify([product.input.published.providerId, family.name])) ?? [];
    const exactModel = product.model ? (modelGrouped.get(JSON.stringify([family.name, product.model])) ?? []) : [];
    for (const essential of family.essential) {
      if (hasEssentialTechnicalSpec(product.keys, essential)) continue;
      const observed = peers.filter((peer) => hasEssentialTechnicalSpec(peer.keys, essential)).length;
      const modelObserved = exactModel.filter((peer) => peer.identity !== product.identity &&
        hasEssentialTechnicalSpec(peer.keys, essential)).length;
      const sufficientCohort = peers.length >= MIN_COMPARABLE && observed >= MIN_OBSERVED &&
        observed * 100 >= peers.length * MIN_COVERAGE_PERCENT &&
        new Set(peers.filter((peer) => hasEssentialTechnicalSpec(peer.keys, essential)).map((peer) => peer.model)
          .filter((model): model is string => model !== null)).size >= 2;
      if (modelObserved < MIN_SAME_MODEL_PEERS && !sufficientCohort) continue;
      const evidence: SpecificationImprovementCase["evidence"] = modelObserved >= MIN_SAME_MODEL_PEERS ?
        { kind: "mismo_modelo", observed: modelObserved, comparable: exactModel.length - 1 } :
        { kind: "cohorte", observed, comparable: peers.length };
      add(product, "diferenciacion", essential.label, 0, evidence);
    }
  }
  cases.sort((a, b) => Number(a.status === "exceptuado") - Number(b.status === "exceptuado") ||
    priorityOrder[a.priority] - priorityOrder[b.priority] || compare(a.family ?? "", b.family ?? "") ||
    (a.kind === "diferenciacion" ? 0 : 1) - (b.kind === "diferenciacion" ? 0 : 1) ||
    compare(a.providerId, b.providerId) || compare(a.field, b.field) ||
    compare(a.reference ?? a.url, b.reference ?? b.url));
  const pending = cases.filter((item) => item.status === "pendiente");
  const staleExceptions = verified.exceptions.filter((item) => !activeExceptions.has(item.id));
  const campaignGroups = new Map<string, { providerId: string; family: string; priority: SpecificationImprovementCase["priority"];
    field: string; kind: SpecificationImprovementCase["kind"]; pending: number; references: string[] }>();
  for (const item of pending) {
    const key = JSON.stringify([item.providerId, item.family, item.kind, item.field]);
    const group = campaignGroups.get(key) ?? { providerId: item.providerId,
      family: item.family ?? "cobertura general", priority: item.priority, field: item.field,
      kind: item.kind, pending: 0, references: [] };
    group.pending++;
    if (group.references.length < 5) group.references.push(item.reference ?? item.url);
    campaignGroups.set(key, group);
  }
  const campaigns = [...campaignGroups.values()].sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority] ||
    b.pending - a.pending || compare(a.family, b.family) || compare(a.providerId, b.providerId) || compare(a.field, b.field));
  return {
    note: "Objetivo cerrable: enriquecimiento acreditado o excepción individual revisable. La diferenciación se activa solo con respaldo de al menos dos pares del mismo modelo o cohorte de la misma subfamilia y proveedor (mínimo 3 unidades, 2 observaciones, 60 % y 2 modelos). Las alturas de trabajo, plataforma y elevación conservan su concepto: solo se constata presencia de una magnitud vertical, sin equiparar sus valores. Ninguna cifra se transfiere automáticamente entre unidades. No modifica publicaciones.",
    criteria: { minimumTechnicalSpecs: minimum, minimumComparable: MIN_COMPARABLE,
      minimumObserved: MIN_OBSERVED, minimumCoveragePercent: MIN_COVERAGE_PERCENT,
      minimumSameModelPeers: MIN_SAME_MODEL_PEERS },
    totals: {
      products: inputs.length, analyzedPriorityFamilies: [...familyState.values()].reduce((sum, item) => sum + item.products, 0),
      coveragePending: pending.filter((item) => item.kind === "cobertura").length,
      differentiationPending: pending.filter((item) => item.kind === "diferenciacion").length,
      totalPending: pending.length, controlledExceptions: cases.length - pending.length,
      staleExceptions: staleExceptions.length, priorityP1: pending.filter((item) => item.priority === "P1").length,
      priorityP2: pending.filter((item) => item.priority === "P2").length,
      priorityP3: pending.filter((item) => item.priority === "P3").length
    },
    families: [...familyState].map(([name, value]) => ({ name, ...value }))
      .sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority] || b.pending - a.pending || compare(a.name, b.name)),
    campaigns, cases, staleExceptions
  };
};
