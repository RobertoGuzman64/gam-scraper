import { createHash } from "node:crypto";
import type { ProductRecord } from "../../../../../contracts/catalog.js";

const verified = [
  {
    reference: "4750",
    url: "https://online.gamrentals.com/es/plataformas-de-tijera-diesel-xcmg/4750-plataforma-de-tiejra-diesel-xcmg-xg1523rt",
    title: "Plataforma elevadora de tijera diésel 4x4 15M XCMG XG1523RT",
    summary: "➨ XCMG XG1523RT Nueva ➨ Venta de plataforma de tijera diésel de 15 metros de altura ⭐Capacidad de la cesta 680 kg",
    model: "XG1523RT",
    staleModel: "XG1523ERT",
    descriptionHash: "4c3363c555ee515ecb7f30cc790bf430960ba1d5aa313b2c993cf18efd27ab38",
    specHash: "29f5a74b293a9eeb42d9ffb74546707f45540eff56daa6162259bcf416f6300a"
  },
  {
    reference: "4802",
    url: "https://online.gamrentals.com/es/plataformas-de-tijera-electricas-xcmg/4802-plataforma-de-tijera-electrica-4x4-xcmg-xg1523ert",
    title: "Plataforma de tijera eléctrica15M 4x4 XCMG XG1523ERT",
    summary: "➨ XCMG XG1523ERT Nueva ➨ Venta de plataforma tijera eléctrica de 15 metros de altura ⭐Capacidad de la cesta 700 kg",
    model: "XG1523ERT",
    staleModel: "XG1418ERT",
    descriptionHash: "1824bf1780642ddc04bdac6a5c69859ae021de1ccce083dfb884b10844e7466e",
    specHash: "3a3d2b29b08dfaa2c77f384ed0a2eae906b8539cd23b9cf8dd03d51ae1fef578"
  }
] as const;

const digest = (value: string): string => createHash("sha256").update(value).digest("hex");

export const reconcileGamVerifiedXcmg1523Model = (record: ProductRecord): ProductRecord => {
  if (record.providerId !== "gam" || record.categoryKey !== "elevacion-nueva" ||
    record.condition !== "Nuevo" || record.brand !== "XCMG" ||
    record.specs?.["Marca"] !== "XCMG" || !record.longDescription) return record;
  const evidence = verified.find((candidate) => candidate.reference === record.reference);
  if (!evidence || record.url !== evidence.url || record.title !== evidence.title ||
    record.shortDescription !== evidence.summary || record.externalReference !== evidence.model ||
    record.model !== evidence.staleModel || record.specs?.["Modelo"] !== evidence.staleModel ||
    digest(record.longDescription) !== evidence.descriptionHash ||
    digest(JSON.stringify(record.specs)) !== evidence.specHash) return record;
  return { ...record, model: evidence.model, specs: { ...record.specs, Modelo: evidence.model } };
};
