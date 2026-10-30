import { buildProductIdentity } from "../identity.js";
import type { ImportCandidate } from "../legacy-export/contracts.js";
import type { GapInput } from "./content-gaps-types.js";

export const EDITORIAL_CRITERIA = {
  minTitleWords: 3,
  minShortWords: 10,
  maxShortWords: 45,
  minLongWords: 60,
  maxLongWords: 800,
  repeatedLongMinRecords: 3,
  repeatedLongMinModels: 2,
  modelMinCharacters: 4,
  telegraphicMinWords: 12,
  telegraphicMaxWords: 80,
  telegraphicUppercaseRatio: 0.75,
  telegraphicMaxSentenceMarks: 2,
  repeatedPassageWords: 12,
  repeatedPassageMinOccurrences: 3,
  repeatedPassageMinLongWords: 150,
  longestDescriptionsLimit: 50
} as const;

export type EditorialField = "title" | "description" | "description_general";
export type EditorialIssueCode =
  "titulo_ausente" | "titulo_muy_breve" | "corta_ausente" | "corta_muy_breve" | "corta_demasiado_larga" |
  "general_ausente" | "general_muy_breve" | "general_desproporcionada" | "general_no_supera_corta" |
  "corta_igual_titulo" | "descripciones_iguales" | "general_repetida_entre_modelos" |
  "general_sin_modelo" | "general_telegrafica" | "general_repeticion_interna";

export type EditorialLengthStats = {
  readonly present: number;
  readonly missing: number;
  readonly words: { readonly min: number | null; readonly median: number | null; readonly p90: number | null; readonly max: number | null };
  readonly characters: { readonly min: number | null; readonly median: number | null; readonly p90: number | null; readonly max: number | null };
};

export type EditorialMetrics = Readonly<Record<EditorialField, EditorialLengthStats>>;
export type EditorialIssue = {
  readonly code: EditorialIssueCode;
  readonly field: EditorialField;
  readonly words: number;
  readonly characters: number;
  readonly preview: string;
};
export type EditorialCase = {
  readonly identity: string;
  readonly providerId: string;
  readonly categoryKey: string;
  readonly reference: string | null;
  readonly url: string;
  readonly issues: readonly EditorialIssue[];
};
export type EditorialPattern = {
  readonly providerId: string;
  readonly categoryKey: string;
  readonly category: string;
  readonly code: EditorialIssueCode;
  readonly affected: number;
  readonly total: number;
  readonly examples: readonly string[];
};
export type EditorialProvider = {
  readonly providerId: string;
  readonly total: number;
  readonly lengths: EditorialMetrics;
  readonly findings: Readonly<Partial<Record<EditorialIssueCode, number>>>;
};
export type EditorialLongest = {
  readonly identity: string;
  readonly providerId: string;
  readonly reference: string | null;
  readonly url: string;
  readonly title: string;
  readonly words: number;
  readonly characters: number;
  readonly preview: string;
};
export type EditorialAnalysis = {
  readonly criteria: typeof EDITORIAL_CRITERIA;
  readonly note: string;
  readonly lengths: EditorialMetrics;
  readonly providers: readonly EditorialProvider[];
  readonly patterns: readonly EditorialPattern[];
  readonly cases: readonly EditorialCase[];
  readonly longestGeneral: readonly EditorialLongest[];
};

type Measured = { readonly text: string; readonly words: number; readonly characters: number };
type Entry = {
  readonly identity: string;
  readonly providerId: string;
  readonly categoryKey: string;
  readonly categoryName: string;
  readonly reference: string | null;
  readonly url: string;
  readonly model: string | null;
  readonly title: Measured;
  readonly short: Measured;
  readonly long: Measured;
};

const compare = (a: string, b: string): number => a < b ? -1 : a > b ? 1 : 0;
const normalizeText = (text: string): string => text.normalize("NFKC").toLocaleLowerCase("es")
  .replace(/[^\p{L}\p{N}]+/gu, " ").trim().replace(/\s+/g, " ");
const compact = (text: string): string => normalizeText(text).replace(/\s/g, "");
const measure = (value: string | null | undefined): Measured => {
  const text = (value ?? "").replace(/\s+/g, " ").trim();
  return { text, words: text ? text.split(" ").length : 0, characters: [...text].length };
};
const quantiles = (values: readonly number[]): EditorialLengthStats["words"] => {
  if (values.length === 0) return { min: null, median: null, p90: null, max: null };
  const sorted = [...values].sort((a, b) => a - b);
  const pick = (fraction: number): number => sorted[Math.ceil(fraction * sorted.length) - 1] ?? 0;
  const middle = Math.floor(sorted.length / 2);
  const median = sorted.length % 2 === 1 ? sorted[middle] ?? 0 :
    ((sorted[middle - 1] ?? 0) + (sorted[middle] ?? 0)) / 2;
  return { min: sorted[0] ?? null, median, p90: pick(0.9), max: sorted[sorted.length - 1] ?? null };
};
const lengthStats = (values: readonly Measured[]): EditorialLengthStats => {
  const present = values.filter((value) => value.characters > 0);
  return {
    present: present.length,
    missing: values.length - present.length,
    words: quantiles(present.map((value) => value.words)),
    characters: quantiles(present.map((value) => value.characters))
  };
};
const metricsOf = (entries: readonly Entry[]): EditorialMetrics => ({
  title: lengthStats(entries.map((item) => item.title)),
  description: lengthStats(entries.map((item) => item.short)),
  description_general: lengthStats(entries.map((item) => item.long))
});
const addIssue = (list: EditorialIssue[], code: EditorialIssueCode, field: EditorialField, value: Measured): void => {
  list.push({ code, field, words: value.words, characters: value.characters, preview: value.text.slice(0, 180) });
};

const lacksModel = (long: Measured, model: string | null): boolean => {
  if (!model || !long.text) return false;
  const target = compact(model);
  return target.length >= EDITORIAL_CRITERIA.modelMinCharacters && /\d/.test(target) && !compact(long.text).includes(target);
};
const isTelegraphic = (long: Measured): boolean => {
  if (long.words < EDITORIAL_CRITERIA.telegraphicMinWords ||
    long.words > EDITORIAL_CRITERIA.telegraphicMaxWords) return false;
  const letters = [...long.text].filter((char) => /\p{L}/u.test(char));
  return letters.length > 0 && letters.filter((char) => char === char.toLocaleUpperCase("es")).length / letters.length >=
    EDITORIAL_CRITERIA.telegraphicUppercaseRatio &&
    (long.text.match(/[.!?]/g)?.length ?? 0) <= EDITORIAL_CRITERIA.telegraphicMaxSentenceMarks;
};
const repeatsPassage = (long: Measured): boolean => {
  if (long.words < EDITORIAL_CRITERIA.repeatedPassageMinLongWords) return false;
  const tokens = normalizeText(long.text).split(" ");
  const size = EDITORIAL_CRITERIA.repeatedPassageWords;
  const positions = new Map<string, number[]>();
  for (let index = 0; index <= tokens.length - size; index++) {
    const phrase = tokens.slice(index, index + size).join(" ");
    const starts = positions.get(phrase) ?? [];
    if (starts.length === 0 || index - (starts[starts.length - 1] ?? 0) >= size) starts.push(index);
    if (starts.length >= EDITORIAL_CRITERIA.repeatedPassageMinOccurrences) return true;
    positions.set(phrase, starts);
  }
  return false;
};

const analyze = (source: readonly Entry[]): EditorialAnalysis => {
  const identities = new Set<string>();
  const entries = [...source].sort((a, b) => compare(a.identity, b.identity));
  for (const entry of entries) {
    if (identities.has(entry.identity)) throw new Error(`Identidad duplicada en auditor editorial: ${entry.identity}`);
    identities.add(entry.identity);
  }
  const repeated = new Map<string, { identities: string[]; models: Set<string> }>();
  for (const item of entries) {
    if (!item.long.text) continue;
    const key = JSON.stringify([item.providerId, item.categoryKey, normalizeText(item.long.text)]);
    const cluster = repeated.get(key) ?? { identities: [], models: new Set<string>() };
    cluster.identities.push(item.identity);
    cluster.models.add(normalizeText(item.model ?? item.title.text));
    repeated.set(key, cluster);
  }
  const reused = new Set<string>();
  for (const cluster of repeated.values()) {
    if (cluster.identities.length >= EDITORIAL_CRITERIA.repeatedLongMinRecords &&
      cluster.models.size >= EDITORIAL_CRITERIA.repeatedLongMinModels) {
      for (const identity of cluster.identities) reused.add(identity);
    }
  }

  const cases: EditorialCase[] = [];
  const groups = new Map<string, { providerId: string; categoryKey: string; category: string; total: number;
    issues: Map<EditorialIssueCode, string[]> }>();
  const byProvider = new Map<string, Entry[]>();
  for (const item of entries) {
    const list = byProvider.get(item.providerId) ?? [];
    list.push(item);
    byProvider.set(item.providerId, list);
    const key = JSON.stringify([item.providerId, item.categoryKey]);
    let group = groups.get(key);
    if (!group) {
      group = { providerId: item.providerId, categoryKey: item.categoryKey,
        category: item.categoryName, total: 0, issues: new Map() };
      groups.set(key, group);
    }
    group.total++;
    const issues: EditorialIssue[] = [];
    const { title, short, long } = item;
    if (!title.words) addIssue(issues, "titulo_ausente", "title", title);
    else if (title.words < EDITORIAL_CRITERIA.minTitleWords) addIssue(issues, "titulo_muy_breve", "title", title);
    if (!short.words) addIssue(issues, "corta_ausente", "description", short);
    else {
      if (short.words < EDITORIAL_CRITERIA.minShortWords) addIssue(issues, "corta_muy_breve", "description", short);
      if (short.words > EDITORIAL_CRITERIA.maxShortWords) addIssue(issues, "corta_demasiado_larga", "description", short);
      if (title.words && normalizeText(short.text) === normalizeText(title.text)) {
        addIssue(issues, "corta_igual_titulo", "description", short);
      }
    }
    if (!long.words) addIssue(issues, "general_ausente", "description_general", long);
    else {
      if (long.words < EDITORIAL_CRITERIA.minLongWords) addIssue(issues, "general_muy_breve", "description_general", long);
      if (long.words > EDITORIAL_CRITERIA.maxLongWords) addIssue(issues, "general_desproporcionada", "description_general", long);
      if (short.words) {
        if (normalizeText(short.text) === normalizeText(long.text)) {
          addIssue(issues, "descripciones_iguales", "description_general", long);
        } else if (long.words <= short.words) {
          addIssue(issues, "general_no_supera_corta", "description_general", long);
        }
      }
      if (reused.has(item.identity)) addIssue(issues, "general_repetida_entre_modelos", "description_general", long);
      if (lacksModel(long, item.model)) addIssue(issues, "general_sin_modelo", "description_general", long);
      if (isTelegraphic(long)) addIssue(issues, "general_telegrafica", "description_general", long);
      if (repeatsPassage(long)) addIssue(issues, "general_repeticion_interna", "description_general", long);
    }
    if (issues.length) cases.push({ identity: item.identity, providerId: item.providerId,
      categoryKey: item.categoryKey, reference: item.reference, url: item.url, issues });
    for (const issue of issues) {
      const ids = group.issues.get(issue.code) ?? [];
      ids.push(item.identity);
      group.issues.set(issue.code, ids);
    }
  }

  const patterns: EditorialPattern[] = [];
  for (const group of groups.values()) {
    for (const [code, groupIdentities] of group.issues) {
      patterns.push({ providerId: group.providerId, categoryKey: group.categoryKey,
        category: group.category, code, affected: groupIdentities.length, total: group.total,
        examples: groupIdentities.slice(0, 5) });
    }
  }
  patterns.sort((a, b) => b.affected - a.affected || compare(a.providerId, b.providerId) ||
    compare(a.categoryKey, b.categoryKey) || compare(a.code, b.code));
  const providers: EditorialProvider[] = [...byProvider].sort(([a], [b]) => compare(a, b)).map(([providerId, providerEntries]) => {
    const findings: Partial<Record<EditorialIssueCode, number>> = {};
    for (const entry of cases.filter((record) => record.providerId === providerId)) {
      for (const issue of entry.issues) findings[issue.code] = (findings[issue.code] ?? 0) + 1;
    }
    return { providerId, total: providerEntries.length, lengths: metricsOf(providerEntries), findings };
  });
  const longestGeneral: EditorialLongest[] = entries.filter((item) => item.long.words > 0)
    .sort((a, b) => b.long.words - a.long.words || b.long.characters - a.long.characters || compare(a.identity, b.identity))
    .slice(0, EDITORIAL_CRITERIA.longestDescriptionsLimit)
    .map((item) => ({ identity: item.identity, providerId: item.providerId, reference: item.reference,
      url: item.url, title: item.title.text, words: item.long.words,
      characters: item.long.characters, preview: item.long.text.slice(0, 180) }));
  return {
    criteria: EDITORIAL_CRITERIA,
    note: "Señales orientativas, no defectos confirmados. La ausencia del modelo es literal (puede haber variantes de escritura); los bloques repetidos y textos telegráficos requieren revisión editorial. No se rellena ni modifica ninguna ficha.",
    lengths: metricsOf(entries), providers, patterns, cases, longestGeneral
  };
};

export const analyzeEditorialQuality = (inputs: readonly GapInput[]): EditorialAnalysis => analyze(inputs.map(({ source, prepared }) => {
  const identity = buildProductIdentity(source).key;
  if (source.providerId !== prepared.product.providerId) throw new Error(`Proveedor distinto en ${identity}`);
  return {
    identity, providerId: source.providerId, categoryKey: source.categoryKey, categoryName: source.categoryName,
    reference: source.reference, url: source.url, model: source.model,
    title: measure(prepared.product.title), short: measure(prepared.product.description),
    long: measure(prepared.product.description_general)
  };
}));

export const analyzePublishedEditorialQuality = (products: readonly ImportCandidate[]): EditorialAnalysis => analyze(products.map((product) => ({
  identity: buildProductIdentity({ providerId: product.providerId, reference: product.reference,
    serialNumber: null, url: product.sourceUrl }).key,
  providerId: product.providerId, categoryKey: product.category ?? "", categoryName: product.category ?? "Sin categoría",
  reference: product.reference, url: product.sourceUrl,
  model: typeof product.spec["Modelo"] === "string" ? product.spec["Modelo"] : null,
  title: measure(product.title), short: measure(product.description), long: measure(product.description_general)
})));
