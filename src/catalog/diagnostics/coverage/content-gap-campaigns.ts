import { buildProductIdentity } from "../../identity.js";
import { compare } from "./content-gaps-source.js";
import { technicalConceptKey } from "../technical/technical-richness.js";
import type { PreparedSpecificationInput, analyzePreparedSpecificationStage } from "./specification-stages.js";
import type { EditorialKnowledgeUsage, EditorialKnowledgeCase } from "../editorial/editorial-knowledge-usage.js";
import type { PublishedTechnicalIssue, PublishedTechnicalQuality } from "../technical/published-technical-quality.js";
import type { SpecificationCoverage, SpecificationCase } from "./specification-coverage.js";
import type { SpecificationImprovementCase } from "./specification-improvement.js";
import type { ValueOpportunityCase } from "./specification-value-opportunities.js";
import type { reconcileGapCurrentEntries } from "./content-gap-population.js";
import type { DescriptionPriorities, DescriptionPriority } from "./description-priorities.js";

type PreparedStage = ReturnType<typeof analyzePreparedSpecificationStage>;
type Reconciliation = ReturnType<typeof reconcileGapCurrentEntries>;
type RichnessCase = PreparedStage["technicalDensity"]["richness"]["cases"][number];
type Alias = RichnessCase["aliases"][number];
type Classification = "defecto_reproducible" | "oportunidad_respaldada" | "hipotesis" | "diferencia_legitima" | "bloqueo_evidencia" | "pendiente_materializacion";
type Stage = "preparacion_vigente" | "publicacion_comercial" | "preparacion_conciliada";
type Evidence = ValueOpportunityCase | EditorialKnowledgeCase | PublishedTechnicalIssue | SpecificationCase | SpecificationImprovementCase | DescriptionPriority | Alias;
type Occurrence = {
  readonly identity: string; readonly providerId: string; readonly reference: string | null; readonly url: string;
  readonly origin: PreparedSpecificationInput["origin"] | null; readonly family: string | null;
  readonly variant: { readonly brand: string; readonly model: string } | null;
  readonly stage: Stage; readonly classification: Classification; readonly domain: "tecnica" | "editorial";
  readonly cause: string; readonly field: string; readonly evidenceType: string; readonly reason: string;
  readonly priority: number; readonly evidence: Evidence;
};
type Seed = Pick<Occurrence, "stage" | "classification" | "domain" | "cause" | "field" | "evidenceType" | "reason" | "priority" | "evidence"> & {
  readonly identity: string; readonly family?: string | null; readonly variantSensitive?: boolean; readonly publishedIssue?: PublishedTechnicalIssue;
};
const classifications: readonly Classification[] = ["defecto_reproducible", "oportunidad_respaldada", "hipotesis", "diferencia_legitima", "bloqueo_evidencia", "pendiente_materializacion"];
const actionable = (item: Occurrence): boolean => item.stage === "preparacion_vigente" && (item.classification === "defecto_reproducible" || item.classification === "oportunidad_respaldada");
const unique = (items: readonly Occurrence[]): number => new Set(items.map(({ identity }) => identity)).size;
const counts = (items: readonly Occurrence[]) => ({ products: unique(items), occurrences: items.length });
const groupKey = (item: Occurrence): string => JSON.stringify([item.stage, item.domain, item.classification, item.cause, item.field,
  item.family ?? [item.identity], item.variant, item.evidenceType, item.origin]);

export const analyzeContentGapCampaigns = (inputs: readonly PreparedSpecificationInput[], knowledge: EditorialKnowledgeUsage,
  prepared: PreparedStage | null, comparison?: { readonly reconciliation: Reconciliation; readonly matched: readonly PreparedSpecificationInput[];
    readonly coverage: SpecificationCoverage | null; readonly semantics: PublishedTechnicalQuality | null; readonly priorities: DescriptionPriorities | null;
    readonly publishedDensity: PreparedStage["technicalDensity"]; readonly matchedDensity: PreparedStage["technicalDensity"];
    readonly publishedValue?: readonly ValueOpportunityCase[] }) => {
  const indexed = new Map(inputs.map((input) => [buildProductIdentity(input.source).key, input]));
  const matched = new Map((comparison?.matched ?? []).map((input) => [buildProductIdentity(input.source).key, input]));
  const reconciliation = new Map(comparison?.reconciliation.cases.map((item) => [item.identity, item]));
  const richness = new Map(prepared?.technicalDensity.richness.cases.map((item) => [item.identity, item]));
  const publishedRichness = new Map(comparison?.publishedDensity.richness.cases.map((item) => [item.identity, item]));
  const matchedRichness = new Map(comparison?.matchedDensity.richness.cases.map((item) => [item.identity, item]));
  if (indexed.size !== inputs.length || knowledge.analyzed !== inputs.length || (prepared && prepared.population.products !== inputs.length)) {
    throw new Error("Poblaciones incompatibles en agrupación de huecos");
  }
  const occurrences: Occurrence[] = [];
  const add = (seed: Seed): void => {
    const input = seed.stage === "preparacion_vigente" ? indexed.get(seed.identity) : matched.get(seed.identity);
    const source = input?.source ?? seed.publishedIssue;
    if (!source) throw new Error(`Señal sin identidad evaluada: ${seed.identity}`);
    const variant = seed.variantSensitive && input?.source.brand?.trim() && input.source.model?.trim() ? { brand: input.source.brand, model: input.source.model } : null;
    const detail = (seed.stage === "preparacion_vigente" ? richness : seed.stage === "preparacion_conciliada" ? matchedRichness : publishedRichness).get(seed.identity);
    const family = seed.family === undefined ? detail?.familyStatus === "identificada" || detail?.familyStatus === "sin_criterio" ? detail.family : null : seed.family;
    const { variantSensitive: _variantSensitive, publishedIssue: _publishedIssue, ...rest } = seed;
    occurrences.push({ ...rest, providerId: source.providerId, reference: source.reference, url: source.url, origin: input?.origin ?? null,
      family: seed.variantSensitive && !variant ? null : family, variant });
  };
  for (const item of prepared?.technicalSemantics?.cases ?? []) add({ identity: item.identity, stage: "preparacion_vigente", domain: "tecnica",
    classification: "defecto_reproducible", cause: item.code, field: item.key ? technicalConceptKey(item.key) : item.code,
    evidenceType: "diagnostico_semantico", reason: item.detail, priority: 0, evidence: item });
  for (const item of prepared?.technicalOpportunities?.value.cases ?? []) {
    const classification = item.evidence === "origen_sin_preparar" || item.evidence === "documental_compatible" ? "oportunidad_respaldada" :
      item.evidence === "no_evaluable" || item.evidence === "sin_pista" ? "bloqueo_evidencia" : "hipotesis";
    add({ identity: item.identity, stage: "preparacion_vigente", domain: "tecnica", classification,
      cause: item.kind, field: item.field, evidenceType: item.evidence, reason: item.reason,
      priority: item.belowTarget ? 2 : item.essentialFields.length ? 3 : 4, evidence: item,
      variantSensitive: item.evidence === "mismo_modelo" || item.documents.length > 0 });
  }
  for (const item of prepared?.specificationImprovements?.cases ?? []) {
    if (item.status !== "pendiente") continue;
    const identity = buildProductIdentity({ providerId: item.providerId, reference: item.reference, serialNumber: null, url: item.url }).key;
    add({ identity, stage: "preparacion_vigente", domain: "tecnica", classification: "hipotesis", cause: item.kind,
      field: item.field, evidenceType: item.evidence?.kind ?? "objetivo_minimo", reason: "Aviso orientativo vigente; no acredita aplicabilidad ni causa productiva",
      priority: item.kind === "cobertura" ? 1 : item.priority === "P1" ? 3 : 4, evidence: item,
      variantSensitive: item.evidence?.kind === "mismo_modelo" });
  }
  for (const detail of richness.values()) for (const alias of detail.aliases) add({ identity: detail.identity, stage: "preparacion_vigente", domain: "tecnica",
    classification: alias.status === "acreditada" ? "oportunidad_respaldada" : alias.status === "conflicto" ? "bloqueo_evidencia" : "hipotesis",
    cause: "alias", field: alias.concept, evidenceType: alias.status, reason: "Observación de equivalencia técnica; conservar magnitudes independientes y contrastar antes de intervenir",
    priority: alias.status === "conflicto" ? 0 : 4, evidence: alias });
  for (const item of knowledge.cases) {
    const classification = item.state === "oportunidad_respaldada" ? "oportunidad_respaldada" : item.state === "hipotesis_composicion" ? "hipotesis" :
      item.state === "precedencia_protegida" || item.state === "limite_orientativo" ? "diferencia_legitima" : item.state === "no_evaluable" ? "bloqueo_evidencia" :
        item.state === "campo_vacio" ? indexed.get(item.identity)?.prepared.status === "ready" ? "defecto_reproducible" : "bloqueo_evidencia" : null;
    if (!classification) continue;
    add({ identity: item.identity, stage: "preparacion_vigente", domain: "editorial", classification, cause: item.state, field: item.field,
      family: item.state === "no_evaluable" ? null : item.family, evidenceType: item.evidence?.map(({ mechanism }) => mechanism).sort(compare).join("+") || item.state,
      reason: item.reason, priority: item.state === "campo_vacio" ? 1 : 4, evidence: item });
  }
  for (const item of comparison?.priorities?.pending ?? []) {
    add({ identity: item.identity, stage: "preparacion_conciliada", domain: "editorial", classification: "hipotesis",
      cause: item.signal, field: item.field, evidenceType: item.stage, reason: item.evidence,
      priority: item.stage === "P0" ? 1 : item.stage === "P1" ? 3 : 4, evidence: item });
  }
  for (const item of comparison?.priorities?.resolved ?? []) {
    const reconciled = reconciliation.get(item.identity);
    const verified = reconciled?.state === "publicada_conciliada" && reconciled.batchDiffers === false;
    add({ identity: item.identity, stage: "publicacion_comercial", domain: "editorial",
      classification: verified ? item.stage === "P0" ? "pendiente_materializacion" : "hipotesis" : "bloqueo_evidencia", cause: item.signal, field: item.field,
      evidenceType: item.stage, reason: verified ? item.stage === "P0" ? "Campo ausente en publicación y presente en preparación conciliada vigente; contrastar materialización" : "Aviso orientativo no observado en preparación; no acredita por sí solo resolución materializable" : "No se acredita equivalencia con la preparación vigente",
      priority: 4, evidence: item });
  }
  const pendingValues = new Map((comparison?.publishedValue ?? []).filter((item) => item.evidence === "preparada_sin_publicar")
    .map((item) => [JSON.stringify([item.identity, item.field]), item]));
  for (const item of comparison?.coverage?.cases ?? []) {
    if (item.stage !== "pendiente_publicacion" && item.stage !== "perdida_tras_publicacion" && item.stage !== "reconciliacion_acreditada") continue;
    const reconciled = reconciliation.get(item.identity);
    const verified = reconciled?.state === "publicada_conciliada" && reconciled.batchDiffers === false;
    const field = technicalConceptKey(item.key);
    const key = JSON.stringify([item.identity, field]);
    const value = item.stage === "pendiente_publicacion" ? pendingValues.get(key) : undefined;
    if (value) pendingValues.delete(key);
    add({ identity: item.identity, stage: "publicacion_comercial", domain: "tecnica",
      classification: item.stage === "reconciliacion_acreditada" ? "diferencia_legitima" : item.stage === "perdida_tras_publicacion" ? "defecto_reproducible" :
        verified ? "pendiente_materializacion" : "bloqueo_evidencia", cause: item.stage, field,
      evidenceType: value?.evidence ?? item.stage, reason: item.stage === "pendiente_publicacion" ? verified ? value?.reason ?? "Clave presente en preparación conciliada vigente, valor no acreditado por esta comparación; no es trabajo del motor" : "No se acredita equivalencia con la preparación vigente" :
        item.stage === "reconciliacion_acreditada" ? "Reconciliación existente, no reabrir como oportunidad" : "Pérdida observada por el diagnóstico de publicación",
      priority: item.stage === "perdida_tras_publicacion" ? 0 : 4, evidence: value ?? item });
  }
  for (const item of pendingValues.values()) {
    const reconciled = reconciliation.get(item.identity);
    const verified = reconciled?.state === "publicada_conciliada" && reconciled.batchDiffers === false;
    add({ identity: item.identity, stage: "publicacion_comercial", domain: "tecnica", classification: verified ? "pendiente_materializacion" : "bloqueo_evidencia",
      cause: "pendiente_publicacion", field: item.field, evidenceType: item.evidence,
      reason: verified ? item.reason : "No se acredita equivalencia con la preparación vigente", priority: 4, evidence: item });
  }
  for (const item of comparison?.semantics?.cases ?? []) {
    add({ identity: item.identity, stage: "publicacion_comercial", domain: "tecnica", classification: "defecto_reproducible",
      cause: item.code, field: item.key ? technicalConceptKey(item.key) : item.code, evidenceType: "diagnostico_semantico", reason: item.detail,
      priority: 0, evidence: item, publishedIssue: item });
  }
  const groups = new Map<string, Occurrence[]>();
  for (const item of occurrences) {
    const key = groupKey(item);
    const group = groups.get(key) ?? [];
    group.push(item);
    groups.set(key, group);
  }
  const ranked = [...groups].map(([id, items]) => {
    items.sort((a, b) => compare(a.identity, b.identity) || compare(JSON.stringify(a.evidence), JSON.stringify(b.evidence)));
    const first = items[0];
    if (!first) throw new Error("Grupo diagnóstico vacío");
    const byProvider = new Map<string, Occurrence[]>();
    for (const item of items) { const list = byProvider.get(item.providerId) ?? []; list.push(item); byProvider.set(item.providerId, list); }
    return { id, stage: first.stage, classification: first.classification, domain: first.domain, cause: first.cause,
      field: first.field, family: first.family, variant: first.variant, evidenceType: first.evidenceType, origin: first.origin,
      actionable: actionable(first), priority: items.reduce((min, item) => Math.min(min, item.priority), first.priority), ...counts(items),
      providers: [...byProvider].sort(([a], [b]) => compare(a, b)).map(([providerId, cases]) => ({ providerId, ...counts(cases) })), cases: items };
  }).sort((a, b) => Number(b.actionable) - Number(a.actionable) || a.priority - b.priority ||
    b.products - a.products || b.providers.length - a.providers.length || compare(a.id, b.id));
  return { note: "Agrupaciones de señales existentes, no causas productivas demostradas. Solo la preparación vigente alimenta la cola de actuación del motor; oportunidad respaldada exige contraste antes de corregir. Los avisos orientativos, bloqueos, precedencias y materialización quedan separados. La prioridad ordena semántica, carencia grave, evidencia y utilidad antes del alcance; un defecto reproducible es una señal concreta, no una causa del motor acreditada. Una ficha puede tener varias señales; los totales de fichas únicas no se suman entre grupos. Familia desconocida o variante no identificada no se agrupa transversalmente.",
    evaluated: inputs.length, technicalEvaluated: prepared?.specificationImprovements ? inputs.length : null,
    totals: { ...counts(occurrences), actionable: counts(occurrences.filter(actionable)),
      byClassification: classifications.map((classification) => ({ classification, ...counts(occurrences.filter((item) => item.classification === classification)) })) }, groups: ranked };
};
export type ContentGapCampaigns = ReturnType<typeof analyzeContentGapCampaigns>;
