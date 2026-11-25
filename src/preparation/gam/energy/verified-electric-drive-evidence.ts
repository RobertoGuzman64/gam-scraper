import { createHash } from "node:crypto";
import type { ProductRecord, SpecsMap } from "../../../contracts/catalog.js";
import type { TechnicalRecoveryObservation } from "../../provenance/technical-recovery-observation.js";
import { platformElectricDriveEvidence } from "./verified-electric-drive-platform.js";
import { handlingElectricDriveEvidence } from "./verified-electric-drive-handling.js";

export type VerifiedElectricDrive = Readonly<{
  reference: string;
  brand: string;
  model: string;
  url: string;
  sourceHash: string;
}>;

const evidence: readonly VerifiedElectricDrive[] = [...platformElectricDriveEvidence, ...handlingElectricDriveEvidence];

const byReference = new Map(evidence.map((item) => [item.reference, item]));

const sourceHash = (record: ProductRecord): string => createHash("sha256")
  .update(JSON.stringify([
    record.providerId, record.reference, record.url, record.brand, record.model,
    record.categoryKey, record.condition, record.title, record.shortDescription, record.longDescription
  ])).digest("hex");

export const recoverGamVerifiedElectricDriveSpec = (record: ProductRecord, observe?: TechnicalRecoveryObservation): SpecsMap => {
  const source = record.specs ?? {};
  const item = byReference.get(record.reference ?? "");
  if (!item || record.providerId !== "gam" || record.condition !== "Segunda mano" ||
    (record.categoryKey !== "elevacion" && record.categoryKey !== "manutencion") ||
    record.url !== item.url || record.brand !== item.brand || record.model !== item.model ||
    source["Marca"] !== item.brand || source["Modelo"] !== item.model ||
    Object.keys(source).some((key) => /motor|motoriz|propulsi[oó]n|combustible/iu.test(key)) ||
    sourceHash(record) !== item.sourceHash) return source;
  const recovered = { ...source, "Motorización": "Eléctrico" };
  const lead = record.longDescription?.slice(0, 240) ?? "";
  const explicitlyElectric = /\bel[eé]ctric[oa]s?\b/iu.test(lead) &&
    !/\b(?:di[eé]sel|gasolina|glp|h[ií]brid[oa]s?)\b/iu.test(lead) &&
    !/\b(?:no|sin)\s+(?:es\s+)?el[eé]ctric[oa]s?\b/iu.test(lead) &&
    !/\b(?:opci[oó]n|opcional|alternativa)\b[^.!?;]{0,70}\bel[eé]ctric[oa]s?\b/iu.test(lead);
  observe?.(source, recovered, "src/preparation/gam/technical/energy/verified-electric-drive-evidence.ts",
    explicitlyElectric ? "longDescription" : undefined);
  return recovered;
};
