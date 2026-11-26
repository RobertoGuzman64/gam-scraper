import type { NormalizationAuditStage, NormalizationSpecObservation, NormalizationStageObservation } from "./normalization-audit.js";
import { inspectSemanticConservation } from "./normalization-semantic.js";
import { contrastStages, type NormalizationContrast } from "./normalization-contrast.js";
import { hasAccreditedPublicationLink, inspectPreparationProvenance, inspectPublicationProvenance } from "./normalization-provenance.js";
import type { NormalizationCheck, NormalizationCheckContext, NormalizationCheckEvidence, NormalizationCheckFinding, NormalizationCheckOutcome } from "./normalization-checks.js";

const raw = (stage: NormalizationAuditStage, specification: NormalizationSpecObservation): NormalizationCheckEvidence =>
  ({ stage, circuit: "contraste-entrada-observada", field: specification.rawKey, present: true, value: specification.rawValue });
const interpreted = (stage: NormalizationAuditStage, specification: NormalizationSpecObservation): NormalizationCheckEvidence =>
  specification.kind === "interpretada" ? { stage, circuit: "contraste-interpretacion", field: specification.canonicalKey,
    present: true, value: specification.normalizedValue } : { stage, circuit: "contraste-interpretacion", field: specification.canonicalKey, present: false };

const semanticConcern = (stage: NormalizationAuditStage, spec: NormalizationSpecObservation): boolean => {
  const result = inspectSemanticConservation({ stage, specifications: [spec] });
  return result.status === "evaluada" && result.findings.length > 0;
};
const missing = (stage: NormalizationAuditStage, field: string): NormalizationCheckEvidence =>
  ({ stage, circuit: "contraste-entrada-observada", field, present: false });

const divergence = (contrast: NormalizationContrast, context: NormalizationCheckContext): NormalizationCheckFinding | null => {
  const { from, to, source, targets, kind } = contrast;
  if (source.kind !== "interpretada") return null;
  const circuit = `${from}-${to}`;
  const publication = to === "publicacion";
  const historic = from === "preparacion" && publication;
  if (from === "original" && publication && kind === "sin_correspondencia" && hasAccreditedPublicationLink(context, source)) return null;
  if (kind === "sin_cambio" || kind === "transformacion_trazada") return null;
  const inconclusiveEquivalence = kind === "representacion_equivalente" &&
    (semanticConcern(from, source) || targets.some((target) => semanticConcern(to, target)));
  if (kind === "representacion_equivalente" && !inconclusiveEquivalence) return null;
  const reason = inconclusiveEquivalence ? "La igualdad normalizada no acredita equivalencia semántica: una representación presenta señales de pérdida de estructura"
    : kind === "sin_correspondencia" ? "No existe destino de la misma prestación ni transformación acreditada para esta transición"
    : kind === "valor_distinto" ? "Los resultados normalizados de la misma prestación difieren sin equivalencia acreditada"
      : kind === "ambiguo" ? "No existe una correspondencia única entre las claves de origen y destino"
        : "La interpretación válida de origen carece de interpretación comparable en destino";
  return { cause: inconclusiveEquivalence ? "equivalencia-normalizada-no-concluyente" : `contraste-${kind.replaceAll("_", "-")}`, specificationKey: source.canonicalKey, stage: to, circuit,
    assessment: historic || kind === "ambiguo" || (publication && !context.publishedProvenance) ? "no_evaluable" : "hipotesis",
    applicability: historic ? "Contraste de preparación actual con publicación acreditada, no con su preparación histórica"
      : publication ? "Contraste del original acreditado con publicación; solo la traza histórica puede acreditar una transformación"
        : "Contraste del original con la preparación recalculada mediante las reglas actuales",
    reason, evidence: [raw(from, source), interpreted(from, source),
      ...(targets.length ? targets.flatMap((target) => [raw(to, target), interpreted(to, target)])
        : [missing(to, source.canonicalKey)])] };
};

export const inspectStageEquivalences = (context: NormalizationCheckContext, from: NormalizationStageObservation,
  to: NormalizationStageObservation | undefined): NormalizationCheckOutcome => {
  if (!to) return { status: "no_aplicable", reason: "Sin publicación acreditada para el contraste" };
  if (!from.specifications.some((specification) => specification.kind !== "no_reconocida")) {
    return { status: "no_aplicable", reason: "Sin prestaciones reconocidas de origen en la transición" };
  }
  if (!from.specifications.some((specification) => specification.kind === "interpretada")) {
    return { status: "no_evaluable", reason: "Sin interpretación válida de origen para acreditar divergencias" };
  }
  return { status: "evaluada", findings: contrastStages(context.observation, from, to).flatMap((contrast) => {
    const finding = divergence(contrast, context);
    return finding ? [finding] : [];
  }) };
};

export const normalizationEquivalenceChecks: readonly NormalizationCheck[] = [
  { id: "procedencia-preparacion", evaluate: inspectPreparationProvenance },
  { id: "procedencia-publicacion", evaluate: inspectPublicationProvenance },
  { id: "equivalencias-original-preparacion", evaluate: (context) => inspectStageEquivalences(context, context.observation.original, context.observation.prepared) },
  { id: "equivalencias-original-publicacion", evaluate: (context) => inspectStageEquivalences(context, context.observation.original, context.observation.publication?.observation) },
  { id: "equivalencias-preparacion-publicacion", evaluate: (context) => inspectStageEquivalences(context, context.observation.prepared, context.observation.publication?.observation) }
];
