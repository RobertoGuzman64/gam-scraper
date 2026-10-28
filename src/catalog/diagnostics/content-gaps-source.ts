import { buildProductIdentity } from "../identity.js";
import { SPEC_KEY_NORMALIZATION } from "../normalization/spec-rules.js";
import { fold } from "../preparation/mapping/category-utils.js";
import type { CanonicalCatalog } from "../canonical-catalog.js";
import type { ProductRecord, SpecValue } from "../../contracts/catalog.js";
import type { ImportCatalog } from "../legacy-export/contracts.js";
import type { PreparedProduct } from "../preparation/contracts.js";

import type { GapField, GapEvidence, GapInput, GapGroupBy, GapGroup, GapObservation, GapAnalysis, GapOptions, GapCase, InternalGroup } from "./content-gaps-types.js";
export const present = (value: string | null | undefined): boolean => typeof value === "string" && value.trim().length > 0;
export const compare = (a: string, b: string): number => a < b ? -1 : a > b ? 1 : 0;
export const keyOf = (field: GapField): string => field.kind === "attribute" ? `attribute:${field.attributeID}` :
  field.kind === "spec" ? `spec:${field.key}` : field.kind;
export const normalizedSpecKey = (key: string): string => SPEC_KEY_NORMALIZATION[fold(key)] ?? key.trim();
export const specHasValue = (value: SpecValue): boolean => Array.isArray(value) ?
  value.some((entry) => typeof entry !== "string" || entry.trim().length > 0) :
  typeof value !== "string" || value.trim().length > 0;

export const evidenceOf = (source: ProductRecord, field: GapField): GapEvidence => {
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
  if (field.kind === "spec") {
    const normalized = field.key.toLocaleLowerCase("es");
    const text = `${source.shortDescription ?? ""} ${source.longDescription ?? ""}`.toLocaleLowerCase("es");
    if (text.includes(normalized)) return "texto_relacionado";
  }
  if (Object.values(source.specs ?? {}).some(specHasValue)) return "especificaciones_sin_vinculo_acreditado";
  return present(source.shortDescription) || present(source.longDescription) || present(source.title) ?
    "desconocida" : "sin_evidencia_observable";
};

export const groupKey = (item: GapInput, by: GapGroupBy): string => JSON.stringify([
  item.source.providerId,
  item.prepared.product.categorySellID,
  item.prepared.product.categorySellID === null ? item.source.categoryKey : null,
  by === "categoria" ? null : item.source.brand?.trim() || null,
  by === "modelo" ? item.source.model?.trim() || null : null
]);

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

export const analyzeSourceContentGaps = (
  inputs: readonly GapInput[], options: GapOptions = { groupBy: "categoria" }
): GapAnalysis => {
  const grouped = new Map<string, InternalGroup>();
  const identities = new Set<string>();
  const providerCounts = new Map<string, number>();
  let ready = 0;
  let withoutCategory = 0;
  for (const input of inputs) {
    const identity = buildProductIdentity(input.source).key;
    if (identities.has(identity)) throw new Error(`Identidad duplicada en auditor: ${identity}`);
    identities.add(identity);
    if (input.source.providerId !== input.prepared.product.providerId) throw new Error(`Proveedor distinto en ${identity}`);
    const sourceKey = input.source.categoryKey.trim();
    const groupId = JSON.stringify([
      input.source.providerId, sourceKey,
      options.groupBy === "categoria" ? null : input.source.brand?.trim() || null,
      options.groupBy === "modelo" ? input.source.model?.trim() || null : null
    ]);
    providerCounts.set(input.source.providerId, (providerCounts.get(input.source.providerId) ?? 0) + 1);
    if (input.prepared.status === "ready") ready++;
    if (!sourceKey) withoutCategory++;
    let group = grouped.get(groupId);
    if (!group) {
      group = {
        providerId: input.source.providerId,
        categorySellID: null,
        category: input.source.categoryName.trim() || null,
        sourceCategoryKey: sourceKey || null,
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
    const specCounts = new Map<string, number>();
    for (const item of group.items) {
      const observed = new Set<string>();
      for (const [key, value] of Object.entries(item.source.specs ?? {})) {
        if (specHasValue(value)) observed.add(normalizedSpecKey(key));
      }
      for (const key of observed) specCounts.set(key, (specCounts.get(key) ?? 0) + 1);
    }
    const fields: GapField[] = [
      { kind: "description", name: "Descripción corta" },
      { kind: "description_general", name: "Descripción general" },
      ...[...specCounts].filter(([, count]) => count >= 2).sort(([a], [b]) => compare(a, b))
        .map(([key]): GapField => ({ kind: "spec", key, name: key }))
    ];
    const observations: GapObservation[] = [];
    for (const field of fields) {
      const missingItems = group.items.filter((item) => field.kind === "spec"
        ? !Object.entries(item.source.specs ?? {}).some(([key, value]) => normalizedSpecKey(key) === field.key && specHasValue(value))
        : field.kind === "attribute" ? true : !present(item.prepared.product[field.kind]));
      const missing = missingItems.length;
      const relevant = missingItems.map((item) => ({ item, evidence: evidenceOf(item.source, field) }));
      const originalSpecCounts = new Map<string, number>();
      if (field.kind === "spec") {
        for (const { item } of relevant) {
          for (const [key, value] of Object.entries(item.source.specs ?? {})) {
            if (normalizedSpecKey(key) !== field.key && specHasValue(value)) originalSpecCounts.set(key, (originalSpecCounts.get(key) ?? 0) + 1);
          }
        }
      }
      observations.push({
        field, applicable: group.items.length, present: group.items.length - missing, missing,
        coveragePercent: Math.round((group.items.length - missing) * 10000 / group.items.length) / 100,
        coverage: missing === 0 ? "completa" : missing === group.items.length ? "sistematica" : "desigual",
        missingIdentities: missingItems.map((item) => item.identity),
        directEvidence: relevant.filter(({ evidence }) => evidence === "directa_del_campo").length,
        relatedText: relevant.filter(({ evidence }) => evidence === "texto_relacionado").length,
        originalSpecKeys: [...originalSpecCounts].map(([key, count]) => ({ key, count }))
          .sort((a, b) => b.count - a.count || compare(a.key, b.key))
      });
      for (const { item, evidence } of relevant) {
        const existing = cases.get(item.identity);
        const record = existing ?? {
          identity: item.identity, providerId: item.source.providerId,
          reference: item.source.reference, url: item.source.url, brand: item.source.brand,
          model: item.source.model, categoryKey: item.source.categoryKey,
          categorySellID: null, status: item.prepared.status,
          original: {
            shortDescription: item.source.shortDescription, longDescription: item.source.longDescription,
            specs: item.source.specs
          },
          prepared: {
            description: item.prepared.product.description,
            description_general: item.prepared.product.description_general,
            attributes: []
          }, gaps: []
        };
        cases.set(item.identity, { ...record, gaps: [...record.gaps, { field, evidence }] });
      }
    }
    groups.push({
      providerId: group.providerId, categorySellID: null, category: group.category,
      sourceCategoryKey: group.sourceCategoryKey, comparable: group.sourceCategoryKey !== null,
      brand: group.brand, model: group.model,
      identities: group.items.map((item) => item.identity), observations
    });
  }
  groups.sort((a, b) => compare(JSON.stringify([a.providerId, a.sourceCategoryKey, a.brand, a.model]),
    JSON.stringify([b.providerId, b.sourceCategoryKey, b.brand, b.model])));
  return {
    universe: {
      total: inputs.length,
      providers: [...providerCounts].map(([providerId, originals]) => ({ providerId, originals }))
        .sort((a, b) => compare(a.providerId, b.providerId)),
      ready, review: inputs.length - ready, withoutCategory,
      note: "Universo: originales canónicos; cobertura de campos observados por familia del proveedor, no atributos comerciales ni obligatoriedad técnica."
    },
    groupBy: options.groupBy, groups,
    cases: [...cases.values()].sort((a, b) => compare(a.identity, b.identity))
  };
};
