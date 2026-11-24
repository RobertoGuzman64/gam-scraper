import { createHash } from "node:crypto";
import type { ProductRecord } from "../../../contracts/catalog.js";

const documentedSource = "f01efdb611e67ef3cd04c7995b0bd9f06a467a2e2e4bfcca4986af856684e9d0";

export const reconcileGomarizDocumented1cxFuel = (record: ProductRecord): ProductRecord => {
  if (record.providerId !== "gomariz" || record.reference !== "RE454" ||
    record.url !== "https://www.gomarizrent.com/venta/movimiento-de-tierras-demolicion-y-compactacion/retroexcavadora/jcb-1cx-retroexcavadora-backhoe-gomariz-1/" ||
    record.categoryKey !== "venta" || record.condition !== "Segunda mano" ||
    record.brand !== "Jcb" || record.model !== "1CX" || record.title !== "JCB 1CX" ||
    record.year !== "1998" || record.specs?.Motor !== "Eléctrico" ||
    record.specs.Peso !== "3158 KG" || record.specs.Capacidad !== "660 kg" ||
    !record.longDescription) return record;
  const hash = createHash("sha256").update(JSON.stringify([
    record.title, record.shortDescription, record.longDescription, record.specs
  ])).digest("hex");
  if (hash !== documentedSource) return record;
  return { ...record, specs: { ...record.specs, Motor: "Diésel" } };
};
