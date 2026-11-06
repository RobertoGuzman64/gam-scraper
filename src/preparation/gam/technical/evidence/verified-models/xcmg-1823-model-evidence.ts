import { createHash } from "node:crypto";
import type { ProductRecord } from "../../../../../contracts/catalog.js";

const evidence = {
  reference: "4751",
  url: "https://online.gamrentals.com/es/plataformas-de-tijera-diesel-xcmg/4751-plataforma-de-tijera-diesel-xcmg-xg1823rt",
  title: "Plataforma elevadora de tijera diésel 4x4 18M XCMG XG1823RT",
  summary: "➨ XCMG XG1823RT Nueva ➨ Venta de plataforma de tijera diésel de 18 metros de altura ⭐Capacidad de la cesta 680 kg",
  model: "XG1823RT",
  staleModel: "XG1523RT",
  descriptionHash: "35a9a3c32cd4aca0e4b31049c96d9a8140d63f813870799537a74e8f12dbaf30",
  specHash: "e53753b3423cd477d49160bbd456641767febe189d2d3894e162e53cb1af3640"
} as const;

const digest = (value: string): string => createHash("sha256").update(value).digest("hex");

export const reconcileGamVerifiedXcmg1823Model = (record: ProductRecord): ProductRecord => {
  if (record.providerId !== "gam" || record.reference !== evidence.reference ||
    record.categoryKey !== "elevacion-nueva" || record.condition !== "Nuevo" ||
    record.brand !== "XCMG" || record.specs?.["Marca"] !== "XCMG" ||
    record.url !== evidence.url || record.title !== evidence.title ||
    record.shortDescription !== evidence.summary ||
    record.externalReference !== evidence.model ||
    record.model !== evidence.staleModel || record.specs?.["Modelo"] !== evidence.staleModel ||
    !record.longDescription || digest(record.longDescription) !== evidence.descriptionHash ||
    digest(JSON.stringify(record.specs)) !== evidence.specHash) return record;
  return { ...record, model: evidence.model, specs: { ...record.specs, Modelo: evidence.model } };
};
