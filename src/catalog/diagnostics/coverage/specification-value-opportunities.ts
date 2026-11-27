import { buildProductIdentity } from "../../identity.js";
import { normalizeSpecKey } from "../../normalization/normalize-specs.js";
import { inspectTechnicalCoherence, inspectTechnicalSpecifications } from "../../validation/technical-specifications.js";
import { recoverReviewedModelTechnicalSpecs } from "../../../preparation/technical/evidence/documented-technical-evidence.js";
import { reviewedModelDocumentClaims } from "../../../preparation/technical/evidence/reviewed-model-claims.js";
import { matchesDocumentedTechnicalIdentity } from "../../../preparation/technical/evidence/reviewed-catalog-model-identity.js";
import { matchesTechnicalDocumentVerification } from "../../../contracts/technical-provenance.js";
import { isTechnicalSpecificationKey, technicalSpecificationKeys, type TechnicalDensity } from "../technical/technical-density.js";
import { observeTechnicalSpecifications, technicalConceptKey, isRichnessTechnicalKey } from "../technical/technical-richness.js";
import { compare, specHasValue } from "./content-gaps-source.js";
import { hasIndependentDescriptionSource } from "./description-coverage.js";
import { assessEssentialTechnicalCoverage, assessQualitativeTechnicalFamily } from "./specification-family-priorities.js";
import { specificationEssentialHints, type SpecificationImprovementAudit } from "./specification-improvement.js";
import type { DescriptionCoverageInput } from "./description-coverage.js";
import type { SpecificationCase } from "./specification-coverage.js";
import type { ImportCandidate } from "../../../commercial/legacy-export/contracts.js";
import type { SpecsMap, SpecValue } from "../../../contracts/catalog.js";

type Stage = "publicacion" | "preparacion";
type Input = Pick<DescriptionCoverageInput, "source" | "prepared" | "origin"> & { readonly product: ImportCandidate };
type Claim = ReturnType<typeof reviewedModelDocumentClaims>[number];
export type ValueOpportunityEvidence = "preparada_sin_publicar" | "origen_sin_preparar" | "documental_compatible" |
  "mismo_modelo" | "patron_familiar" | "sin_pista" | "no_evaluable";
type Observation = { readonly field: string; readonly value: SpecValue };
type Signal = { readonly field: string; readonly kind: "prestacion" | "esencial"; readonly evidence: ValueOpportunityEvidence;
  readonly reason: string; readonly observations: readonly Observation[]; readonly documents: readonly Claim[];
  readonly peerIdentities: readonly string[] };
export type ValueOpportunityCase = Signal & { readonly identity: string; readonly providerId: string; readonly reference: string | null;
  readonly url: string; readonly family: string | null; readonly origin: DescriptionCoverageInput["origin"];
  readonly technicalCount: number; readonly belowTarget: boolean; readonly stage: Stage;
  readonly essentialFields: readonly string[] };
const evidenceOrder: readonly ValueOpportunityEvidence[] = ["preparada_sin_publicar", "origen_sin_preparar", "documental_compatible",
  "mismo_modelo", "patron_familiar", "sin_pista", "no_evaluable"];
const isTechnical = (key: string): boolean => isRichnessTechnicalKey(key, isTechnicalSpecificationKey);
const conceptIndex = (specs: SpecsMap) => {
  const result = new Map<string, Observation[]>();
  for (const [field, value] of Object.entries(specs).sort(([a], [b]) => compare(a, b))) {
    if (!isTechnical(field) || !specHasValue(value)) continue;
    const key = technicalConceptKey(field);
    const list = result.get(key) ?? [];
    list.push({ field, value });
    result.set(key, list);
  }
  return result;
};
const validated = (specs: SpecsMap) => {
  const technical = Object.fromEntries(Object.entries(specs).filter(([key]) => isTechnical(key)));
  const result = observeTechnicalSpecifications(technical);
  const issues = new Set([...inspectTechnicalSpecifications(specs), ...inspectTechnicalCoherence(specs)].map(({ key }) => technicalConceptKey(key)));
  return new Set(result.accepted.filter((key) => !issues.has(technicalConceptKey(key))).map(technicalConceptKey));
};
const modelKey = (input: Input): string | null => input.source.brand?.trim() && input.source.model?.trim() ?
  JSON.stringify([input.source.brand, input.source.model]) : null;
const signal = (field: string, evidence: ValueOpportunityEvidence, reason: string, observations: readonly Observation[] = [],
  documents: readonly Claim[] = [], peerIdentities: readonly string[] = [], kind: Signal["kind"] = "prestacion"): Signal =>
  ({ field, kind, evidence, reason, observations, documents, peerIdentities });

export const analyzeSpecificationValueOpportunities = (inputs: readonly Input[], density: TechnicalDensity,
  coverage: readonly SpecificationCase[], stage: Stage, improvements: SpecificationImprovementAudit) => {
  if (density.totals.products !== inputs.length || improvements.totals.products !== inputs.length) throw new Error("Poblaciones incompatibles en oportunidades de valor");
  const richness = new Map(density.richness.cases.map((item) => [item.identity, item]));
  const byIdentity = new Map<string, SpecificationCase[]>();
  for (const item of coverage) {
    const list = byIdentity.get(item.identity) ?? [];
    list.push(item);
    byIdentity.set(item.identity, list);
  }
  const hints = specificationEssentialHints(improvements);
  const claims = new Map<string, Claim[]>();
  for (const item of reviewedModelDocumentClaims()) {
    const key = JSON.stringify([item.document.brand, item.document.model]);
    const list = claims.get(key) ?? [];
    list.push(item);
    claims.set(key, list);
  }
  const indexed = inputs.map((input) => {
    const identity = buildProductIdentity(input.source).key;
    const detail = richness.get(identity);
    if (!detail) throw new Error(`Identidad sin riqueza técnica: ${identity}`);
    const model = modelKey(input);
    return { input, identity, detail, model, present: conceptIndex(input.product.spec),
      valid: new Set(detail.interpretedKeys.map(technicalConceptKey)) };
  });
  const peers = new Map<string, Map<string, string[]>>();
  for (const item of indexed) {
    if (!item.model || item.detail.familyStatus !== "identificada") continue;
    const key = JSON.stringify([item.input.source.providerId, item.model, item.detail.family]);
    const fields = peers.get(key) ?? new Map<string, string[]>();
    for (const field of item.valid) {
      const identities = fields.get(field) ?? [];
      identities.push(item.identity);
      fields.set(field, identities);
    }
    peers.set(key, fields);
  }
  const cases: ValueOpportunityCase[] = [];
  for (const { input, identity, detail, model, present } of indexed) {
    const independent = hasIndependentDescriptionSource(input.origin);
    const prepared = stage === "preparacion" ? present : conceptIndex(input.prepared.product.spec);
    const preparedValid = stage === "publicacion" ? validated(input.prepared.product.spec) : new Set<string>();
    const original = conceptIndex(input.source.specs ?? {});
    const sourceValid = independent ? validated(input.source.specs ?? {}) : new Set<string>();
    const differences = byIdentity.get(identity) ?? [];
    const reconciled = new Set(differences.filter((item) => item.stage === "reconciliacion_acreditada").map((item) => technicalConceptKey(item.key)));
    const ambiguous = new Set(differences.filter((item) => item.stage === "normalizacion_ambigua").map((item) => technicalConceptKey(item.key)));
    const signals = new Map<string, Signal>();
    const add = (item: Signal): void => {
      const key = JSON.stringify([item.kind, item.field]);
      if (!signals.has(key)) signals.set(key, item);
    };
    for (const [field, observations] of prepared) {
      if (stage !== "publicacion" || present.has(field)) continue;
      add(preparedValid.has(field) ? signal(field, "preparada_sin_publicar", "Concepto interpretable presente en preparación y ausente en publicación", observations) :
        signal(field, "no_evaluable", "Concepto preparado no interpretable o con señal de conflicto", observations));
    }
    for (const [field, observations] of original) {
      if (!independent || present.has(field) || prepared.has(field) || reconciled.has(field)) continue;
      add(sourceValid.has(field) && !ambiguous.has(field) ? signal(field, "origen_sin_preparar", "Dato directo del original independiente, interpretable y sin reconciliación acreditada; requiere contraste de aplicabilidad", observations) :
        signal(field, "no_evaluable", "Dato de origen no interpretable, contradictorio o ambiguo", observations));
    }
    const documents = model && independent ? (claims.get(model) ?? []).filter((claim) => isTechnical(claim.field) &&
      !present.has(technicalConceptKey(claim.field)) && !prepared.has(technicalConceptKey(claim.field)) &&
      !reconciled.has(technicalConceptKey(claim.field))) : [];
    if (documents.length) {
      const accepted = new Set<string>();
      const recovered = recoverReviewedModelTechnicalSpecs(input.source, input.prepared.product.spec, (before, after, _mechanism, _sourceField, source) => {
        if (!source || !matchesDocumentedTechnicalIdentity(input.source, source)) return;
        for (const claim of documents) if (claim.document.url === source.document.url && !Object.hasOwn(before, claim.field) &&
          after[claim.field] === claim.value && matchesTechnicalDocumentVerification(claim.document, claim.field, claim.value, claim.verification)) {
          accepted.add(claim.verification.claimSha256);
        }
      });
      const valid = validated(recovered);
      const fields = new Map<string, Claim[]>();
      for (const claim of documents) {
        const field = technicalConceptKey(claim.field);
        const list = fields.get(field) ?? [];
        list.push(claim);
        fields.set(field, list);
      }
      for (const [field, candidates] of fields) {
        const compatible = candidates.filter((claim) => accepted.has(claim.verification.claimSha256) && valid.has(field));
        if (!original.has(field) && !ambiguous.has(field) && detail.familyStatus !== "contradictoria" && compatible.length === 1) {
          add(signal(field, "documental_compatible", "Afirmación revisada admitida por el resolutor productivo de compatibilidad sobre la preparación actual", [], compatible));
        } else add(signal(field, "no_evaluable", "Afirmación documental incorporada, pero compatibilidad o valor independiente no acreditados para esta unidad", [], candidates));
      }
    }
    const modelFields = model && detail.familyStatus === "identificada" ? peers.get(JSON.stringify([input.source.providerId, model, detail.family])) : undefined;
    for (const [field, identities] of modelFields ?? []) {
      if (present.has(field) || prepared.has(field) || original.has(field) || reconciled.has(field) || identities.length < 2) continue;
      add(signal(field, "mismo_modelo", "Dos o más unidades del mismo modelo y familia declaran el concepto; variante y valor no transferibles", [], [], identities.filter((id) => id !== identity).sort(compare)));
    }
    for (const item of differences) {
      if (item.stage !== "sin_evidencia_directa" || !isTechnical(item.key)) continue;
      const field = technicalConceptKey(item.key);
      if (present.has(field) || prepared.has(field) || original.has(field) || reconciled.has(field)) continue;
      add(signal(field, "patron_familiar", "Observación de la cohorte existente, sin evidencia directa de la unidad"));
    }
    const family = assessQualitativeTechnicalFamily(input.product).family;
    const relatedEssentials = (item: Signal): readonly string[] => {
      if (!family) return [];
      if (item.kind === "esencial") return [item.field];
      const keys = [...item.observations.map(({ field }) => normalizeSpecKey(field)),
        ...item.documents.map(({ field }) => normalizeSpecKey(field)), normalizeSpecKey(item.field)];
      return assessEssentialTechnicalCoverage(family, keys, []).filter((field) => field.status !== "no_observada").map(({ key }) => key);
    };
    if (family) {
      const preparedDetail = stage === "publicacion" ? assessQualitativeTechnicalFamily(input.prepared.product) : null;
      const preparedObservation = stage === "publicacion" && preparedDetail?.family?.name === family.name ?
        observeTechnicalSpecifications(Object.fromEntries(Object.entries(input.prepared.product.spec).filter(([key]) => isTechnical(key)))) : null;
      const preparedEssentials = preparedObservation ? assessEssentialTechnicalCoverage(family, preparedObservation.accepted,
        preparedObservation.unresolved.map(({ canonicalKey }) => canonicalKey)) : [];
      for (const field of detail.essentials) {
        if (field.status === "observada") continue;
        const essential = family.essential.find((item) => item.key === field.key);
        if (!essential) continue;
        const related = [...signals.values()].filter((item) => relatedEssentials(item).includes(field.key));
        if (field.status === "no_evaluable" || stage === "publicacion" && preparedDetail?.family?.name !== family.name) {
          add(signal(field.key, "no_evaluable", "Declaración esencial ambigua, condicionada o familia no conciliable", [], [], [], "esencial"));
        } else if (preparedEssentials.some((item) => item.key === field.key && item.status === "observada")) {
          if (!related.some((item) => item.evidence === "preparada_sin_publicar")) add(signal(field.key, "preparada_sin_publicar", "La declaración esencial se observa en la preparación conciliada", [], [], [], "esencial"));
        } else if (!related.length) {
          const hint = hints.get(identity)?.find((item) => item.field === essential.label && item.family === family.name);
          add(signal(field.key, hint?.evidence?.kind === "mismo_modelo" ? "mismo_modelo" : hint ? "patron_familiar" : independent ? "sin_pista" : "no_evaluable",
            hint ? "Diferenciación observacional de la familia; aplicabilidad no acreditada" : independent ? "Declaración esencial no observada, sin pista suficiente sobre la variante" : "Sin original independiente para evaluar evidencia propia", [], [], [], "esencial"));
        }
      }
    }
    const technicalCount = technicalSpecificationKeys(input.product.spec).length;
    for (const item of signals.values()) cases.push({ ...item, identity, providerId: input.source.providerId,
      reference: input.source.reference, url: input.source.url, family: detail.family, origin: input.origin,
      technicalCount, belowTarget: technicalCount < density.target.minimum, stage, essentialFields: relatedEssentials(item) });
  }
  cases.sort((a, b) => Number(b.belowTarget) - Number(a.belowTarget) || evidenceOrder.indexOf(a.evidence) - evidenceOrder.indexOf(b.evidence) ||
    Number(b.essentialFields.length > 0) - Number(a.essentialFields.length > 0) || compare(a.identity, b.identity) || compare(a.kind, b.kind) || compare(a.field, b.field));
  const products = (items: readonly ValueOpportunityCase[]) => new Set(items.map(({ identity }) => identity)).size;
  return { note: "Exploración de toda la población, independiente del objetivo mínimo. Las declaraciones esenciales y los pares no acreditan aplicabilidad. Solo se observa evidencia documental incorporada y aceptada por los contratos productivos; las demás afirmaciones quedan no evaluables. No modifica ni acredita publicación o enriquecimiento. Las ocurrencias no equivalen a fichas únicas.", stage,
    totals: { evaluated: inputs.length, productsWithSignals: products(cases), occurrences: cases.length,
      atOrAboveMinimumProducts: products(cases.filter((item) => !item.belowTarget)),
      byEvidence: evidenceOrder.map((evidence) => { const items = cases.filter((item) => item.evidence === evidence);
        return { evidence, products: products(items), occurrences: items.length }; }) }, cases };
};
