import { createHash } from "node:crypto";
import type { ProductRecord } from "../../../../../contracts/catalog.js";

const evidence = {
  reference: "2314",
  sourceUrl: "https://online.gamrentals.com/es/carretillas-elevadora-diesel-yale/2314-apilador-electrico-a-pie-yale-gc60vx",
  model: "GC60VX",
  title: "Carretilla elevadora diésel 6000Kg Yale GC60VX",
  shortDescriptionHash: "ccf0a25fa64cd65d635ec4dc989192e882508c64807df67790947862f5625d37",
  longDescriptionHash: "a283e3bbe0b3941119a4ea4f3d874c0d3fff6f3c7ab0b712b668d8d34858edf8",
  specsHash: "ee1851e13257c62197cfcf471818049135e192b0f581d8233d4f048bfc64063d"
} as const;

const digest = (value: string): string => createHash("sha256").update(value).digest("hex");

export const reconcileGamVerifiedYaleGc60vx = (record: ProductRecord): ProductRecord => {
  if (record.providerId !== "gam" || record.reference !== evidence.reference ||
    record.categoryKey !== "carretillas-nuevas" || record.condition !== "Nuevo" ||
    record.url !== evidence.sourceUrl || record.externalReference !== evidence.model ||
    record.brand !== "YALE" || record.model !== evidence.model ||
    record.title !== evidence.title || !record.shortDescription || !record.longDescription ||
    digest(record.shortDescription) !== evidence.shortDescriptionHash ||
    digest(record.longDescription) !== evidence.longDescriptionHash ||
    record.specs?.["Marca"] !== "YALE" || record.specs?.["Modelo"] !== evidence.model ||
    record.specs?.["Tipo motor"] !== "Kubota 3.8L Diesel / PSI 4.3L LPG" ||
    record.specs?.["Capacidad de carga (kg)"] !== "6000 KG" ||
    record.specs?.["Altura de elevación (mm)"] !== "5600 mm" ||
    record.specs?.["Motorización"] !== "Eléctrico" ||
    digest(JSON.stringify(record.specs)) !== evidence.specsHash) return record;

  return {
    ...record,
    shortDescription: record.shortDescription.replace("Diésel 6 metros", "Diésel 5,6 metros"),
    longDescription: record.longDescription.replaceAll("Diésel a Pie Yale GC60VX", "Diésel Yale GC60VX"),
    specs: { ...record.specs, "Motorización": "Diésel" }
  };
};
