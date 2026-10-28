import { createHash } from "node:crypto";
import type { ProductRecord } from "../../../../../contracts/catalog.js";

const evidence = {
  reference: "4736",
  url: "https://online.gamrentals.com/es/plataformas-de-tijera-electricas-xcmg/4736-xg0807acw-li",
  title: "Plataforma elevadora de tijera eléctrica 8M XCMG XG0807ACW con batería de litio",
  summary: "➨ XCMG XG0807ACW-LI Nueva ➨ Venta de plataforma de tijera eléctrica de 8 metros de altura ⭐Capacidad de la cesta 230 kg",
  model: "XG0807ACW-LI",
  staleModel: "XG0807AC-LI",
  descriptionHash: "ebaa36ab3c80f1f71230aa856664c8df27399e243e914dc147af46deacba97be",
  specHash: "5a42276da348760beb2142979db3bafe5b2c4a2ec0770abc1064515e7531a410"
} as const;

const digest = (value: string): string => createHash("sha256").update(value).digest("hex");

export const reconcileGamVerifiedXcmg0807acwLithium = (record: ProductRecord): ProductRecord => {
  if (record.providerId !== "gam" || record.reference !== evidence.reference ||
    record.categoryKey !== "elevacion-nueva" || record.condition !== "Nuevo" ||
    record.brand !== "XCMG" || record.specs?.["Marca"] !== "XCMG" ||
    record.url !== evidence.url || record.title !== evidence.title ||
    record.shortDescription !== evidence.summary ||
    record.externalReference !== evidence.model ||
    record.model !== evidence.staleModel || record.specs?.["Modelo"] !== evidence.staleModel ||
    !record.longDescription || digest(record.longDescription) !== evidence.descriptionHash ||
    digest(JSON.stringify(record.specs)) !== evidence.specHash) return record;

  return {
    ...record,
    model: evidence.model,
    specs: {
      ...record.specs,
      Modelo: evidence.model,
      Longitud: "1900 mm",
      Anchura: "810 mm",
      Altura: "2160 mm",
      Peso: "1580 KG",
      "Altura de elevación (m)": "7,8 metros",
      "Dimensiones Cesta": "1,67X0,74 metros"
    }
  };
};
