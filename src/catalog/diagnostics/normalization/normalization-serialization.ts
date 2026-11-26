import type { NormalizationCheck, NormalizationCheckOutcome } from "./normalization-checks.js";

export const normalizationSerializationIds = ["csv-specjson", "csv-columnas-tecnicas", "seed-directo", "seed-via-csv-normalizado"] as const;
export type NormalizationSerializationId = typeof normalizationSerializationIds[number];
export type NormalizationSerializationOutcomes = Readonly<Record<NormalizationSerializationId, NormalizationCheckOutcome | Error>>;

export const normalizationSerializationChecks: readonly NormalizationCheck[] = normalizationSerializationIds.map((id) => ({
  id,
  evaluate: ({ observation, serialization, serializationError }) => {
    if (observation.providerId !== "gam") return { status: "no_aplicable", reason: "Circuito CSV–seed operativo exclusivo de GAM" };
    if (serializationError !== undefined) throw new Error(serializationError);
    const outcome = serialization?.[id];
    if (outcome instanceof Error) throw outcome;
    return outcome ?? { status: "no_evaluable", reason: "Sin adaptador de comprobación CSV–seed en memoria" };
  }
}));
