import { isDeepStrictEqual } from "node:util";
import type { TechnicalSpecEvidence } from "../../../contracts/technical-provenance.js";
import type { NormalizationAssessment, NormalizationAuditStage, NormalizationProductObservation,
  NormalizationSpecObservation, NormalizationStageObservation } from "./normalization-audit.js";

export type NormalizationContrastKind = "sin_cambio" | "representacion_equivalente" | "valor_distinto" |
  "transformacion_trazada" | "sin_correspondencia" | "ambiguo" | "no_interpretable";

export type NormalizationContrast = Pick<NormalizationProductObservation,
  "identity" | "providerId" | "reference" | "sourceUrl" | "originalRecordSha256"> & {
  readonly from: NormalizationAuditStage;
  readonly to: NormalizationAuditStage;
  readonly source: NormalizationSpecObservation;
  readonly targets: readonly NormalizationSpecObservation[];
  readonly kind: NormalizationContrastKind;
  readonly assessment: NormalizationAssessment;
  readonly evidence: TechnicalSpecEvidence | null;
};

type Finding = Pick<NormalizationContrast, "kind" | "assessment" | "targets" | "evidence">;
const finding = (kind: NormalizationContrastKind, assessment: NormalizationAssessment,
  targets: readonly NormalizationSpecObservation[], evidence: TechnicalSpecEvidence | null = null): Finding =>
  ({ kind, assessment, targets, evidence });

const index = (stage: NormalizationStageObservation): ReadonlyMap<string, readonly NormalizationSpecObservation[]> => {
  const grouped = new Map<string, NormalizationSpecObservation[]>();
  for (const item of stage.specifications) {
    const key = item.canonicalKey;
    const bucket = grouped.get(key) ?? [];
    bucket.push(item);
    grouped.set(key, bucket);
  }
  return grouped;
};

const compareField = (source: NormalizationSpecObservation, sourceIndex: ReturnType<typeof index>,
  targetIndex: ReturnType<typeof index>, evidence: readonly TechnicalSpecEvidence[]): Finding => {
  const targets = targetIndex.get(source.canonicalKey) ?? [];
  if ((sourceIndex.get(source.canonicalKey)?.length ?? 0) > 1 || targets.length > 1) {
    return finding("ambiguo", "hipotesis", targets);
  }
  const target = targets[0];
  if (!target) {
    const traced = evidence.flatMap((entry) => {
      if (entry.scope !== "unit" || entry.sourceField !== source.rawKey || entry.sourceValue !== source.rawValue) return [];
      const destinations = targetIndex.get(entry.field) ?? [];
      const destination = destinations.length === 1 ? destinations[0] : undefined;
      return destination && (typeof destination.rawValue === "string" ? destination.rawValue : JSON.stringify(destination.rawValue)) === entry.value
        ? [{ entry, destination }] : [];
    });
    if (traced.length === 1 && traced[0]) return finding("transformacion_trazada", "observacion_acreditada",
      [traced[0].destination], traced[0].entry);
    if (traced.length > 1) return finding("ambiguo", "hipotesis", traced.map(({ destination }) => destination));
    return finding("sin_correspondencia", "no_evaluable", []);
  }
  if (source.rawKey === target.rawKey && isDeepStrictEqual(source.rawValue, target.rawValue)) {
    return finding("sin_cambio", source.kind === "interpretada" && target.kind === "interpretada"
      ? "observacion_acreditada" : "no_evaluable", targets);
  }
  if (source.kind !== "interpretada" || target.kind !== "interpretada" || source.rule !== target.rule) {
    return finding("no_interpretable", "no_evaluable", targets);
  }
  return isDeepStrictEqual(source.normalizedValue, target.normalizedValue)
    ? finding("representacion_equivalente", "diferencia_legitima", targets)
    : finding("valor_distinto", "hipotesis", targets);
};

const contrastStages = (product: NormalizationProductObservation, from: NormalizationStageObservation,
  to: NormalizationStageObservation): readonly NormalizationContrast[] => {
  const sourceIndex = index(from);
  const targetIndex = index(to);
  const evidence = from.stage === "original" && to.stage === "preparacion" &&
    product.technicalProvenance?.originalRecordSha256 === product.originalRecordSha256
    ? product.technicalProvenance.entries : [];
  const { identity, providerId, reference, sourceUrl, originalRecordSha256 } = product;
  return from.specifications.map((source) => ({ identity, providerId, reference, sourceUrl, originalRecordSha256,
    from: from.stage, to: to.stage, source, ...compareField(source, sourceIndex, targetIndex, evidence) }));
};

export const contrastNormalizationProduct = (product: NormalizationProductObservation): readonly NormalizationContrast[] => [
  ...contrastStages(product, product.original, product.prepared),
  ...(product.publication ? [
    ...contrastStages(product, product.original, product.publication.observation),
    ...contrastStages(product, product.prepared, product.publication.observation)
  ] : [])
];
