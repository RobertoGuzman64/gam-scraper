import type { ProductRecord } from "../../../../contracts/catalog.js";
import { gamHandlingReconciledCapacity } from "../measurements/capacity-evidence.js";

export const reconcileGamCorroboratedLoadCapacity = (record: ProductRecord): ProductRecord => {
  const capacity = gamHandlingReconciledCapacity(record);
  if (capacity === null || record.specs?.["Capacidad de carga (kg)"] === `${capacity} KG`) return record;
  return { ...record, specs: { ...record.specs, "Capacidad de carga (kg)": `${capacity} KG` } };
};
