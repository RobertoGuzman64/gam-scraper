import { createHash } from "node:crypto";
import type { ProductRecord } from "../../../../../contracts/catalog.js";

const evidence = {
  reference: "4737",
  url: "https://online.gamrentals.com/es/plataformas-de-tijera-electricas-xcmg/4737-xcmg-xg0810c",
  title: "Plataforma de tijera eléctrica orugas 8M XCMG XG0810C",
  summary: "➨ XCMG XG0810C Nueva ➨ Venta de plataforma de tijera eléctrica de 8 metros de altura ⭐Capacidad de la cesta 250 kg",
  model: "XG0810C",
  staleModel: "XG0807ACW-LI",
  descriptionHash: "c26d04153003e485e394dc5bb656adb0ec5dc079ea037f3c05d8cf55618aabfe",
  specHash: "65ce4386b6753ae732eca0027385cbe10f625b155732ac5cbc01289d2339bd05"
} as const;

const digest = (value: string): string => createHash("sha256").update(value).digest("hex");

export const reconcileGamVerifiedXcmg0810Crawler = (record: ProductRecord): ProductRecord => {
  if (record.providerId !== "gam" || record.reference !== evidence.reference ||
    record.categoryKey !== "elevacion-nueva" || record.condition !== "Nuevo" ||
    record.brand !== "XCMG" || record.specs?.["Marca"] !== "XCMG" ||
    record.url !== evidence.url || record.title !== evidence.title ||
    record.shortDescription !== evidence.summary || record.externalReference !== evidence.model ||
    record.model !== evidence.staleModel || record.specs?.["Modelo"] !== evidence.staleModel ||
    !record.longDescription || digest(record.longDescription) !== evidence.descriptionHash ||
    digest(JSON.stringify(record.specs)) !== evidence.specHash) return record;

  return {
    ...record,
    model: evidence.model,
    specs: { ...record.specs, Modelo: evidence.model },
    longDescription: record.longDescription
      .replace("orugas y ruedas no marcantes", "orugas de goma")
      .replace("superar pendientes de hasta un 25%", "superar pendientes de hasta un 30%")
  };
};
