import { createHash } from "node:crypto";
import type { ProductRecord } from "../../../../../contracts/catalog.js";

const sourceDigest = "4381e2d1ea854fa5a25e06fe6029e917620b0de342b707554cdc3bd7aa6d8763";

const replacements: readonly (readonly [string, string])[] = [
  ["43 metros", "43,2 metros"],
  ["capacidad de carga de 230 kg", "capacidad de carga de 300 kg sin limitación y 460 kg con limitación"],
  ["Capacidad de carga: 230 kg", "Capacidad de carga: 300 kg sin limitación / 460 kg con limitación"],
  ["hasta 230 kg", "hasta 460 kg con limitación (300 kg sin limitación)"],
  ["motor diésel Perkins 404J-E22T (Tier 3)", "motor diésel Kubota V3307"],
  ["Diésel Perkins 404J-E22T (Tier 3 / Stage IIIA)", "Diésel Kubota V3307"],
  ["motor Perkins eficiente", "motor Kubota eficiente"],
  ["motor diésel Perkins 404J-E22T,", "motor diésel Kubota V3307,"],
  ["Altura máxima de trabajo: 43 m", "Altura máxima de trabajo: 43,2 m"],
  ["Altura de elevación hasta cesta: 41 m", "Altura de elevación hasta cesta: 41,2 m"],
  ["Longitud total: 12.500 mm", "Longitud total: 12.928 mm"],
  ["Altura total: 3.080 mm", "Altura total: 3.100 mm"],
  ["Peso total: 20.500 kg", "Peso total: 24.500 kg"],
  ["Pendiente superable: 45 % (≈25°)", "Pendiente superable: 40 % (≈22°)"],
  ["Dimensiones de la cesta: 2.440 × 910 mm", "Dimensiones de la cesta: 2.440 × 900 mm"],
  ["Radio de giro mínimo: 7,8 m ", ""]
];

export const reconcileGamVerifiedXga43kEditorial = (record: ProductRecord): ProductRecord => {
  if (record.providerId !== "gam" || record.reference !== "5902" ||
    record.categoryKey !== "elevacion-nueva" || record.condition !== "Nuevo" ||
    record.url !== "https://online.gamrentals.com/es/xcmg/5902-plataforma-articulada-diesel-xcmg-xga36k" ||
    record.title !== "Plataforma articulada diésel XCMG XGA43K" ||
    record.shortDescription !== "➨ XCMG XGA36K Nueva ➨ Venta de plataforma articulada diésel de 43 metros de altura ⭐Capacidad de la cesta 230 kg" ||
    record.brand !== "XCMG" || record.model !== "XGA43K" || record.externalReference !== "XGA43K" ||
    record.specs?.["Marca"] !== "XCMG" || record.specs?.["Modelo"] !== "XGA43K" ||
    record.specs?.["Altura de elevación (m)"] !== "43 metros" ||
    record.specs?.["Capacidad de carga (kg)"] !== "460 KG" ||
    record.specs?.["Pendiente superable"] !== "40%" ||
    record.specs?.["Dimensiones Cesta"] !== "2,44X0,90 metros" ||
    record.specs?.["Peso"] !== "24500 KG" ||
    record.specs?.["Tipo motor"] !== "Diésel" ||
    !record.longDescription ||
    createHash("sha256").update(record.longDescription).digest("hex") !== sourceDigest) return record;
  let longDescription = record.longDescription;
  for (const [before, after] of replacements) {
    if (!longDescription.includes(before)) return record;
    longDescription = longDescription.replaceAll(before, after);
  }
  return {
    ...record,
    shortDescription: "➨ XCMG XGA43K Nueva ➨ Venta de plataforma articulada diésel de 43,2 metros de altura ⭐Capacidad de la cesta 300 kg sin limitación / 460 kg con limitación",
    longDescription
  };
};
