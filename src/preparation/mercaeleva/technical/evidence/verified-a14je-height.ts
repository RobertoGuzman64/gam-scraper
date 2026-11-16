import { createHash } from "node:crypto";
import type { ProductRecord } from "../../../../contracts/catalog.js";

const evidence = {
  reference: "M887-9469",
  url: "https://sales.mercaeleva.com/es/for-sale/machine/LGMG-A14JE-M887-9469",
  brand: "LGMG",
  model: "A14JE",
  sourceHash: "84aa0917b8ad05af53a680c6238a17f11d1103b13ba0e7db334bc9dfb446aecd",
  manufacturer: "https://www.lgmglifts.com/product/pro-detail-616.htm"
} as const;

export const reconcileMercaelevaVerifiedA14jeHeight = (record: ProductRecord): ProductRecord => {
  if (record.providerId !== "mercaeleva" || record.reference !== evidence.reference ||
    record.url !== evidence.url || record.brand !== evidence.brand || record.model !== evidence.model ||
    record.condition !== "Segunda mano" || record.categoryKey !== "venta" ||
    record.year !== "2023" || record.horometer !== "298" || record.price !== "32500" ||
    record.specs?.Modelo !== evidence.model ||
    record.specs.Marca !== evidence.brand || record.specs["Altura de trabajo"] !== "16 m" ||
    record.specs["Título adicional"] !== "PLATAFORMA ARTICULADA ELECTRICA 15 MT" ||
    record.title !== "LGMG A14JE PLATAFORMA ARTICULADA ELECTRICA 15 MT" ||
    record.longDescription !== "Ref.1332 PLATAFORMA ARTICULADA ELECTRICA ALTURA DE TRABAJO 16 MT LGMG A14JE HORAS 298 AÑO DE FABRICACION 2023" ||
    createHash("sha256").update(JSON.stringify([
      record.title, record.shortDescription, record.longDescription, record.specs
    ])).digest("hex") !== evidence.sourceHash) return record;
  return {
    ...record,
    title: record.title.replace("15 MT", "15,8 MT"),
    longDescription: record.longDescription.replace("16 MT", "15,8 MT"),
    specs: {
      ...record.specs,
      "Título adicional": "PLATAFORMA ARTICULADA ELECTRICA 15,8 MT",
      "Altura de trabajo": "15,8 m"
    }
  };
};
