import { createHash } from "node:crypto";
import type { ProductRecord } from "../../../../../contracts/catalog.js";

const descriptionDigest = "6a4ab6a3009840744779b4c6b64a7d0875ffece6f0eb145e454c6f0652c6fd70";

export const reconcileGamVerifiedGenie5390Editorial = (record: ProductRecord): ProductRecord => {
  if (record.providerId !== "gam" || record.reference !== "6622" ||
    record.categoryKey !== "elevacion" || record.condition !== "Segunda mano" ||
    record.url !== "https://online.gamrentals.com/es/plataformas-elevadoras-tijera-diesel-segunda-mano/6622-2014-genie-gs-5390" ||
    record.title !== "JLG 1930ES | Plataforma Tijera Diésel 8M | GAM Online" ||
    record.shortDescription !== "➨ JLG 1930ES Segunda Mano ➨ Venta de plataforma de tijera diésel de 8 metros de altura de ocasión ⭐Capacidad de la cesta 230 kg ➨ Año 2014" ||
    record.brand !== "GENIE" || record.model !== "GS-5390" ||
    record.externalReference !== "JP-00309" || record.year !== "2014" ||
    record.serialNumber !== "GS9014-49569" || record.location !== "ALICANTE" ||
    record.specs?.["Marca"] !== "GENIE" || record.specs?.["Modelo"] !== "GS-5390" ||
    record.specs?.["Nº de serie"] !== "GS9014-49569" ||
    record.specs?.["Horómetro"] !== "1709 horas" ||
    record.specs?.["Altura de elevación (m)"] !== "18 metros" ||
    record.specs?.["Capacidad de carga (kg)"] !== "680 KG" ||
    record.specs?.["Pendiente superable"] !== "40%" ||
    !record.longDescription ||
    createHash("sha256").update(record.longDescription).digest("hex") !== descriptionDigest) return record;
  return {
    ...record,
    title: "Plataforma tijera diésel 18M GENIE GS-5390",
    shortDescription: "➨ GENIE GS-5390 Segunda Mano ➨ Venta de plataforma de tijera diésel de 18 metros de altura de ocasión ⭐Capacidad de la cesta 680 kg ➨ Año 2014"
  };
};
