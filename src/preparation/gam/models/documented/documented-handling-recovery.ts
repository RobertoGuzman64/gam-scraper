import type { ProductRecord, SpecsMap } from "../../../../contracts/catalog.js";
import type { TechnicalRecoveryObservation } from "../../../provenance/technical-recovery-observation.js";
import { recoverGamDocumentedWarehouseCleaningAndLiftingSpecs } from "./documented-warehouse-cleaning-and-lifting-specs.js";
import { recoverGamDocumentedLogitransHandlingSpecs } from "./documented-logitrans-handling-specs.js";
import { recoverGamDocumentedHandlingAndIndustrialSpecs } from "./documented-handling-and-industrial-specs.js";
import { recoverGamDocumentedModulaStorageSpecs } from "./documented-modula-storage-specs.js";

export const recoverGamDocumentedHandlingAndStorageSpecs = (
  record: ProductRecord, specs: SpecsMap, observe?: TechnicalRecoveryObservation
): SpecsMap => {
  const warehouseSpecs = recoverGamDocumentedWarehouseCleaningAndLiftingSpecs(record, specs, observe);
  observe?.(specs, warehouseSpecs, "src/preparation/gam/technical/models/documented-warehouse-cleaning-and-lifting-specs.ts");
  const logitransSpecs = recoverGamDocumentedLogitransHandlingSpecs(record, warehouseSpecs, observe);
  observe?.(warehouseSpecs, logitransSpecs, "src/preparation/gam/technical/models/documented-logitrans-handling-specs.ts");
  const handlingSpecs = recoverGamDocumentedHandlingAndIndustrialSpecs(record, logitransSpecs, observe);
  observe?.(logitransSpecs, handlingSpecs, "src/preparation/gam/technical/models/documented-handling-and-industrial-specs.ts");
  const modulaSpecs = recoverGamDocumentedModulaStorageSpecs(record, handlingSpecs, observe);
  observe?.(handlingSpecs, modulaSpecs, "src/preparation/gam/technical/models/documented-modula-storage-specs.ts");
  return modulaSpecs;
};
