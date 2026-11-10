import type { ProductRecord, SpecsMap } from "../../../../contracts/catalog.js";
import { recoverGamDocumentedWarehouseCleaningAndLiftingSpecs } from "./documented-warehouse-cleaning-and-lifting-specs.js";
import { recoverGamDocumentedLogitransHandlingSpecs } from "./documented-logitrans-handling-specs.js";
import { recoverGamDocumentedHandlingAndIndustrialSpecs } from "./documented-handling-and-industrial-specs.js";
import { recoverGamDocumentedModulaStorageSpecs } from "./documented-modula-storage-specs.js";

export const recoverGamDocumentedHandlingAndStorageSpecs = (record: ProductRecord, specs: SpecsMap): SpecsMap => {
  const warehouseSpecs = recoverGamDocumentedWarehouseCleaningAndLiftingSpecs(record, specs);
  const logitransSpecs = recoverGamDocumentedLogitransHandlingSpecs(record, warehouseSpecs);
  const handlingSpecs = recoverGamDocumentedHandlingAndIndustrialSpecs(record, logitransSpecs);
  return recoverGamDocumentedModulaStorageSpecs(record, handlingSpecs);
};
