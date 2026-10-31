import { buildProductIdentity } from "../identity.js";
import { normalizedSpecKey, specHasValue } from "./content-gaps-source.js";
import { familyOf } from "./description-coverage.js";
import type { DescriptionCoverageInput } from "./description-coverage.js";
import type { SpecValue } from "../../contracts/catalog.js";

type Stage = "pendiente_publicacion" | "diferencia_origen_preparacion" | "perdida_tras_publicacion" | "sin_evidencia_directa" | "normalizacion_ambigua";
type SpecMap = Readonly<Record<string, SpecValue>>;
type Indexed = {
  readonly input: DescriptionCoverageInput;
  readonly identity: string;
  readonly family: string;
  readonly original: ReadonlySet<string>;
  readonly prepared: ReadonlySet<string>;
  readonly published: ReadonlySet<string>;
  readonly ambiguous: ReadonlySet<string>;
};
type Group = { readonly providerId: string; readonly family: string; readonly origin: DescriptionCoverageInput["origin"]; readonly items: Indexed[] };
export type SpecificationCase = {
  readonly identity: string;
  readonly providerId: string;
  readonly reference: string | null;
  readonly url: string;
  readonly family: string;
  readonly origin: DescriptionCoverageInput["origin"];
  readonly key: string;
  readonly stage: Stage;
};
export type SpecificationPattern = {
  readonly providerId: string;
  readonly family: string;
  readonly origin: DescriptionCoverageInput["origin"];
  readonly key: string;
  readonly comparable: number;
  readonly observed: number;
  readonly prepared: number;
  readonly published: number;
  readonly missingPrepared: number;
  readonly missingPublished: number;
  readonly examples: readonly string[];
};
export type SpecificationCoverage = {
  readonly note: string;
  readonly criteria: { readonly minimumFamily: number; readonly minimumObserved: number; readonly minimumCoveragePercent: number };
  readonly totals: {
    readonly products: number;
    readonly canonicalOriginals: number;
    readonly reconstructedSources: number;
    readonly pendingPublication: number;
    readonly sourceNotPreserved: number;
    readonly lostAfterPublication: number;
    readonly ambiguousNormalization: number;
    readonly observationalMissing: number;
  };
  readonly patterns: readonly SpecificationPattern[];
  readonly cases: readonly SpecificationCase[];
};

const compare = (a: string, b: string): number => a < b ? -1 : a > b ? 1 : 0;
const MIN_FAMILY = 5;
const MIN_OBSERVED = 3;
const MIN_PERCENT = 60;
const normalizeValues = (specs: SpecMap): { keys: ReadonlySet<string>; ambiguous: ReadonlySet<string> } => {
  const values = new Map<string, Set<string>>();
  for (const [name, value] of Object.entries(specs)) {
    if (!specHasValue(value)) continue;
    const key = normalizedSpecKey(name);
    if (!key) continue;
    const representations = values.get(key) ?? new Set<string>();
    representations.add(JSON.stringify(value));
    values.set(key, representations);
  }
  return {
    keys: new Set(values.keys()),
    ambiguous: new Set([...values].filter(([, representations]) => representations.size > 1).map(([key]) => key))
  };
};

export const analyzeSpecificationCoverage = (inputs: readonly DescriptionCoverageInput[]): SpecificationCoverage => {
  const grouped = new Map<string, Group>();
  const seen = new Set<string>();
  const cases: SpecificationCase[] = [];
  const patterns: SpecificationPattern[] = [];
  let canonicalOriginals = 0;
  let reconstructedSources = 0;
  for (const input of inputs) {
    const identity = buildProductIdentity(input.source).key;
    if (seen.has(identity)) throw new Error(`Identidad duplicada en auditor técnico: ${identity}`);
    seen.add(identity);
    const publishedIdentity = buildProductIdentity({ providerId: input.published.providerId,
      reference: input.published.reference, serialNumber: null, url: input.published.sourceUrl }).key;
    if (identity !== publishedIdentity || input.prepared.product.providerId !== input.source.providerId ||
      input.prepared.product.sourceUrl !== input.published.sourceUrl || input.prepared.product.reference !== input.published.reference) {
      throw new Error(`Identidad inconsistente en auditor técnico: ${identity}`);
    }
    if (input.origin === "original_canonico") canonicalOriginals++;
    else reconstructedSources++;
    const family = familyOf(input).family;
    const groupKey = JSON.stringify([input.source.providerId, family, input.origin]);
    let group = grouped.get(groupKey);
    if (!group) {
      group = { providerId: input.source.providerId, family, origin: input.origin, items: [] };
      grouped.set(groupKey, group);
    }
    const original = normalizeValues(input.source.specs ?? {});
    const prepared = normalizeValues(input.prepared.product.spec);
    const published = normalizeValues(input.published.spec);
    group.items.push({ input, identity, family, original: original.keys, prepared: prepared.keys,
      published: published.keys, ambiguous: new Set([...original.ambiguous, ...prepared.ambiguous, ...published.ambiguous]) });
  }
  for (const group of grouped.values()) {
    group.items.sort((a, b) => compare(a.identity, b.identity));
    const keys = new Set(group.items.flatMap((item) => [...item.original, ...item.prepared, ...item.published]));
    for (const key of [...keys].sort(compare)) {
      const observed = group.items.filter((item) => item.original.has(key) || item.prepared.has(key) || item.published.has(key)).length;
      const comparable = group.items.length >= MIN_FAMILY && observed >= MIN_OBSERVED && observed * 100 >= group.items.length * MIN_PERCENT;
      const missing: Indexed[] = [];
      let preparedCount = 0;
      let publishedCount = 0;
      for (const item of group.items) {
        const inSource = item.original.has(key);
        const inPrepared = item.prepared.has(key);
        const inPublished = item.published.has(key);
        if (inPrepared) preparedCount++;
        if (inPublished) publishedCount++;
        let stage: Stage | null = null;
        if (item.ambiguous.has(key)) stage = "normalizacion_ambigua";
        else if (inSource && !inPrepared && item.input.origin === "original_canonico") stage = "diferencia_origen_preparacion";
        else if (inPrepared && !inPublished) stage = "pendiente_publicacion";
        else if (inPublished && !inPrepared) stage = "perdida_tras_publicacion";
        else if (!inPrepared && !inPublished && !inSource && comparable) stage = "sin_evidencia_directa";
        if (!stage) continue;
        missing.push(item);
        cases.push({ identity: item.identity, providerId: group.providerId, reference: item.input.source.reference,
          url: item.input.source.url, family: group.family, origin: group.origin, key, stage });
      }
      if (comparable && missing.length > 0) {
        patterns.push({ providerId: group.providerId, family: group.family, origin: group.origin, key,
          comparable: group.items.length, observed, prepared: preparedCount, published: publishedCount,
          missingPrepared: group.items.length - preparedCount, missingPublished: group.items.length - publishedCount,
          examples: missing.slice(0, 5).map((item) => item.input.source.reference ?? item.identity) });
      }
    }
  }
  const stages: readonly Stage[] = ["diferencia_origen_preparacion", "perdida_tras_publicacion", "normalizacion_ambigua", "pendiente_publicacion", "sin_evidencia_directa"];
  cases.sort((a, b) => stages.indexOf(a.stage) - stages.indexOf(b.stage) ||
    compare(a.providerId, b.providerId) || compare(a.family, b.family) || compare(a.key, b.key) || compare(a.identity, b.identity));
  patterns.sort((a, b) => b.missingPrepared - a.missingPrepared || b.missingPublished - a.missingPublished ||
    compare(a.providerId, b.providerId) || compare(a.family, b.family) || compare(a.key, b.key));
  const count = (stage: Stage): number => cases.filter((item) => item.stage === stage).length;
  return {
    note: "Cobertura observada, no atributos obligatorios. Diferencia entre origen y preparación no implica un fallo: puede corresponder a una reconciliación acreditada. Las fuentes reconstruidas de publicaciones no acreditan recuperación desde un original independiente. Las claves equivalentes se agrupan sin transferir valores entre fichas.",
    criteria: { minimumFamily: MIN_FAMILY, minimumObserved: MIN_OBSERVED, minimumCoveragePercent: MIN_PERCENT },
    totals: { products: inputs.length, canonicalOriginals, reconstructedSources,
      pendingPublication: count("pendiente_publicacion"), sourceNotPreserved: count("diferencia_origen_preparacion"),
      lostAfterPublication: count("perdida_tras_publicacion"), ambiguousNormalization: count("normalizacion_ambigua"),
      observationalMissing: count("sin_evidencia_directa") },
    patterns, cases
  };
};
