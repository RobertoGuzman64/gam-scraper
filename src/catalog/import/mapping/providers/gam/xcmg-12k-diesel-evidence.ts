import { createHash } from "node:crypto";
import type { ProductRecord } from "../../../../../contracts/catalog.js";

const evidence = {
  reference: "4752",
  url: "https://online.gamrentals.com/es/plataforma-articulada-diesel-xcmg/4752-plataforma-articulada-diesel-xcmg-xga12k",
  title: "Plataforma elevadora articulada diésel 12M XCMG XGA12K",
  summary: "➨ XCMG XGA12K Nueva ➨ Venta de plataforma articulada diésel de 12 metros de altura ⭐Capacidad de la cesta 230 kg",
  model: "XGA12K",
  staleModel: "XGA12ACK",
  descriptionHash: "3914d75600aa1586ddd01533595cf1e974c522d6946180abb70ffa120e3d488d",
  specHash: "5c108be7366aa23b3c65ca51212a98233ad8889c3f45783edfdf2fe4f1328ed6"
} as const;

const digest = (value: string): string => createHash("sha256").update(value).digest("hex");

export const reconcileGamVerifiedXcmg12kDiesel = (record: ProductRecord): ProductRecord => {
  if (record.providerId !== "gam" || record.reference !== evidence.reference ||
    record.categoryKey !== "elevacion-nueva" || record.condition !== "Nuevo" ||
    record.brand !== "XCMG" || record.specs?.["Marca"] !== "XCMG" ||
    record.url !== evidence.url || record.title !== evidence.title ||
    record.shortDescription !== evidence.summary || record.externalReference !== evidence.model ||
    record.model !== evidence.staleModel || record.specs?.["Modelo"] !== evidence.staleModel ||
    record.specs?.["Tipo motor"] !== "Diésel" ||
    !record.longDescription || digest(record.longDescription) !== evidence.descriptionHash ||
    digest(JSON.stringify(record.specs)) !== evidence.specHash) return record;

  return {
    ...record,
    model: evidence.model,
    shortDescription: "➨ XCMG XGA12K Nueva ➨ Venta de plataforma articulada diésel de 12,5 metros de altura ⭐Capacidad de la cesta 230 kg",
    specs: {
      ...record.specs,
      Modelo: evidence.model,
      Longitud: "5900 mm",
      Anchura: "1800 mm",
      Altura: "2020 mm",
      Peso: "5600 KG",
      "Altura de elevación (m)": "12,5 metros",
      "Dimensiones Cesta": "1,4 x 0,7 metros"
    }
  };
};
