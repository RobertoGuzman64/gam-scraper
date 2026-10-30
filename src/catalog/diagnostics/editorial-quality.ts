import { buildProductIdentity } from "../identity.js";
import type { GapInput } from "./content-gaps-types.js";

export const EDITORIAL_CRITERIA = {
  minTitleWords: 3,
  minShortWords: 10,
  maxShortWords: 45,
  minLongWords: 60,
  maxLongWords: 800,
  repeatedLongMinRecords: 3,
  repeatedLongMinModels: 2
} as const;

export type EditorialField = "title" | "description" | "description_general";
export type EditorialIssueCode =
  "titulo_ausente" | "titulo_muy_breve" | "corta_muy_breve" | "corta_demasiado_larga" |
  "general_muy_breve" | "general_desproporcionada" | "general_no_supera_corta" |
  "corta_igual_titulo" | "descripciones_iguales" | "general_repetida_entre_modelos";

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
export type EditorialAnalysis = {
  readonly criteria: typeof EDITORIAL_CRITERIA;
  readonly note: string;
  readonly lengths: EditorialMetrics;
  readonly providers: readonly EditorialProvider[];
  readonly patterns: readonly EditorialPattern[];
  readonly cases: readonly EditorialCase[];
};

type Measured = { readonly text: string; readonly words: number; readonly characters: number };
type Entry = {
  readonly input: GapInput;
  readonly identity: string;
  readonly title: Measured;
  readonly short: Measured;
  readonly long: Measured;
};

const compare = (a: string, b: string): number => a < b ? -1 : a > b ? 1 : 0;
const normalizeText = (text: string): string => text.normalize("NFKC").toLocaleLowerCase("es")
  .replace(/[^\p{L}\p{N}]+/gu, " ").trim().replace(/\s+/g, " ");
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

export const analyzeEditorialQuality = (inputs: readonly GapInput[]): EditorialAnalysis => {
  const identities = new Set<string>();
  const entries: Entry[] = inputs.map((input) => {
    const identity = buildProductIdentity(input.source).key;
    if (identities.has(identity)) throw new Error(`Identidad duplicada en auditor editorial: ${identity}`);
    if (input.source.providerId !== input.prepared.product.providerId) throw new Error(`Proveedor distinto en ${identity}`);
    identities.add(identity);
    return {
      identity, input, title: measure(input.prepared.product.title),
      short: measure(input.prepared.product.description), long: measure(input.prepared.product.description_general)
    };
  }).sort((a, b) => compare(a.identity, b.identity));

  const repeated = new Map<string, { identities: string[]; models: Set<string> }>();
  for (const item of entries) {
    if (!item.long.text) continue;
    const key = JSON.stringify([item.input.source.providerId, item.input.source.categoryKey, normalizeText(item.long.text)]);
    const cluster = repeated.get(key) ?? { identities: [], models: new Set<string>() };
    cluster.identities.push(item.identity);
    cluster.models.add(normalizeText([item.input.source.brand ?? "", item.input.source.model ?? item.input.source.title].join(" ")));
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
    const { source } = item.input;
    const list = byProvider.get(source.providerId) ?? [];
    list.push(item);
    byProvider.set(source.providerId, list);
    const key = JSON.stringify([source.providerId, source.categoryKey]);
    let group = groups.get(key);
    if (!group) {
      group = { providerId: source.providerId, categoryKey: source.categoryKey,
        category: source.categoryName, total: 0, issues: new Map() };
      groups.set(key, group);
    }
    group.total++;
    const issues: EditorialIssue[] = [];
    const { title, short, long } = item;
    if (!title.words) addIssue(issues, "titulo_ausente", "title", title);
    else if (title.words < EDITORIAL_CRITERIA.minTitleWords) addIssue(issues, "titulo_muy_breve", "title", title);
    if (short.words) {
      if (short.words < EDITORIAL_CRITERIA.minShortWords) addIssue(issues, "corta_muy_breve", "description", short);
      if (short.words > EDITORIAL_CRITERIA.maxShortWords) addIssue(issues, "corta_demasiado_larga", "description", short);
      if (title.words && normalizeText(short.text) === normalizeText(title.text)) {
        addIssue(issues, "corta_igual_titulo", "description", short);
      }
    }
    if (long.words) {
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
    }
    if (issues.length) cases.push({ identity: item.identity, providerId: source.providerId,
      categoryKey: source.categoryKey, reference: source.reference, url: source.url, issues });
    for (const issue of issues) {
      const ids = group.issues.get(issue.code) ?? [];
      ids.push(item.identity);
      group.issues.set(issue.code, ids);
    }
  }

  const patterns: EditorialPattern[] = [];
  for (const group of groups.values()) {
    for (const [code, identities] of group.issues) {
      patterns.push({ providerId: group.providerId, categoryKey: group.categoryKey,
        category: group.category, code, affected: identities.length, total: group.total,
        examples: identities.slice(0, 5) });
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
  return {
    criteria: EDITORIAL_CRITERIA,
    note: "Indicadores orientativos sobre textos preparados, no defectos confirmados ni obligación de inventar contenido. Repeticiones entre modelos requieren revisión del origen.",
    lengths: metricsOf(entries), providers, patterns, cases
  };
};
