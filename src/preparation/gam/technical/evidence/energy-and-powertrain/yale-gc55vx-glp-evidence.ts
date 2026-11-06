import { createHash } from "node:crypto";
import type { ProductRecord } from "../../../../../contracts/catalog.js";

const evidence = {
  reference: "2313",
  sourceUrl: "https://online.gamrentals.com/es/carretillas-elevadora-diesel-yale/2313-apilador-electrico-a-pie-yale-gc55vx",
  sourceTitle: "Carretilla elevadora Yale GC55VX",
  model: "GC55VX",
  shortDescriptionHash: "b6bb9f45eed8027a2fc7078ee0752bde0c2acc5bab50e16b8523a04952de80ac",
  longDescriptionHash: "6669268b678a14cd04dc2b770698a98fdddee72d212ae9dae4cc9c27a266148f",
  specsHash: "a8bc15f92a605fa45a3e7398d849d749cbcf3b2e22a9343285876cc7c4dadc53",
  preparedLongDescriptionHash: "2ac259ee61ce8bd099bb0d770deb2075487f12f3e5ff2230529c61371635c64f",
  preparedSpecsHash: "bc00ceef21f29bc9f3c456bca4476963cfe72fb5e74c9f47ab0d9ff667624ccb"
} as const;

const digest = (value: string): string => createHash("sha256").update(value).digest("hex");

const identified = (record: ProductRecord): boolean =>
  record.providerId === "gam" && record.reference === evidence.reference &&
  record.categoryKey === "carretillas-nuevas" && record.condition === "Nuevo" &&
  record.url === evidence.sourceUrl && record.externalReference === evidence.model &&
  record.brand === "YALE" && record.model === evidence.model &&
  record.specs?.["Marca"] === "YALE" && record.specs?.["Modelo"] === evidence.model &&
  record.specs?.["Tipo motor"] === "Kubota 3.8L LPG" &&
  record.specs?.["Capacidad de carga (kg)"] === "5500 KG" &&
  record.specs?.["Motorización"] === "Eléctrico" &&
  digest(JSON.stringify(record.specs)) === evidence.specsHash;

const correctedTitle = "Carretilla elevadora GLP Yale GC55VX";

export const reconcileGamVerifiedYaleGc55vxGlp = (record: ProductRecord): ProductRecord => {
  if (!identified(record) || record.title !== evidence.sourceTitle || !record.shortDescription ||
    !record.longDescription || digest(record.shortDescription) !== evidence.shortDescriptionHash ||
    digest(record.longDescription) !== evidence.longDescriptionHash) return record;

  return {
    ...record,
    title: correctedTitle,
    longDescription: record.longDescription.replaceAll(/diésel/gi, "GLP"),
    specs: { ...record.specs, "Motorización": "GLP" }
  };
};

export const isGamVerifiedYaleGc55vxGlp = (record: ProductRecord): boolean => {
  return record.providerId === "gam" && record.reference === evidence.reference &&
    record.categoryKey === "carretillas-nuevas" && record.condition === "Nuevo" &&
    record.url === evidence.sourceUrl && record.externalReference === evidence.model &&
    record.brand === "YALE" && record.model === evidence.model &&
    record.title === correctedTitle && record.shortDescription !== null &&
    record.longDescription !== null &&
    record.specs?.["Marca"] === "YALE" && record.specs?.["Modelo"] === evidence.model &&
    record.specs?.["Tipo motor"] === "Kubota 3.8L LPG" &&
    record.specs?.["Capacidad de carga (kg)"] === "5500 KG" &&
    record.specs?.["Motorización"] === "GLP" &&
    digest(record.shortDescription) === evidence.shortDescriptionHash &&
    digest(record.longDescription) === evidence.preparedLongDescriptionHash &&
    digest(JSON.stringify(record.specs)) === evidence.preparedSpecsHash;
};
