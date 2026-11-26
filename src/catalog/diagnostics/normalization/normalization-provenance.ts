import { isDeepStrictEqual } from "node:util";
import type { ProductRecord, SpecValue } from "../../../contracts/catalog.js";
import { matchesTechnicalDocumentVerification, matchesTechnicalUnitListingVerification, type ProductTechnicalProvenance, type TechnicalSpecEvidence } from "../../../contracts/technical-provenance.js";
import { matchesDocumentedTechnicalIdentity } from "../../../preparation/technical/evidence/reviewed-catalog-model-identity.js";
import { buildProductIdentity } from "../../identity.js";
import { originalRecordFingerprint } from "../../identity-fingerprint.js";
import type { NormalizationAuditStage, NormalizationSpecObservation, NormalizationStageObservation } from "./normalization-audit.js";
import type { NormalizationCheckContext, NormalizationCheckEvidence, NormalizationCheckFinding, NormalizationCheckOutcome } from "./normalization-checks.js";

const display = (value: SpecValue): string => typeof value === "string" ? value : JSON.stringify(value);
const evidence = (stage: NormalizationAuditStage, circuit: string, field: string,
  value: SpecValue | undefined): NormalizationCheckEvidence => value === undefined
  ? { stage, circuit, field, present: false } : { stage, circuit, field, present: true, value };

const sourceCandidates = (source: ProductRecord, field: string): readonly { circuit: string; value: SpecValue }[] => {
  const candidates: { circuit: string; value: SpecValue }[] = [];
  const spec = source.specs && Object.hasOwn(source.specs, field) ? source.specs[field] : undefined;
  if (spec !== undefined) candidates.push({ circuit: "original-prestacion", value: spec });
  const property = field === "year" ? source.year?.trim() : field === "longDescription" ? source.longDescription
    : field === "url" ? source.url : undefined;
  if (property !== undefined && property !== null) candidates.push({ circuit: "original-campo", value: property });
  return candidates;
};

type Assessment = Pick<NormalizationCheckFinding, "assessment" | "cause" | "reason">;
const assessSource = (source: ProductRecord, entry: TechnicalSpecEvidence, fingerprint: string): Assessment => {
  if (entry.scope === "unknown") return { assessment: "no_evaluable", cause: "procedencia-sin-origen-acreditado",
    reason: "La traza declara expresamente un origen desconocido" };
  if (entry.scope === "unit") {
    const matches = sourceCandidates(source, entry.sourceField).filter(({ value }) => typeof value === "string" && value === entry.sourceValue);
    if (matches.length !== 1) return { assessment: matches.length === 0 ? "defecto_reproducible" : "no_evaluable",
      cause: matches.length === 0 ? "procedencia-origen-incompatible" : "procedencia-origen-ambiguo",
      reason: matches.length === 0 ? "La clave y el valor de origen declarados no corresponden al original acreditado"
        : "La traza no distingue entre dos campos de origen con la misma clave y valor" };
    return { assessment: "diferencia_legitima", cause: "procedencia-unidad-conciliada",
      reason: "La traza enlaza exactamente origen y destino de la etapa examinada; no acredita por sí sola equivalencia técnica" };
  }
  const listing = entry.scope === "unit-document" && entry.verification?.kind === "reviewed-unit-listing";
  const identityMatches = listing ? entry.document.url === source.url && entry.document.brand === source.brand && entry.document.model === source.model
    : matchesDocumentedTechnicalIdentity(source, entry);
  if (!identityMatches) return { assessment: "hipotesis", cause: "procedencia-identidad-documental-no-conciliada",
    reason: "No se acredita la identidad documental mediante el contrato de producción aplicable" };
  if (entry.verification === undefined) return { assessment: "no_evaluable", cause: "procedencia-documental-sin-verificacion",
    reason: "La referencia documental no incluye verificación de esta afirmación técnica" };
  const verified = listing ? matchesTechnicalUnitListingVerification(entry.document, fingerprint, entry.field, entry.value, entry.verification)
    : matchesTechnicalDocumentVerification(entry.document, entry.field, entry.value, entry.verification);
  return verified ? { assessment: "diferencia_legitima", cause: "procedencia-documental-conciliada",
    reason: "Identidad documental y huella de la afirmación coinciden; no se consulta ni revalida el documento externo" }
    : { assessment: "defecto_reproducible", cause: "procedencia-verificacion-incompatible",
      reason: "La verificación declarada no corresponde a la afirmación exacta o al original requerido" };
};

const assessTarget = (entry: TechnicalSpecEvidence, targets: readonly NormalizationSpecObservation[]): Assessment | null => {
  if (targets.length > 1) return { assessment: "no_evaluable", cause: "procedencia-destino-ambiguo",
    reason: "Más de una prestación de destino comparte la clave canónica de destino de la traza" };
  const target = targets[0];
  return target && display(target.rawValue) === entry.value ? null : { assessment: "defecto_reproducible",
    cause: "procedencia-destino-incompatible", reason: "La clave canónica y el valor declarado no corresponden al destino observado" };
};

const contextMatches = ({ observation, source }: NormalizationCheckContext, provenance: ProductTechnicalProvenance): boolean =>
  provenance.originalRecordSha256 === observation.originalRecordSha256 && observation.originalRecordSha256 === originalRecordFingerprint(source) &&
  observation.identity === buildProductIdentity(source).key && observation.providerId === source.providerId &&
  observation.sourceUrl === source.url && observation.reference === source.reference;

const traceSourceEvidence = (source: ProductRecord, stage: NormalizationAuditStage,
  entry: Extract<TechnicalSpecEvidence, { scope: "unit" }>): readonly NormalizationCheckEvidence[] => {
  const candidates = sourceCandidates(source, entry.sourceField);
  const matching = candidates.filter(({ value }) => typeof value === "string" && value === entry.sourceValue);
  return [...(matching.length === 1 ? [] : [evidence(stage, "traza-origen", entry.sourceField, entry.sourceValue)]),
    ...(candidates.length ? candidates.map(({ circuit, value }) => evidence("original",
      matching.length === 1 && value === entry.sourceValue ? `${circuit}-conciliado-con-traza` : circuit, entry.sourceField, value))
      : [evidence("original", "origen-observado", entry.sourceField, undefined)])];
};

const traceFindings = (source: ProductRecord, provenance: ProductTechnicalProvenance, destination: NormalizationStageObservation): NormalizationCheckOutcome => {
  const stage = destination.stage;
  const targetsByKey = new Map<string, NormalizationSpecObservation[]>();
  for (const target of destination.specifications) {
    const targets = targetsByKey.get(target.canonicalKey) ?? [];
    targets.push(target);
    targetsByKey.set(target.canonicalKey, targets);
  }
  const findings: NormalizationCheckFinding[] = provenance.entries.map((entry) => {
    const targets = targetsByKey.get(entry.field) ?? [];
    const { sourceValue: _sourceValue, value: _value, ...metadata } = entry;
    const assessment = assessTarget(entry, targets) ?? assessSource(source, entry, provenance.originalRecordSha256);
    return { ...assessment, specificationKey: entry.field, stage, circuit: stage === "preparacion" ? "procedencia-preparacion-actual" : "procedencia-publicacion-acreditada",
      applicability: stage === "preparacion" ? "Traza de recuperación de la preparación recalculada, no de la publicación histórica"
        : "Traza histórica del manifiesto de la publicación acreditada, no de la preparación recalculada",
      evidence: [evidence(stage, "traza-destino", entry.field, entry.value),
        evidence(stage, "traza-metadatos", entry.field, JSON.stringify(metadata)),
        ...(targets.length ? targets.map((target) => evidence(stage, "destino-observado", target.rawKey, target.rawValue))
          : [evidence(stage, "destino-observado", entry.field, undefined)]),
        ...(entry.scope === "unit" ? traceSourceEvidence(source, stage, entry) : [])] };
  });
  return { status: "evaluada", findings };
};

export const inspectPreparationProvenance = (context: NormalizationCheckContext): NormalizationCheckOutcome => {
  const { observation, source, prepared } = context;
  const provenance = observation.technicalProvenance;
  if (!provenance) return { status: "no_evaluable", reason: "Preparación sin contrato de procedencia disponible" };
  if (!contextMatches(context, provenance) || prepared.product.providerId !== source.providerId || prepared.product.sourceUrl !== source.url ||
    prepared.product.reference !== source.reference || !isDeepStrictEqual(prepared.technicalProvenance, provenance)) {
    return { status: "no_evaluable", reason: "Identidad, huella o procedencia de la preparación no conciliada" };
  }
  if (!provenance.entries.length) return { status: "no_aplicable", reason: "Sin transformaciones con traza de recuperación" };
  return traceFindings(source, provenance, observation.prepared);
};

export const inspectPublicationProvenance = (context: NormalizationCheckContext): NormalizationCheckOutcome => {
  const { observation, source, published, publishedProvenance, publicationProvenanceError } = context;
  if (!observation.publication || !published) return { status: "no_aplicable", reason: "Sin publicación acreditada para la ficha" };
  if (publicationProvenanceError) throw new Error(publicationProvenanceError);
  if (!publishedProvenance) return { status: "no_evaluable", reason: "Publicación sin traza histórica disponible" };
  if (!contextMatches(context, publishedProvenance) || published.providerId !== source.providerId ||
    published.sourceUrl !== source.url || published.reference !== source.reference) {
    return { status: "no_evaluable", reason: "Identidad o huella de la traza histórica no conciliada" };
  }
  if (!publishedProvenance.entries.length) return { status: "no_aplicable", reason: "Sin transformaciones con traza histórica de recuperación" };
  return traceFindings(source, publishedProvenance, observation.publication.observation);
};

export const hasAccreditedPublicationLink = (context: NormalizationCheckContext, specification: NormalizationSpecObservation): boolean => {
  const { observation, source, published, publishedProvenance } = context;
  if (context.publicationProvenanceError || !observation.publication || !published || !publishedProvenance ||
    publishedProvenance.originalRecordSha256 !== observation.originalRecordSha256 || published.providerId !== source.providerId ||
    published.sourceUrl !== source.url || published.reference !== source.reference) return false;
  const destination = observation.publication.observation;
  const candidates = publishedProvenance.entries.filter((entry) => entry.scope === "unit" && entry.sourceField === specification.rawKey &&
    entry.sourceValue === specification.rawValue && assessSource(source, entry, publishedProvenance.originalRecordSha256).assessment === "diferencia_legitima" &&
    assessTarget(entry, destination.specifications.filter((target) => target.canonicalKey === entry.field)) === null);
  return candidates.length === 1 && contextMatches(context, publishedProvenance);
};
