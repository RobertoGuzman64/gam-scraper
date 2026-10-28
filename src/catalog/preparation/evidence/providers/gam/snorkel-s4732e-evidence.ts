import { createHash } from "node:crypto";
import type { ProductRecord } from "../../../../../contracts/catalog.js";

const evidence = {
  reference: "6236",
  url: "https://online.gamrentals.com/es/plataformas-elevadoras-tijera-electricas-segunda-mano/6236-2017-snorkel-s3219e",
  externalReference: "GAM-04167",
  serialNumber: "S4732E-01-180200369",
  title: "Plataforma tijera eléctrica 8M SNORKEL S3219E",
  shortDescriptionHash: "81dc3ff2488a32451fc08e1c9bd6186f337cc031ba183432cfefeedcf5511b25",
  longDescriptionHash: "dcd66714cb42940437364c0be61d94c6a5eec98d5a38b8f998bc1239c51df34b",
  specsHash: "25ef019d8ca505f4cf6b870444747b4a4682416dac061c2362dc0c20e0b45705"
} as const;

const digest = (value: string): string => createHash("sha256").update(value).digest("hex");

export const reconcileGamVerifiedSnorkelS4732e = (record: ProductRecord): ProductRecord => {
  if (record.providerId !== "gam" || record.reference !== evidence.reference ||
    record.categoryKey !== "elevacion" || record.condition !== "Segunda mano" ||
    record.url !== evidence.url || record.externalReference !== evidence.externalReference ||
    record.brand !== "SNORKEL" || record.model !== "S4732E" ||
    record.serialNumber !== evidence.serialNumber || record.year !== "2018" ||
    record.location !== "MÉRIDA" || record.title !== evidence.title ||
    !record.shortDescription || digest(record.shortDescription) !== evidence.shortDescriptionHash ||
    !record.longDescription || digest(record.longDescription) !== evidence.longDescriptionHash ||
    record.specs?.["Marca"] !== "SNORKEL" || record.specs?.["Modelo"] !== "S4732E" ||
    record.specs?.["Nº de serie"] !== evidence.serialNumber ||
    record.specs?.["Altura de elevación (m)"] !== "12 metros" ||
    record.specs?.["Capacidad de carga (kg)"] !== "350 KG" ||
    digest(JSON.stringify(record.specs)) !== evidence.specsHash) return record;

  const description = record.longDescription
    .replaceAll("SNORKEL S3219E", "SNORKEL S4732E")
    .replace("Con una altura de elevación de 8 metros", "Con una altura de trabajo de aproximadamente 12 metros")
    .replace("una capacidad de carga de 250 kg", "una capacidad de carga de 350 kg");

  return {
    ...record,
    title: "Plataforma tijera eléctrica 12M SNORKEL S4732E",
    shortDescription: "➨ SNORKEL S4732E Segunda Mano ➨ Venta de plataforma de tijera eléctrica de 12 metros de altura de ocasión ⭐Capacidad de la cesta 350 kg ➨ Año 2018",
    longDescription: description
  };
};
