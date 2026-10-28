import { createHash } from "node:crypto";
import type { ProductRecord } from "../../../../../contracts/catalog.js";

const evidence = {
  reference: "2311",
  url: "https://online.gamrentals.com/es/yale/2311-apilador-electrico-a-pie-yale-gc40vx",
  model: "GC40VX",
  title: "Carretilla elevadora diésel Yale GC40VX",
  descriptionHash: "99c42dae15f9da257a35cbae09f1afe6929e84d4423286f5d78492bdbf502c43",
  specsHash: "646d1b59edcaa2cd2f56560e7dda34d5678e8cee7f01d417a51140d544d57df4"
} as const;

const digest = (value: string): string => createHash("sha256").update(value).digest("hex");

const identified = (record: ProductRecord): boolean =>
  record.providerId === "gam" && record.reference === evidence.reference &&
  record.url === evidence.url && record.categoryKey === "carretillas-nuevas" &&
  record.condition === "Nuevo" && record.externalReference === evidence.model &&
  record.brand === "YALE" && record.model === evidence.model &&
  record.specs?.["Marca"] === "YALE" && record.specs?.["Modelo"] === evidence.model;

const correctedTitle = "Carretilla elevadora GLP Yale GC40VX";

const correctedSpecs = {
  "Peso": "5795 KG",
  "Capacidad de carga (kg)": "4000 KG",
  "Radio de giro": "2298",
  "Ancho promedio": "1170 / 1270",
  "Motorización": "GLP"
} as const;

const correctedDescription = (value: string): string => value.replaceAll("Hyster", "Yale");

export const reconcileGamVerifiedYaleGc40vxLpg = (record: ProductRecord): ProductRecord => {
  if (!identified(record) || record.title !== evidence.title ||
    !record.shortDescription || !record.longDescription ||
    digest(record.shortDescription) !== evidence.descriptionHash ||
    digest(record.longDescription) !== evidence.descriptionHash ||
    digest(JSON.stringify(record.specs)) !== evidence.specsHash) return record;

  return {
    ...record,
    title: correctedTitle,
    shortDescription: correctedDescription(record.shortDescription),
    longDescription: correctedDescription(record.longDescription),
    specs: { ...record.specs, ...correctedSpecs }
  };
};

export const isGamVerifiedYaleGc40vxLpg = (record: ProductRecord): boolean =>
  identified(record) && record.title === correctedTitle &&
  record.shortDescription !== null && record.longDescription !== null &&
  digest(record.shortDescription) === correctedDescriptionHash &&
  digest(record.longDescription) === correctedDescriptionHash &&
  record.specs?.["Tipo motor"] === "Kubota 3.8L LPG" &&
  Object.entries(correctedSpecs).every(([key, value]) => record.specs?.[key] === value) &&
  digest(JSON.stringify(record.specs)) === correctedSpecsHash;

const correctedDescriptionHash = "e644b3e120d16553cf5197ef3a222f4837eef68b23679bfea08eae3e4aa48f84";
const correctedSpecsHash = "07b2068e0a8fdbd9500a1c5dab33afe3e940642953c94819821131a434be1932";
