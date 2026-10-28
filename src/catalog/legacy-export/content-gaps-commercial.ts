import { buildProductIdentity } from "../identity.js";
import { SPEC_KEY_NORMALIZATION } from "../normalization/spec-rules.js";
import { fold } from "../preparation/mapping/category-utils.js";
import type { CanonicalCatalog } from "../canonical-catalog.js";
import type { ProductRecord, SpecValue } from "../../contracts/catalog.js";
import type { ImportCatalog } from "./contracts.js";
import type { PreparedProduct } from "../preparation/contracts.js";

import type { GapInput, GapOptions, GapAnalysis, GapGroup, GapField, GapObservation, GapCase, InternalGroup } from "../diagnostics/content-gaps-types.js";
import { compare, keyOf, evidenceOf, groupKey, present, specHasValue } from "../diagnostics/content-gaps-source.js";

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
          field.kind === "spec" ? !Object.entries(item.source.specs ?? {}).some(([key, value]) =>
            key === field.key && specHasValue(value)) : !present(product[field.kind]);
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
