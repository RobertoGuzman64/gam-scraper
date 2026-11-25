import { createHash } from "node:crypto";
import type { ProductRecord, SpecsMap } from "../../../../contracts/catalog.js";
import type { TechnicalRecoveryObservation } from "../../../provenance/technical-recovery-observation.js";
import { validMercaelevaTechnicalSource } from "../../technical/technical.js";
import { profiles } from "./platform-profiles.js";
import { verifiedUnits } from "./platform-verified-units.js";

const sourceFingerprint = (record: ProductRecord): string => createHash("sha256").update(JSON.stringify({
  reference: record.reference,
  url: record.url,
  title: record.title,
  brand: record.brand,
  model: record.model,
  year: record.year,
  condition: record.condition,
  horometer: record.horometer,
  longDescription: record.longDescription,
  specs: record.specs
})).digest("hex");

export const recoverMercaelevaDocumentedPlatformTechnicalSpecs = (record: ProductRecord, specs: SpecsMap, observe?: TechnicalRecoveryObservation): SpecsMap => {
  if (!validMercaelevaTechnicalSource(record) || record.categoryKey !== "venta" ||
    record.condition !== "Segunda mano" || !record.reference || !record.specs ||
    verifiedUnits[record.reference] !== sourceFingerprint(record) ||
    !record.url.endsWith(`-${record.reference}`) || !record.year ||
    record.specs["Año de fabricación"] !== record.year ||
    record.specs["Marca"] !== record.brand || record.specs["Modelo"] !== record.model) return specs;

  const profile = profiles.find((entry) => entry.brand === record.brand && entry.model === record.model && entry.title === record.specs?.["Título adicional"]);
  if (!profile || record.specs["Título adicional"] !== profile.title ||
    record.specs["Tipo de motor"] !== profile.motor || record.specs["Altura de trabajo"] !== profile.workHeight ||
    Object.keys(profile.specifications).some((key) => key in specs)) return specs;

  const documentedSpecs = record.model === "450 AJ" && /\/JLG-450-AJ-SIII-/u.test(record.url)
    ? Object.fromEntries(Object.entries(profile.specifications).filter(([key]) => key !== "Capacidad máxima de plataforma"))
    : record.model === "Optimum 8"
      ? { ...profile.specifications, ...(record.year === "2018" && record.longDescription?.includes("OPTIMUM 8 AC")
        ? { "Altura de plataforma": "5,77 m", "Anchura total": "0,79 m" }
        : { "Altura de plataforma": "5,8 m", "Anchura total": "0,76 m" }) }
      : profile.specifications;
  if (Object.keys(documentedSpecs).some((key) => key in specs)) return specs;
  const recovered = { ...specs, ...documentedSpecs };
  const mechanism = "src/preparation/mercaeleva/technical/evidence/documented-platform-technical-specs.ts";
  const fieldSources: Readonly<Record<string, string>> = "fieldSources" in profile ? profile.fieldSources : {};
  for (const [field, value] of Object.entries(documentedSpecs)) {
    const documentUrl = fieldSources[field] ?? profile.source;
    const editorialRuleId = createHash("sha256").update(JSON.stringify([
      mechanism, profile.brand, profile.model, profile.workHeight, profile.motor, profile.title,
      documentUrl, field, value
    ])).digest("hex");
    observe?.(specs, { ...specs, [field]: value }, mechanism, undefined,
      { scope: "model-document", document: { url: documentUrl,
        brand: profile.brand, model: profile.model } }, editorialRuleId);
  }
  observe?.(specs, recovered, mechanism);
  return recovered;
};
