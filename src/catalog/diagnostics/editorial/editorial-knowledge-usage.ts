import { isDeepStrictEqual } from "node:util";
import { buildProductIdentity } from "../../identity.js";
import { EDITORIAL_CRITERIA, type EditorialField } from "./editorial-quality.js";
import type { GapInput } from "../coverage/content-gaps-types.js";
import { hasIndependentDescriptionSource, type DescriptionSourceOrigin } from "../coverage/description-coverage.js";
import { resolveEditorialFacts } from "../../../preparation/editorial/core/editorial-facts.js";
import { resolveReusableEditorial } from "../../../preparation/editorial/core/editorial-composition.js";
import { resolveKnowledgeEditorial } from "../../../preparation/editorial/core/knowledge-editorial.js";
import { normalizeEditorialGeneral, normalizeEditorialSummary, normalizeEditorialTitle } from "../../../preparation/editorial/core/editorial-normalization.js";
import { captureSourceEditorialEvidence } from "../../../preparation/editorial/claims/source-editorial-evidence.js";
import { containsEditorialBrandModel } from "../../../preparation/editorial/identity/editorial-identity-match.js";
import { reconcileManainEditorialSourceSpecs } from "../../../preparation/manain/domain-source.js";
import { resolvedEditorialUnitFamilies } from "../../../preparation/editorial/identity/editorial-unit-provenance.js";
import { editorialFamilyOf } from "../../../preparation/editorial/core/editorial-families.js";
import { resolveSourceEditorialClaims } from "../../../preparation/editorial/claims/editorial-source-claims.js";
import { enrichVerifiedTechnicalBrief } from "../../../preparation/editorial/measurements/editorial-technical-brief.js";
import { resolveDocumentedModelGeneral } from "../../../preparation/editorial/measurements/sourced/editorial-sourced-technical-context.js";
import { resolvePreparedEditorialTitle } from "../../../preparation/editorial/writing/prepared-editorial-title.js";
import { reviewedModelEditorialSpecs } from "../../../preparation/technical/evidence/documented-technical-evidence.js";
import { hasGamEditorialSourceIdentityConflict } from "../../../preparation/gam/identity/evidence/gam-crossed-editorial-identity.js";
import { hasEditorialSourceWorkHeightConflict } from "../../../preparation/editorial/measurements/coherence/editorial-height-consistency.js";
import type { ProductRecord, SpecsMap } from "../../../contracts/catalog.js";

const fields: readonly EditorialField[] = ["title", "description", "description_general"];
type Field = EditorialField;
type Input = GapInput & { readonly origin?: DescriptionSourceOrigin };
type State = "oportunidad_respaldada" | "hipotesis_composicion" | "composicion_coincidente" |
  "sin_oportunidad_observada" | "precedencia_protegida" | "limite_orientativo" | "no_evaluable" | "campo_vacio";
type Mechanism = "afirmaciones_de_origen" | "resumen_tecnico_verificado" | "documentacion_de_modelo" | "composicion_compartida";
type Evidence = { readonly mechanism: Mechanism; readonly candidate: string; readonly addition?: string; readonly reviewedSpecs?: SpecsMap };
export type EditorialKnowledgeCase = {
  readonly identity: string;
  readonly providerId: string;
  readonly reference: string | null;
  readonly url: string;
  readonly origin?: DescriptionSourceOrigin;
  readonly family: NonNullable<ReturnType<typeof resolveEditorialFacts>>["family"] | null;
  readonly field: Field;
  readonly state: State;
  readonly reason: string;
  readonly current?: string;
  readonly evidence?: readonly Evidence[];
};
const initialCounts = (): Record<State, number> => ({ oportunidad_respaldada: 0, hipotesis_composicion: 0,
  composicion_coincidente: 0, sin_oportunidad_observada: 0, precedencia_protegida: 0, limite_orientativo: 0, no_evaluable: 0, campo_vacio: 0 });
const compare = (a: string, b: string): number => a < b ? -1 : a > b ? 1 : 0;
const normalize = (field: Field, value: string | null, model: string | null): string | null =>
  field === "title" ? normalizeEditorialTitle(value, model) : field === "description" ?
    normalizeEditorialSummary(value, model) : normalizeEditorialGeneral(value, model);

type EvaluatedInput = { readonly input: Input; readonly cases: readonly EditorialKnowledgeCase[] };

const analyzeKnowledge = (inputs: readonly Input[], selectedFields: readonly Field[], evaluated?: ReadonlyMap<string, EvaluatedInput>) => {
  const cases: EditorialKnowledgeCase[] = [];
  const totals = initialCounts();
  const byField = { title: initialCounts(), description: initialCounts(), description_general: initialCounts() };
  const identities = new Set<string>();
  const opportunities = new Set<string>();
  const hypotheses = new Set<string>();
  const recordCase = (item: EditorialKnowledgeCase): void => {
    totals[item.state]++;
    byField[item.field][item.state]++;
    if (item.state === "oportunidad_respaldada") opportunities.add(item.identity);
    if (item.state === "hipotesis_composicion") hypotheses.add(item.identity);
    cases.push(item);
  };
  for (const { input, identity } of inputs.map((input) => ({ input, identity: buildProductIdentity(input.source).key }))
    .sort((a, b) => compare(a.identity, b.identity))) {
    const { source, prepared, origin } = input;
    const product = prepared.product;
    if (identities.has(identity)) throw new Error(`Identidad duplicada en aprovechamiento editorial: ${identity}`);
    identities.add(identity);
    if (source.providerId !== product.providerId || (source.reference?.trim() || null) !== product.reference || source.url !== product.sourceUrl)
      throw new Error(`Preparación discordante en aprovechamiento editorial: ${identity}`);
    const previous = evaluated?.get(identity);
    if (previous && previous.input.origin === origin && isDeepStrictEqual(previous.input.source, source) &&
      isDeepStrictEqual(previous.input.prepared, prepared)) {
      for (const item of previous.cases) recordCase(item);
      continue;
    }
    const sourceRecord = reconcileManainEditorialSourceSpecs(source);
    const facts = resolveEditorialFacts(sourceRecord);
    const projection: ProductRecord = reconcileManainEditorialSourceSpecs({ ...source, specs: product.spec });
    const families = resolvedEditorialUnitFamilies(sourceRecord, projection);
    const sourceEvidence = captureSourceEditorialEvidence(sourceRecord);
    const projectionEvidence = captureSourceEditorialEvidence(projection);
    const projectedFacts = resolveEditorialFacts(projection);
    const compatible = facts !== null && projectedFacts?.family === facts.family && families?.[0] === facts.family && families[1] === facts.family &&
      editorialFamilyOf(product.title ?? "") === facts.family && containsEditorialBrandModel(product.title ?? "", facts.brand, facts.model) &&
      sourceEvidence.sourceVerified && sourceEvidence.identityVerified && projectionEvidence.sourceVerified && projectionEvidence.identityVerified &&
      !hasEditorialSourceWorkHeightConflict(sourceRecord) && !hasEditorialSourceWorkHeightConflict({ ...projection, title: product.title }) &&
      !hasGamEditorialSourceIdentityConflict(source);
    const independent = origin === undefined || hasIndependentDescriptionSource(origin);
    const knowledge = independent && compatible ? resolveKnowledgeEditorial(source, source) : null;
    const composed = independent && compatible && selectedFields.some((field) => field !== "title") ? resolveReusableEditorial(projection, knowledge?.familyOverride ?? null, source) : null;
    const sourceComposition = composed && !source.shortDescription?.trim() && !source.longDescription?.trim() &&
      isDeepStrictEqual(facts, projectedFacts) ? resolveReusableEditorial(sourceRecord, knowledge?.familyOverride ?? null, source) : null;
    const reviewed = independent && compatible && selectedFields.includes("description_general") && prepared.technicalProvenance ? reviewedModelEditorialSpecs(source, prepared.technicalProvenance) : undefined;
    const base = { identity, providerId: source.providerId, reference: source.reference, url: source.url,
      ...(origin === undefined ? {} : { origin }), family: facts?.family ?? null };
    const record = (field: Field, state: State, reason: string, current?: string, evidence?: readonly Evidence[]): void => {
      recordCase({ ...base, field, state, reason, ...(current === undefined ? {} : { current }), ...(evidence === undefined ? {} : { evidence }) });
    };
    for (const field of selectedFields) {
      const current = product[field]?.trim();
      if (!independent || prepared.status !== "ready" || !compatible) {
        record(field, "no_evaluable", !independent ? "Sin original independiente" : prepared.status !== "ready" ?
          "Preparación en revisión" : "Identidad, familia o coherencia técnica no acreditada para observar la composición");
        continue;
      }
      if (!current) { record(field, "campo_vacio", "Cubierto por los diagnósticos históricos de campos ausentes"); continue; }
      if (knowledge?.identityOverride || (field === "title" ? knowledge?.title :
        field === "description" ? knowledge?.short || knowledge?.general || knowledge?.fallbackGeneral : knowledge?.general || knowledge?.fallbackGeneral)) {
        record(field, "precedencia_protegida", "Conocimiento firmado de unidad: no se presume que la composición general deba sustituirlo");
        continue;
      }
      const evidence: Evidence[] = [];
      const add = (mechanism: Mechanism, candidate: string | null, previous = current): void => {
        if (!candidate || normalize(field, candidate, source.model) === normalize(field, previous, source.model)) return;
        const stem = previous.replace(/[.!?]$/u, "");
        if (!candidate.startsWith(stem)) return;
        const addition = candidate.slice(stem.length).replace(/^[.,;\s]+/u, "").trim();
        if (!addition || previous.includes(addition)) return;
        evidence.push({ mechanism, candidate, addition, ...(mechanism === "documentacion_de_modelo" && reviewed ? { reviewedSpecs: reviewed } : {}) });
      };
      if (field === "description") add("resumen_tecnico_verificado", enrichVerifiedTechnicalBrief(source, projection, current));
      if (field === "description_general") {
        const sourced = resolveSourceEditorialClaims(source, projection, current);
        add("afirmaciones_de_origen", sourced);
        add("documentacion_de_modelo", resolveDocumentedModelGeneral(source, projection, sourced ?? current, reviewed), sourced ?? current);
      }
      if (evidence.length) {
        const maximum = field === "description" ? EDITORIAL_CRITERIA.maxShortWords : EDITORIAL_CRITERIA.maxLongWords;
        if (evidence.every(({ candidate }) => candidate.trim().split(/\s+/u).length > maximum)) {
          record(field, "limite_orientativo", "La ampliación propuesta supera el umbral orientativo del campo; no se exige añadirla", current, evidence);
          continue;
        }
        record(field, "oportunidad_respaldada", "Un resolutor editorial existente propone una ampliación sobre el texto observado; revisar precedencia y presentación antes de intervenir", current, evidence);
        continue;
      }
      const candidate = field === "title" ? resolvePreparedEditorialTitle(projection, source) :
        field === "description" ? composed?.short ?? null : composed?.general ?? null;
      const normalizedCandidate = normalize(field, candidate, source.model);
      const normalizedCurrent = normalize(field, current, source.model);
      if (normalizedCandidate && normalizedCurrent && (normalizedCurrent === normalizedCandidate ||
        field === "description_general" && normalizedCurrent.startsWith(`${normalizedCandidate} `))) {
        const originalCandidate = field === "description_general" ? sourceComposition?.general :
          field === "description" ? sourceComposition?.short : null;
        if (originalCandidate && normalize(field, originalCandidate, source.model) !== normalizedCandidate) {
          record(field, "hipotesis_composicion", "La misma composición sobre el original ofrece una formulación distinta con hechos resueltos iguales; comprobar si aporta precisión o si la diferencia es legítima", current,
            [{ mechanism: "composicion_compartida", candidate: originalCandidate }]);
        } else {
          record(field, "composicion_coincidente", "El texto coincide con la selección del compositor; otros hechos no son exigibles por defecto");
        }
      } else if (candidate && (field === "title" || !source.shortDescription?.trim() && !source.longDescription?.trim())) {
        record(field, "hipotesis_composicion", "Composición candidata diferente, sin traza de selección, equivalencia o límites; no acredita una omisión", current,
          [{ mechanism: "composicion_compartida", candidate }]);
      } else {
        record(field, "sin_oportunidad_observada", "Sin ampliación acreditada por los resolutores consultados; no implica cobertura semántica completa");
      }
    }
  }
  return { analyzed: inputs.length, fields: selectedFields, totals, byField,
    affected: { opportunities: opportunities.size, hypotheses: hypotheses.size }, cases,
    note: "Preparación observada, no publicación ni defecto. Se contrasta una proyección de las specs finales sobre el original verificado, no se reconstruye el estado intermedio del compositor. Las ampliaciones son propuestas de resolutores existentes; las diferencias textuales no acreditan hechos omitidos. Los límites, sinónimos no reconocidos y decisiones de selección sin traza permanecen sin certificar." };
};
export const analyzeEditorialKnowledgeUsage = (inputs: readonly Input[], selectedFields: readonly Field[] = fields) =>
  analyzeKnowledge(inputs, selectedFields);

export const analyzeEditorialKnowledgeComparison = (matched: readonly Input[], current: readonly Input[], selectedFields: readonly Field[] = fields) => {
  const report = analyzeKnowledge(current, selectedFields);
  const cases = new Map<string, EditorialKnowledgeCase[]>();
  for (const item of report.cases) {
    const existing = cases.get(item.identity) ?? [];
    existing.push(item);
    cases.set(item.identity, existing);
  }
  const evaluated = new Map(current.map((input) => {
    const identity = buildProductIdentity(input.source).key;
    return [identity, { input, cases: cases.get(identity) ?? [] }] as const;
  }));
  return { matched: analyzeKnowledge(matched, selectedFields, evaluated), current: report };
};
export type EditorialKnowledgeUsage = ReturnType<typeof analyzeEditorialKnowledgeUsage>;
