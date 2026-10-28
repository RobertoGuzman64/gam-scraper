import { createHash } from "node:crypto";
import type { ProductRecord } from "../../../../../contracts/catalog.js";

const evidence = {
  reference: "2071",
  url: "https://online.gamrentals.com/es/carretillas-elevadoras-diesel-hyster/2071-carretilla-elevadora-diesel-hyster-h18xd-9",
  title: "Carretilla elevadora diésel 18200Kg Hyster H18XD-9",
  summary: "➨ HYSTER H18XD-9 ➨ Venta de Carretilla Elevadora Diésel 7 metros ⭐Capacidad de carga de 18200 kg",
  specHash: "d4d3ed64aee3816abbe0acb4cd692cc4c1c383a6ee79cd7e7c1ff5264efc0c8f",
  descriptionHash: "ea35ce89710fda1a8d26890e1800f07c9e53ec60573233ceb8f6d2f1f472d5cc"
} as const;

const digest = (value: string): string => createHash("sha256").update(value).digest("hex");

export const reconcileGamVerifiedHysterH18xdDiesel = (record: ProductRecord): ProductRecord => {
  if (record.providerId !== "gam" || record.reference !== evidence.reference ||
    record.categoryKey !== "carretillas-nuevas" || record.condition !== "Nuevo" ||
    record.url !== evidence.url || record.brand !== "HYSTER" ||
    record.model !== "H18XD-9" || record.externalReference !== "H18XD-9" ||
    record.title !== evidence.title || record.shortDescription !== evidence.summary ||
    !record.longDescription || digest(record.longDescription) !== evidence.descriptionHash ||
    record.specs?.["Marca"] !== "HYSTER" || record.specs?.["Modelo"] !== "H18XD-9" ||
    record.specs?.["Tipo motor"] !== "Kubota 3.8L LPG" ||
    record.specs?.["Peso"] !== "5795 KG" ||
    record.specs?.["Motorización"] !== "Diésel" ||
    record.specs?.["Capacidad de carga (kg)"] !== "18200 KG" ||
    record.specs?.["Centro de carga"] !== "900 mm" ||
    digest(JSON.stringify(record.specs)) !== evidence.specHash) return record;

  return {
    ...record,
    specs: { ...record.specs, "Tipo motor": "Mercedes-Benz OM934 Diésel", Peso: "22181 KG" }
  };
};
