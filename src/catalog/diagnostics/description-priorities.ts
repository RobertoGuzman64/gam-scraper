import { buildProductIdentity } from "../identity.js";
import type { EditorialAnalysis, EditorialIssueCode } from "./editorial-quality.js";
import { EDITORIAL_CRITERIA } from "./editorial-quality.js";
import { familyOf } from "./description-coverage.js";
import type { DescriptionCoverageInput } from "./description-coverage.js";

type DescriptionField = "description" | "description_general";
type Stage = "P0" | "P1" | "P2";
type Signal = "corta_ausente" | "general_ausente" | "general_muy_breve" |
  "general_desproporcionada" | "corta_demasiado_larga" |
  "general_insuficiente_en_familia" | "general_excesiva_en_familia" |
  "corta_excesiva_en_familia";
type State = "pendiente" | "resuelto" | "aparecido";

type Lengths = { readonly description: number; readonly description_general: number };
type FamilySample = {
  readonly providerId: string;
  readonly family: string;
  readonly method: string;
  readonly total: number;
  readonly shortSamples: number;
  readonly generalSamples: number;
  readonly medianShort: number | null;
  readonly medianGeneral: number | null;
};
export type DescriptionPriority = {
  readonly identity: string;
  readonly providerId: string;
  readonly reference: string | null;
  readonly url: string;
  readonly title: string | null;
  readonly origin: DescriptionCoverageInput["origin"];
  readonly family: string;
  readonly familyMethod: string;
  readonly field: DescriptionField;
  readonly signal: Signal;
  readonly stage: Stage;
  readonly state: State;
  readonly publishedWords: number;
  readonly preparedWords: number;
  readonly familyMedianWords: number | null;
  readonly familySamples: number;
  readonly evidence: string;
  readonly severity: number;
};
export type TechnicalPriority = {
  readonly identity: string;
  readonly providerId: string;
  readonly reference: string | null;
  readonly url: string;
  readonly family: string;
  readonly issues: readonly string[];
  readonly contradictions: readonly string[];
};
export type DescriptionPriorities = {
  readonly criteria: {
    readonly familyMinimumSamples: number;
    readonly generalRelativeLowRatio: number;
    readonly generalRelativeHighRatio: number;
    readonly shortRelativeHighRatio: number;
    readonly thresholds: Pick<typeof EDITORIAL_CRITERIA, "minLongWords" | "maxLongWords" | "maxShortWords">;
  };
  readonly note: string;
  readonly totals: { readonly pending: number; readonly resolved: number; readonly appeared: number; readonly technical: number;
    readonly pendingByStage: Readonly<Record<Stage, number>> };
  readonly families: readonly FamilySample[];
  readonly pending: readonly DescriptionPriority[];
  readonly resolved: readonly DescriptionPriority[];
  readonly technical: readonly TechnicalPriority[];
};

type Indexed = {
  readonly input: DescriptionCoverageInput;
  readonly identity: string;
  readonly familyId: string;
  readonly family: string;
  readonly method: string;
  readonly published: Lengths;
  readonly prepared: Lengths;
};
type FamilyAccumulator = {
  readonly providerId: string;
  readonly family: string;
  readonly method: string;
  readonly published: Record<DescriptionField, number[]>;
  readonly prepared: Record<DescriptionField, number[]>;
  total: number;
};

const FAMILY_MINIMUM_SAMPLES = 5;
const GENERAL_RELATIVE_LOW_RATIO = 0.4;
const GENERAL_RELATIVE_HIGH_RATIO = 3;
const SHORT_RELATIVE_HIGH_RATIO = 2.5;
const compare = (a: string, b: string): number => a < b ? -1 : a > b ? 1 : 0;
const countWords = (text: string | null): number => text?.trim() ? text.trim().split(/\s+/u).length : 0;
const lengths = (short: string | null, general: string | null): Lengths => ({
  description: countWords(short), description_general: countWords(general)
});
const median = (samples: readonly number[]): number | null => {
  if (samples.length === 0) return null;
  const ordered = [...samples].sort((a, b) => a - b);
  const center = Math.floor(ordered.length / 2);
  return ordered.length % 2 ? ordered[center] ?? null : ((ordered[center - 1] ?? 0) + (ordered[center] ?? 0)) / 2;
};
const fieldOf = (signal: Signal): DescriptionField => signal.startsWith("corta_") ? "description" : "description_general";
const isExtreme = (signal: Signal, words: number): boolean =>
  signal === "general_muy_breve" ? words < 20 :
    signal === "general_desproporcionada" ? words >= 2000 :
      signal === "corta_demasiado_larga" ? words >= 100 : false;
const stageOf = (signal: Signal): Stage => signal.endsWith("_ausente") ? "P0" :
  signal.endsWith("_en_familia") ? "P2" : "P1";
const severityOf = (signal: Signal, words: number, twoMissing: boolean): number => {
  if (signal.endsWith("_ausente")) return twoMissing ? 100000 : 90000;
  if (isExtreme(signal, words)) return 80000 + (signal === "general_muy_breve" ? 20 - words : Math.min(words, 20000));
  if (signal === "general_muy_breve") return 70000 + EDITORIAL_CRITERIA.minLongWords - words;
  if (signal === "general_desproporcionada") return 60000 + Math.min(words, 20000);
  if (signal === "corta_demasiado_larga") return 50000 + Math.min(words, 20000);
  return 10000 + Math.min(words, 20000);
};
const issueIndex = (analysis: EditorialAnalysis): Map<string, ReadonlySet<EditorialIssueCode>> =>
  new Map(analysis.cases.map((item) => [item.identity, new Set(item.issues.map((issue) => issue.code))]));
const evidenceOf = (input: DescriptionCoverageInput, signal: Signal, preparedWords: number): string => {
  if (signal === "general_muy_breve" || signal === "general_insuficiente_en_familia" || signal === "general_ausente") {
    const originalWords = countWords(input.source.longDescription);
    if (input.origin === "original_canonico" && originalWords > preparedWords + 20) return "original canónico con texto adicional; contrastar contenido";
    if (Object.values(input.source.specs ?? {}).some((value) => value !== null && value !== undefined && String(value).trim())) {
      return input.origin === "original_canonico" ? "especificaciones presentes; contrastar antes de ampliar" :
        "especificaciones publicadas; sin original independiente";
    }
    return "sin ampliación acreditada; requiere investigación";
  }
  if (signal === "corta_ausente") return countWords(input.source.shortDescription) > 0 && input.origin === "original_canonico" ?
    "texto corto presente en original; revisar preparación" : "requiere investigación o redacción respaldada";
  return "revisión de proporción y síntesis; conservar hechos acreditados";
};
const relativeSignals = (values: Lengths, family: FamilyAccumulator, state: "published" | "prepared"): Signal[] => {
  const samples = family[state];
  const generalMedian = samples.description_general.length >= FAMILY_MINIMUM_SAMPLES ? median(samples.description_general) : null;
  const shortMedian = samples.description.length >= FAMILY_MINIMUM_SAMPLES ? median(samples.description) : null;
  const signals: Signal[] = [];
  if (generalMedian !== null && generalMedian >= 75 && values.description_general > 0 &&
    values.description_general < generalMedian * GENERAL_RELATIVE_LOW_RATIO &&
    generalMedian - values.description_general >= 40 &&
    values.description_general >= EDITORIAL_CRITERIA.minLongWords) signals.push("general_insuficiente_en_familia");
  if (generalMedian !== null && values.description_general >= 300 &&
    values.description_general >= generalMedian * GENERAL_RELATIVE_HIGH_RATIO &&
    values.description_general - generalMedian >= 200 &&
    values.description_general <= EDITORIAL_CRITERIA.maxLongWords) signals.push("general_excesiva_en_familia");
  if (shortMedian !== null && values.description >= 35 &&
    values.description >= shortMedian * SHORT_RELATIVE_HIGH_RATIO &&
    values.description <= EDITORIAL_CRITERIA.maxShortWords) signals.push("corta_excesiva_en_familia");
  return signals;
};
const signalsFor = (identity: string, values: Lengths, index: Map<string, ReadonlySet<EditorialIssueCode>>,
  family: FamilyAccumulator, state: "published" | "prepared"): Set<Signal> => {
  const issues = index.get(identity) ?? new Set<EditorialIssueCode>();
  const signals = new Set<Signal>();
  for (const signal of ["corta_ausente", "general_ausente", "general_muy_breve",
    "general_desproporcionada", "corta_demasiado_larga"] as const) {
    if (issues.has(signal)) signals.add(signal);
  }
  for (const signal of relativeSignals(values, family, state)) signals.add(signal);
  return signals;
};
const order = (a: DescriptionPriority, b: DescriptionPriority): number => b.severity - a.severity ||
  compare(a.providerId, b.providerId) || compare(a.family, b.family) || compare(a.identity, b.identity) || compare(a.signal, b.signal);

export const analyzeDescriptionPriorities = (inputs: readonly DescriptionCoverageInput[],
  published: EditorialAnalysis, prepared: EditorialAnalysis): DescriptionPriorities => {
  const families = new Map<string, FamilyAccumulator>();
  const identities = new Set<string>();
  const indexed: Indexed[] = [];
  for (const input of inputs) {
    const identity = buildProductIdentity({ providerId: input.published.providerId, reference: input.published.reference,
      serialNumber: null, url: input.published.sourceUrl }).key;
    if (identities.has(identity)) throw new Error(`Identidad duplicada en prioridades editoriales: ${identity}`);
    identities.add(identity);
    if (identity !== buildProductIdentity(input.source).key || input.prepared.product.sourceUrl !== input.published.sourceUrl ||
      input.prepared.product.reference !== input.published.reference || input.source.url !== input.published.sourceUrl ||
      input.prepared.product.providerId !== input.published.providerId) {
      throw new Error(`Identidad discordante en prioridades editoriales: ${identity}`);
    }
    const { family, method } = familyOf(input);
    const familyId = JSON.stringify([input.published.providerId, family]);
    const group = families.get(familyId) ?? { providerId: input.published.providerId, family, method,
      published: { description: [], description_general: [] }, prepared: { description: [], description_general: [] }, total: 0 };
    const previous = lengths(input.published.description, input.published.description_general);
    const current = lengths(input.prepared.product.description, input.prepared.product.description_general);
    group.total++;
    for (const field of ["description", "description_general"] as const) {
      if (previous[field]) group.published[field].push(previous[field]);
      if (current[field]) group.prepared[field].push(current[field]);
    }
    families.set(familyId, group);
    indexed.push({ input, identity, familyId, family, method, published: previous, prepared: current });
  }
  const publishedIndex = issueIndex(published);
  const preparedIndex = issueIndex(prepared);
  const pending: DescriptionPriority[] = [];
  const resolved: DescriptionPriority[] = [];
  const technical: TechnicalPriority[] = [];
  for (const item of indexed) {
    const group = families.get(item.familyId);
    if (!group) throw new Error(`Familia no encontrada: ${item.familyId}`);
    const prior = signalsFor(item.identity, item.published, publishedIndex, group, "published");
    const current = signalsFor(item.identity, item.prepared, preparedIndex, group, "prepared");
    const twoMissing = item.prepared.description === 0 && item.prepared.description_general === 0;
    for (const signal of new Set([...prior, ...current])) {
      const field = fieldOf(signal);
      const exists = current.has(signal);
      const state: State = !exists ? "resuelto" : prior.has(signal) ? "pendiente" : "aparecido";
      const words = item.prepared[field];
      const sample = group.prepared[field];
      const value: DescriptionPriority = {
        identity: item.identity, providerId: item.input.published.providerId, reference: item.input.published.reference,
        url: item.input.published.sourceUrl, title: item.input.published.title, origin: item.input.origin,
        family: item.family, familyMethod: item.method, field, signal, stage: stageOf(signal), state,
        publishedWords: item.published[field], preparedWords: words,
        familyMedianWords: sample.length >= FAMILY_MINIMUM_SAMPLES ? median(sample) : null,
        familySamples: sample.length, evidence: evidenceOf(item.input, signal, words),
        severity: severityOf(signal, exists ? words : item.published[field], twoMissing)
      };
      (exists ? pending : resolved).push(value);
    }
    if (item.input.prepared.issues.length > 0) {
      technical.push({ identity: item.identity, providerId: item.input.published.providerId,
        reference: item.input.published.reference, url: item.input.published.sourceUrl, family: item.family,
        issues: item.input.prepared.issues,
        contradictions: item.input.prepared.issues.filter((issue) => /contradic|conflict|incompatible/iu.test(issue)) });
    }
  }
  pending.sort(order);
  resolved.sort(order);
  technical.sort((a, b) => b.contradictions.length - a.contradictions.length || compare(a.identity, b.identity));
  return {
    criteria: { familyMinimumSamples: FAMILY_MINIMUM_SAMPLES, generalRelativeLowRatio: GENERAL_RELATIVE_LOW_RATIO,
      generalRelativeHighRatio: GENERAL_RELATIVE_HIGH_RATIO, shortRelativeHighRatio: SHORT_RELATIVE_HIGH_RATIO,
      thresholds: { minLongWords: EDITORIAL_CRITERIA.minLongWords, maxLongWords: EDITORIAL_CRITERIA.maxLongWords,
        maxShortWords: EDITORIAL_CRITERIA.maxShortWords } },
    note: "Prioridades editoriales orientativas: los umbrales no obligan a igualar longitudes. La comparación familiar exige muestras suficientes y no prueba datos técnicos. Las incidencias de preparación se presentan aparte, sin atribuir automáticamente un error a la fuente.",
    totals: { pending: pending.length, resolved: resolved.length, appeared: pending.filter((item) => item.state === "aparecido").length,
      technical: technical.length, pendingByStage: { P0: pending.filter((item) => item.stage === "P0").length,
        P1: pending.filter((item) => item.stage === "P1").length, P2: pending.filter((item) => item.stage === "P2").length } },
    families: [...families.values()].map((group) => ({ providerId: group.providerId, family: group.family,
      method: group.method, total: group.total, shortSamples: group.prepared.description.length,
      generalSamples: group.prepared.description_general.length, medianShort: median(group.prepared.description),
      medianGeneral: median(group.prepared.description_general) })).sort((a, b) => compare(a.providerId, b.providerId) || compare(a.family, b.family)),
    pending, resolved, technical
  };
};
