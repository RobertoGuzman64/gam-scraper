import { createHash } from "node:crypto";
import type { ProductRecord } from "../../../../../contracts/catalog.js";
import type { findSerialNumberCollisions } from "../../../../identity-conflicts.js";

type SerialNumberCollision = ReturnType<typeof findSerialNumberCollisions>[number];

const serial = "NRXL3AALS10000101";
const digest = (value: string): string => createHash("sha256").update(value).digest("hex");

const originalMusoshi = (record: ProductRecord): boolean =>
  record.providerId === "gam" && record.reference === "6806" &&
  record.url === "https://online.gamrentals.com/es/furgonetas-electricas-de-ocasion/6806-musoshi-pop-up-mini" &&
  record.categoryKey === "maquinaria" && record.condition === "Segunda mano" &&
  record.externalReference === "INQ-04323" && record.title === "Musoshi PoP Up Mini" &&
  record.brand === null && record.model === "P1.6" && record.year === "2024" &&
  record.serialNumber === serial && record.location === "MADRID" && record.country === "ESPAÑA" &&
  record.specs?.["Modelo"] === "P1.6" && record.specs?.["Nº de serie"] === serial &&
  record.specs?.["Matrícula"] === "3009MMS" &&
  record.shortDescription !== null && record.longDescription !== null &&
  digest(record.shortDescription) === "f7b9ebc963e3993e8ac504bb259c5240bb1e65fab8c3a96a1ec880905b31a4aa" &&
  digest(record.longDescription) === "064e39de28010d8f14bf3bcbaa365f40a22dd019f8f27ddce05547268b6fe199" &&
  digest(JSON.stringify(record.specs)) === "d78258fe31bb40edc2d97e0065a371f0eb77381e387c12370c986b287c1b65c0";

const originalZero = (record: ProductRecord): boolean =>
  record.providerId === "gam" && record.reference === "6807" &&
  record.url === "https://online.gamrentals.com/es/motocicletas-electricas-segunda-mano/6807-zero-motorcycles-ds-144" &&
  record.categoryKey === "maquinaria" && record.condition === "Segunda mano" &&
  record.externalReference === "INQ-04288" && record.price === "12500" &&
  record.priceText === "12500" && record.title === "Zero Motorcycles DS 14.4" &&
  record.brand === "ZERO" && record.model === "DS 14" && record.year === "2023" &&
  record.serialNumber === serial && record.location === "MADRID" && record.country === "ESPAÑA" &&
  record.specs?.["Marca"] === "ZERO" && record.specs?.["Modelo"] === "DS 14" &&
  record.specs?.["Nº de serie"] === serial && record.specs?.["Matrícula"] === "2722MHH" &&
  record.shortDescription !== null && record.longDescription !== null &&
  digest(record.shortDescription) === "43d66ee9ccdfc398aaed0af79543eb7334ae02f86cedd1c37b0b582eb229051f" &&
  digest(record.longDescription) === "11ea7e4efaeb4e893352934150f34244dc6dda105a82cde36dafc097b45eb618" &&
  digest(JSON.stringify(record.specs)) === "30a6705bd957700668a3a4fa01d7a56dcbb18bcacc85b53ab61ef04d857775af";

export const verifiedMusoshiSerialOwner = (collision: SerialNumberCollision): ProductRecord | null => {
  if (collision.providerId !== "gam" || collision.serialNumber !== serial || collision.products.length !== 2) return null;
  const musoshi = collision.products.find((product) => product.reference === "6806");
  const zero = collision.products.find((product) => product.reference === "6807");
  return musoshi && zero && originalMusoshi(musoshi) && originalZero(zero) ? musoshi : null;
};

export const verifiedZeroMisattributedSerial = (collision: SerialNumberCollision): ProductRecord | null => {
  if (verifiedMusoshiSerialOwner(collision) === null) return null;
  return collision.products.find((product) => product.reference === "6807") ?? null;
};

export const reconcileGamVerifiedZeroSerial = (record: ProductRecord): ProductRecord => {
  if (!originalZero(record)) return record;
  const specs = Object.fromEntries(Object.entries(record.specs ?? {}).filter(([key]) => key !== "Nº de serie"));
  return { ...record, serialNumber: null, specs };
};
