import { buildProductIdentity } from "../identity.js";
import { fold } from "../../preparation/shared/classification/mapping/category-utils.js";
import { normalizedSpecKey, specHasValue } from "./content-gaps-source.js";
import { isTechnicalSpecificationKey, type TechnicalDensity } from "./technical-density.js";
import { familyOf } from "./description-coverage.js";
import type { DescriptionCoverageInput } from "./description-coverage.js";
import type { SpecificationCoverage } from "./specification-coverage.js";
import type { SpecValue } from "../../contracts/catalog.js";

export type SpecificationOpportunityEvidence = "preparada_sin_publicar" | "origen_sin_preparar" | "mismo_modelo" | "patron_familiar" | "sin_pista";
export type SpecificationOpportunityCase = {
  readonly identity: string;
  readonly providerId: string;
  readonly reference: string | null;
  readonly url: string;
  readonly title: string | null;
  readonly family: string;
  readonly origin: DescriptionCoverageInput["origin"];
  readonly technicalCount: number;
  readonly missingToTarget: number;
  readonly evidence: SpecificationOpportunityEvidence;
  readonly preparedKeys: readonly string[];
  readonly sourceKeys: readonly string[];
  readonly sameModelKeys: readonly string[];
  readonly familyKeys: readonly string[];
};
export type SpecificationOpportunities = {
  readonly note: string;
  readonly criteria: { readonly minimumTechnicalSpecs: number; readonly minimumModelPeers: number };
  readonly totals: {
    readonly belowTarget: number;
    readonly missingToTarget: number;
    readonly preparedEvidence: number;
    readonly sourceEvidence: number;
    readonly sameModelEvidence: number;
    readonly familyObservations: number;
    readonly withoutClues: number;
  };
  readonly cases: readonly SpecificationOpportunityCase[];
};

type ModelItem = { readonly identity: string; readonly keys: ReadonlySet<string> };
const MIN_MODEL_PEERS = 2;
const compare = (a: string, b: string): number => a < b ? -1 : a > b ? 1 : 0;
const technicalKeys = (specs: Readonly<Record<string, SpecValue>>): ReadonlySet<string> => new Set(
  Object.entries(specs).filter(([key, value]) => isTechnicalSpecificationKey(key) && specHasValue(value))
    .map(([key]) => normalizedSpecKey(key))
);
const modelIdentity = (input: DescriptionCoverageInput): string | null => {
  const brand = input.source.brand?.trim() || input.published.spec.Marca;
  const model = input.source.model?.trim() || input.published.spec.Modelo;
  if (typeof brand !== "string" || typeof model !== "string" || !brand.trim() || !model.trim()) return null;
  return JSON.stringify([input.source.providerId, fold(brand), fold(model)]);
};

export const analyzeSpecificationOpportunities = (
  inputs: readonly DescriptionCoverageInput[], density: TechnicalDensity, coverage: SpecificationCoverage
): SpecificationOpportunities => {
  if (coverage.totals.products !== inputs.length || density.totals.products !== inputs.length) {
    throw new Error("Poblaciones incompatibles en oportunidades técnicas");
  }
  const indexed = new Map<string, DescriptionCoverageInput>();
  const modelGroups = new Map<string, ModelItem[]>();
  for (const input of inputs) {
    const identity = buildProductIdentity(input.source).key;
    if (indexed.has(identity)) throw new Error(`Identidad duplicada en oportunidades técnicas: ${identity}`);
    indexed.set(identity, input);
    const model = modelIdentity(input);
    if (!model) continue;
    const group = modelGroups.get(model) ?? [];
    group.push({ identity, keys: technicalKeys(input.published.spec) });
    modelGroups.set(model, group);
  }
  const indexedCases = new Map<string, typeof coverage.cases[number][]>();
  for (const item of coverage.cases) {
    if (!isTechnicalSpecificationKey(item.key)) continue;
    const matches = indexedCases.get(item.identity) ?? [];
    matches.push(item);
    indexedCases.set(item.identity, matches);
  }
  const results: SpecificationOpportunityCase[] = [];
  for (const target of density.target.cases) {
    const identity = buildProductIdentity({ providerId: target.providerId, reference: target.reference,
      serialNumber: null, url: target.url }).key;
    const input = indexed.get(identity);
    if (!input) throw new Error(`Ficha sin origen emparejado en oportunidades técnicas: ${identity}`);
    const details = indexedCases.get(identity) ?? [];
    const preparedKeys = [...new Set(details.filter((item) => item.stage === "pendiente_publicacion")
      .map((item) => item.key))].sort(compare);
    const sourceKeys = [...new Set(details.filter((item) => item.stage === "diferencia_origen_preparacion")
      .map((item) => item.key))].sort(compare);
    const publishedKeys = technicalKeys(input.published.spec);
    const model = modelIdentity(input);
    const peers = model ? (modelGroups.get(model) ?? []).filter((item) => item.identity !== identity) : [];
    const peerCounts = new Map<string, number>();
    for (const peer of peers) for (const key of peer.keys) {
      if (!publishedKeys.has(key)) peerCounts.set(key, (peerCounts.get(key) ?? 0) + 1);
    }
    const sameModelKeys = [...peerCounts].filter(([, count]) => count >= MIN_MODEL_PEERS)
      .map(([key]) => key).sort(compare);
    const familyKeys = [...new Set(details.filter((item) => item.stage === "sin_evidencia_directa")
      .map((item) => item.key))].filter((key) => !sameModelKeys.includes(key)).sort(compare);
    const evidence: SpecificationOpportunityEvidence = preparedKeys.length ? "preparada_sin_publicar" :
      sourceKeys.length ? "origen_sin_preparar" : sameModelKeys.length ? "mismo_modelo" :
        familyKeys.length ? "patron_familiar" : "sin_pista";
    results.push({ identity, providerId: target.providerId, reference: target.reference, url: target.url,
      title: target.title, family: familyOf(input).family, origin: input.origin,
      technicalCount: target.technicalCount, missingToTarget: target.missingToTarget, evidence,
      preparedKeys, sourceKeys, sameModelKeys, familyKeys });
  }
  const order: readonly SpecificationOpportunityEvidence[] = ["preparada_sin_publicar", "origen_sin_preparar",
    "mismo_modelo", "patron_familiar", "sin_pista"];
  results.sort((a, b) => order.indexOf(a.evidence) - order.indexOf(b.evidence) ||
    b.missingToTarget - a.missingToTarget || b.sameModelKeys.length - a.sameModelKeys.length ||
    b.familyKeys.length - a.familyKeys.length || compare(a.providerId, b.providerId) || compare(a.identity, b.identity));
  const count = (evidence: SpecificationOpportunityEvidence): number => results.filter((item) => item.evidence === evidence).length;
  return {
    note: "Objetivo exploratorio de 6 prestaciones técnicas, no requisito de publicación. Evidencia propia de una ficha no equivale a dato válido sin contrastar reconciliaciones y semántica. Las pistas del mismo modelo y los patrones familiares son hipótesis de investigación: no permiten trasladar valores entre unidades ni completar lotes heterogéneos.",
    criteria: { minimumTechnicalSpecs: density.target.minimum, minimumModelPeers: MIN_MODEL_PEERS },
    totals: { belowTarget: results.length, missingToTarget: density.target.missing,
      preparedEvidence: count("preparada_sin_publicar"), sourceEvidence: count("origen_sin_preparar"),
      sameModelEvidence: count("mismo_modelo"), familyObservations: count("patron_familiar"),
      withoutClues: count("sin_pista") },
    cases: results
  };
};
