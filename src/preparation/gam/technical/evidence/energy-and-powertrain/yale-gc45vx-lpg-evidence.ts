import { createHash } from "node:crypto";
import type { ProductRecord } from "../../../../../contracts/catalog.js";

const evidence = {
  reference: "2312",
  url: "https://online.gamrentals.com/es/carretillas-elevadora-diesel-yale/2312-apilador-electrico-a-pie-yale-gc45vx",
  model: "GC45VX",
  title: "Carretilla elevadora eléctrica a pie Yale GC45VX",
  shortDescriptionHash: "eaed23c047ce66ac63a3b2c3bffeb92cf64a7f79fb9498e6950033f681f5c8de",
  longDescriptionHash: "f674619f288c04384c7895d3bed2f70643a015816b5093036ac693a61ba205d0",
  specsHash: "f779e29c71b93ca727948ccbd6e02eff13e3f083241db1478fdbcb956a3bb976"
} as const;

const prepared = {
  title: "Carretilla elevadora GLP Yale GC45VX",
  shortDescription: "Carretilla elevadora GLP Yale GC45VX de la serie Veracitor, con capacidad de carga nominal de 4.500 kg y motor Kubota 3.8L LPG.",
  longDescription: "La Yale GC45VX es una carretilla elevadora contrapesada de GLP de la serie Veracitor para operaciones de manutención. La ficha del fabricante Yale para la versión GLC45VX especifica una capacidad nominal de 4.500 kg a 500 mm de centro de carga, motor Kubota 3.8L LPG, radio de giro de 2.447 mm, ancho de 1.320 / 1.420 mm y peso de 6.977 kg. Incorpora opciones de transmisión Techtronix y puede configurarse según la aplicación.",
  shortDescriptionHash: "ee1a21d48725c4704722b04c444bb51ade7af4b0b0b8653853060761983c181d",
  longDescriptionHash: "84a9c921faaaa1989efe81dc7811711a17cc1d1c48004097f49efe25f5318f10",
  specsHash: "f3966bfaa99a4633d2a9921f13650e6baa012e91343dca457aa7f86fdd27c196"
} as const;

const correctedSpecs = {
  "Peso": "6977 KG",
  "Capacidad de carga (kg)": "4500 KG",
  "Radio de giro": "2447",
  "Ancho promedio": "1320 / 1420",
  "Motorización": "GLP"
} as const;

const digest = (value: string): string => createHash("sha256").update(value).digest("hex");

const identified = (record: ProductRecord): boolean =>
  record.providerId === "gam" && record.reference === evidence.reference &&
  record.url === evidence.url && record.categoryKey === "carretillas-nuevas" &&
  record.condition === "Nuevo" && record.externalReference === evidence.model &&
  record.brand === "YALE" && record.model === evidence.model &&
  record.specs?.["Marca"] === "YALE" && record.specs?.["Modelo"] === evidence.model &&
  record.specs?.["Tipo motor"] === "Kubota 3.8L LPG";

export const reconcileGamVerifiedYaleGc45vxLpg = (record: ProductRecord): ProductRecord => {
  if (!identified(record) || record.title !== evidence.title ||
    !record.shortDescription || !record.longDescription ||
    digest(record.shortDescription) !== evidence.shortDescriptionHash ||
    digest(record.longDescription) !== evidence.longDescriptionHash ||
    digest(JSON.stringify(record.specs)) !== evidence.specsHash) return record;

  return {
    ...record,
    title: prepared.title,
    shortDescription: prepared.shortDescription,
    longDescription: prepared.longDescription,
    specs: { ...record.specs, ...correctedSpecs }
  };
};

export const isGamVerifiedYaleGc45vxLpg = (record: ProductRecord): boolean =>
  identified(record) && record.title === prepared.title &&
  record.shortDescription !== null && record.longDescription !== null &&
  digest(record.shortDescription) === prepared.shortDescriptionHash &&
  digest(record.longDescription) === prepared.longDescriptionHash &&
  Object.entries(correctedSpecs).every(([key, value]) => record.specs?.[key] === value) &&
  digest(JSON.stringify(record.specs)) === prepared.specsHash;
