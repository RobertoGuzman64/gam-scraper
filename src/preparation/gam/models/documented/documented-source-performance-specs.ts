import { applyDocumentedTechnicalEvidence, type DocumentedTechnicalUnit } from "../../../technical/evidence/documented-technical-evidence.js";
import type { ProductRecord, SpecsMap } from "../../../../contracts/catalog.js";
import type { TechnicalRecoveryObservation } from "../../../provenance/technical-recovery-observation.js";
import { handlingPerformanceUnits } from "./source-performance-handling.js";
import { cleaningPerformanceUnits } from "./source-performance-cleaning.js";
import { liftingPerformanceUnits } from "./source-performance-lifting.js";
import { mobilityPerformanceUnits } from "./source-performance-mobility.js";
import { energyPerformanceUnits } from "./source-performance-energy.js";

const documentedUnits: Readonly<Record<string, DocumentedTechnicalUnit>> = {
  ...handlingPerformanceUnits,
  ...cleaningPerformanceUnits,
  ...liftingPerformanceUnits,
  ...mobilityPerformanceUnits,
  ...energyPerformanceUnits
};

export const recoverGamDocumentedSourcePerformanceSpecs = (record: ProductRecord, specs: SpecsMap, observe?: TechnicalRecoveryObservation): SpecsMap =>
  applyDocumentedTechnicalEvidence(record, specs, documentedUnits, {
    providerId: "gam",
    isEligible: (value) => value.url.startsWith("https://online.gamrentals.com/es/"),
    exactTitleAndUrl: true
  }, observe, "src/preparation/gam/technical/models/documented-source-performance-specs.ts");
