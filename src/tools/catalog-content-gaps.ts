import { buildProductIdentity } from "../catalog/identity.js";
import type { CanonicalCatalog } from "../catalog/canonical-catalog.js";
import type { ProductRecord, SpecValue } from "../contracts/catalog.js";
import type { ImportCatalog, PreparedProduct } from "../catalog/import/preparation/contracts.js";

export type GapGroupBy = "categoria" | "marca" | "modelo";
export type GapEvidence = "directa_del_campo" | "texto_relacionado" | "especificaciones_sin_vinculo_acreditado" | "sin_evidencia_observable" | "desconocida";
export type GapField = { readonly kind: "attribute"; readonly attributeID: number; readonly name: string } |
{ readonly kind: "description" | "description_general"; readonly name: string };
export type GapObservation = {
  readonly field: GapField;
  readonly applicable: number;
  readonly present: number;
  readonly missing: number;
  readonly coveragePercent: number;
  readonly coverage: "completa" | "desigual" | "sistematica";
  readonly missingIdentities: readonly string[];
  readonly directEvidence: number;
  readonly relatedText: number;
  readonly originalSpecKeys: readonly { readonly key: string; readonly count: number }[];
};
export type GapGroup = {
  readonly providerId: string;
  readonly categorySellID: number | null;
  readonly category: string | null;
  readonly sourceCategoryKey: string | null;
  readonly comparable: boolean;
  readonly brand: string | null;
  readonly model: string | null;
  readonly identities: readonly string[];
  readonly observations: readonly GapObservation[];
};
export type GapCase = {
  readonly identity: string;
  readonly providerId: string;
  readonly reference: string | null;
  readonly url: string;
  readonly brand: string | null;
  readonly model: string | null;
  readonly categoryKey: string;
  readonly categorySellID: number | null;
  readonly status: PreparedProduct["status"];
  readonly original: {
    readonly shortDescription: string | null;
    readonly longDescription: string | null;
    readonly specs: ProductRecord["specs"];
  };
  readonly prepared: {
    readonly description: string | null;
    readonly description_general: string | null;
    readonly attributes: PreparedProduct["product"]["attributes"];
  };
  readonly gaps: readonly { readonly field: GapField; readonly evidence: GapEvidence }[];
};
export type GapUniverse = {
  readonly total: number;
  readonly providers: readonly { readonly providerId: string; readonly originals: number }[];
  readonly ready: number;
  readonly review: number;
  readonly withoutCategory: number;
  readonly note: string;
};
export type GapAnalysis = {
  readonly universe: GapUniverse;
  readonly groupBy: GapGroupBy;
  readonly groups: readonly GapGroup[];
  readonly cases: readonly GapCase[];
};
export type GapInput = {
  readonly source: ProductRecord;
  readonly prepared: PreparedProduct;
};
export type GapOptions = { readonly groupBy: GapGroupBy };

type InternalItem = GapInput & { readonly identity: string };
type InternalGroup = {
  readonly providerId: string; readonly categorySellID: number | null; readonly category: string | null;
  readonly sourceCategoryKey: string | null; readonly brand: string | null; readonly model: string | null; readonly items: InternalItem[]
};

const present = (value: string | null | undefined): boolean => typeof value === "string" && value.trim().length > 0;
const compare = (a: string, b: string): number => a < b ? -1 : a > b ? 1 : 0;
const keyOf = (field: GapField): string => field.kind === "attribute" ? `attribute:${field.attributeID}` : field.kind;
const specHasValue = (value: SpecValue): boolean => Array.isArray(value) ?
  value.some((entry) => typeof entry !== "string" || entry.trim().length > 0) :
  typeof value !== "string" || value.trim().length > 0;

const evidenceOf = (source: ProductRecord, field: GapField): GapEvidence => {
  if (field.kind === "description") {
    if (present(source.shortDescription)) return "directa_del_campo";
    if (present(source.longDescription)) return "texto_relacionado";
    return "sin_evidencia_observable";
  }
  if (field.kind === "description_general") {
    if (present(source.longDescription)) return "directa_del_campo";
    if (present(source.shortDescription)) return "texto_relacionado";
    return "sin_evidencia_observable";
  }
  if (Object.values(source.specs ?? {}).some(specHasValue)) return "especificaciones_sin_vinculo_acreditado";
  return present(source.shortDescription) || present(source.longDescription) || present(source.title) ?
    "desconocida" : "sin_evidencia_observable";
};

const groupKey = (item: GapInput, by: GapGroupBy): string => JSON.stringify([
  item.source.providerId,
  item.prepared.product.categorySellID,
  item.prepared.product.categorySellID === null ? item.source.categoryKey : null,
  by === "categoria" ? null : item.source.brand?.trim() || null,
  by === "modelo" ? item.source.model?.trim() || null : null
]);

export const analyzeCatalogContentGaps = (
  inputs: readonly GapInput[], catalog: ImportCatalog, options: GapOptions = { groupBy: "categoria" }
): GapAnalysis => {
  const grouped = new Map<string, InternalGroup>();
  const identities = new Set<string>();
  const providerCounts = new Map<string, number>();
  let ready = 0;
  let withoutCategory = 0;
  const categories = new Map(catalog.categories.map((entry) => [entry.id, entry]));
  const attributes = new Map(catalog.attributes.map((entry) => [entry.id, entry]));
  const active = new Map<number, Set<number>>();
  for (const relation of catalog.relations) {
    if (relation.actived === false || !attributes.has(relation.attributeID)) continue;
    const ids = active.get(relation.categoryID) ?? new Set<number>();
    ids.add(relation.attributeID);
    active.set(relation.categoryID, ids);
  }

  for (const input of inputs) {
    const identity = buildProductIdentity(input.source).key;
    if (identities.has(identity)) throw new Error(`Identidad duplicada en auditor: ${identity}`);
    identities.add(identity);
    if (input.source.providerId !== input.prepared.product.providerId) throw new Error(`Proveedor distinto en ${identity}`);
    if (input.prepared.product.categorySellID !== null && !categories.has(input.prepared.product.categorySellID)) {
      throw new Error(`Categoría inexistente en ${identity}`);
    }
    providerCounts.set(input.source.providerId, (providerCounts.get(input.source.providerId) ?? 0) + 1);
    if (input.prepared.status === "ready") ready++;
    if (input.prepared.product.categorySellID === null) withoutCategory++;
    const groupId = groupKey(input, options.groupBy);
    let group = grouped.get(groupId);
    if (!group) {
      const categoryID = input.prepared.product.categorySellID;
      group = {
        providerId: input.source.providerId,
        categorySellID: categoryID,
        category: categoryID === null ? null : categories.get(categoryID)?.name ?? null,
        sourceCategoryKey: categoryID === null ? input.source.categoryKey : null,
        brand: options.groupBy === "categoria" ? null : input.source.brand?.trim() || null,
        model: options.groupBy === "modelo" ? input.source.model?.trim() || null : null,
        items: []
      };
      grouped.set(groupId, group);
    }
    group.items.push({ ...input, identity });
  }

  const cases = new Map<string, GapCase>();
  const groups: GapGroup[] = [];
  for (const group of grouped.values()) {
    group.items.sort((a, b) => compare(a.identity, b.identity));
    const categoryAttributes = group.categorySellID === null ? [] :
      [...(active.get(group.categorySellID) ?? [])].sort((a, b) => a - b)
        .flatMap((attributeID): GapField[] => {
          const attribute = attributes.get(attributeID);
          return attribute ? [{ kind: "attribute", attributeID, name: attribute.name }] : [];
        });
    const fields: GapField[] = [
      { kind: "description", name: "Descripción corta" },
      { kind: "description_general", name: "Descripción general" },
      ...categoryAttributes
    ];
    const observations: GapObservation[] = [];
    for (const field of fields) {
      const missingItems = group.items.filter((item) => {
        const product = item.prepared.product;
        return field.kind === "attribute" ? !product.attributes.some((entry) =>
          entry.attributeID === field.attributeID && (typeof entry.value !== "string" || present(entry.value))) :
          !present(product[field.kind]);
      });
      const missing = missingItems.length;
      const relatedText = missingItems.filter((item) => evidenceOf(item.source, field) === "texto_relacionado").length;
      const directEvidence = missingItems.filter((item) => evidenceOf(item.source, field) === "directa_del_campo").length;
      const specCounts = new Map<string, number>();
      if (field.kind === "attribute") {
        for (const item of missingItems) {
          for (const [key, value] of Object.entries(item.source.specs ?? {})) {
            if (specHasValue(value)) specCounts.set(key, (specCounts.get(key) ?? 0) + 1);
          }
        }
      }
      const observation: GapObservation = {
        field, applicable: group.items.length, present: group.items.length - missing, missing,
        coveragePercent: Math.round((group.items.length - missing) * 10000 / group.items.length) / 100,
        coverage: missing === 0 ? "completa" : missing === group.items.length ? "sistematica" : "desigual",
        missingIdentities: missingItems.map((item) => item.identity), directEvidence, relatedText,
        originalSpecKeys: [...specCounts].map(([key, count]) => ({ key, count }))
          .sort((a, b) => b.count - a.count || compare(a.key, b.key))
      };
      observations.push(observation);
      for (const item of missingItems) {
        let entry = cases.get(item.identity);
        if (!entry) {
          entry = {
            identity: item.identity, providerId: item.source.providerId, reference: item.source.reference,
            url: item.source.url, brand: item.source.brand, model: item.source.model,
            categoryKey: item.source.categoryKey, categorySellID: item.prepared.product.categorySellID,
            status: item.prepared.status,
            original: { shortDescription: item.source.shortDescription, longDescription: item.source.longDescription, specs: item.source.specs },
            prepared: {
              description: item.prepared.product.description,
              description_general: item.prepared.product.description_general,
              attributes: item.prepared.product.attributes
            }, gaps: []
          };
          cases.set(item.identity, entry);
        }
        const gaps = [...entry.gaps, { field, evidence: evidenceOf(item.source, field) }];
        cases.set(item.identity, { ...entry, gaps });
      }
    }
    groups.push({
      providerId: group.providerId, categorySellID: group.categorySellID,
      category: group.category, sourceCategoryKey: group.sourceCategoryKey,
      comparable: group.categorySellID !== null, brand: group.brand, model: group.model,
      identities: group.items.map((item) => item.identity), observations
    });
  }
  groups.sort((a, b) => compare(JSON.stringify([a.providerId, a.categorySellID, a.sourceCategoryKey, a.brand, a.model]),
    JSON.stringify([b.providerId, b.categorySellID, b.sourceCategoryKey, b.brand, b.model])));
  return {
    universe: {
      total: inputs.length, providers: [...providerCounts].map(([providerId, originals]) => ({ providerId, originals }))
        .sort((a, b) => compare(a.providerId, b.providerId)), ready, review: inputs.length - ready, withoutCategory,
      note: "Universo: originales canónicos, incluidos excluidos; estados y normalizaciones recalculados con reglas actuales, no entregas históricas."
    },
    groupBy: options.groupBy, groups, cases: [...cases.values()].sort((a, b) => compare(a.identity, b.identity))
  };
};

export type RankedGap = { readonly group: GapGroup; readonly observation: GapObservation; readonly tier: number };
export const prioritizeCatalogGaps = (analysis: GapAnalysis, minGroup = 8, minMissing = 3): readonly RankedGap[] => {
  const patterns: RankedGap[] = [];
  for (const group of analysis.groups) {
    if (group.identities.length < minGroup) continue;
    for (const observation of group.observations) {
      if (observation.missing < minMissing) continue;
      const evidence = observation.directEvidence + observation.relatedText;
      const tier = evidence >= minMissing ? 0 : observation.coverage === "desigual" ? 1 :
        observation.originalSpecKeys.length > 0 ? 2 : 3;
      patterns.push({ group, observation, tier });
    }
  }
  return patterns.sort((a, b) => a.tier - b.tier || b.observation.missing - a.observation.missing ||
    b.observation.directEvidence + b.observation.relatedText - a.observation.directEvidence - a.observation.relatedText ||
    compare(JSON.stringify([a.group.providerId, a.group.categorySellID, a.group.brand, a.group.model, keyOf(a.observation.field)]),
      JSON.stringify([b.group.providerId, b.group.categorySellID, b.group.brand, b.group.model, keyOf(b.observation.field)])));
};
