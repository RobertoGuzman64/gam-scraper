import type { ProductRecord, SpecsMap } from "../../../../../../contracts/catalog.js";

type ClassicVehicleIdentity = {
  readonly url: string;
  readonly title: string;
  readonly brand: string;
  readonly model: string;
  readonly sourceModel: string;
  readonly sourceBrandKey: string;
  readonly year: string;
  readonly registration: string;
};

const verifiedVehicles: Readonly<Record<string, ClassicVehicleIdentity>> = {
  "6688": {
    url: "https://online.gamrentals.com/es/vehiculos-segunda-mano/6688-1973-alfa-romeo-spider-junior",
    title: "ALFA ROMEO SPIDER JUNIOR",
    brand: "ALFA ROMEO",
    model: "SPIDER JUNIOR",
    sourceModel: "SPIDE JUNIOR",
    sourceBrandKey: "ALFA ROMEO",
    year: "1973",
    registration: "M-3349-T"
  },
  "6689": {
    url: "https://online.gamrentals.com/es/vehiculos-segunda-mano/6689-1994-audi-80-26-cabrio",
    title: "AUDI 80 2,6 CABRIO",
    brand: "AUDI",
    model: "80 2,6 CABRIO",
    sourceModel: "6 CABRIO 80 2",
    sourceBrandKey: "AUDI",
    year: "1994",
    registration: "4909-GJP"
  },
  "6690": {
    url: "https://online.gamrentals.com/es/vehiculos-segunda-mano/6690-1972-peugeot-304-s-cabriolet",
    title: "PEUGEOT 304 S CABRIOLET",
    brand: "PEUGEOT",
    model: "304 S CABRIOLET",
    sourceModel: "304 S CABRIOLET",
    sourceBrandKey: "PEUGEOUT",
    year: "1972",
    registration: "H-3009-BBG"
  }
};

export const reconcileGamVerifiedClassicVehicleIdentity = (record: ProductRecord): ProductRecord => {
  const evidence = record.reference ? verifiedVehicles[record.reference] : undefined;
  if (!evidence || record.providerId !== "gam" || record.url !== evidence.url ||
    record.categoryKey !== "movilidad" || record.condition !== "Segunda mano" ||
    record.title !== evidence.title || record.shortDescription !== evidence.title ||
    record.brand !== null || record.model !== evidence.sourceModel ||
    record.year !== evidence.year || record.externalReference !== evidence.registration ||
    record.specs?.Modelo !== evidence.sourceModel || record.specs?.[evidence.sourceBrandKey] !== evidence.sourceBrandKey ||
    record.specs?.["Año de fabricación"] !== evidence.year ||
    record.specs?.["Matrícula"] !== evidence.registration ||
    record.specs?.Marca !== undefined || !record.longDescription) return record;
  const specs: SpecsMap = Object.fromEntries(
    Object.entries(record.specs).filter(([key]) => key !== evidence.sourceBrandKey)
  );
  return {
    ...record,
    brand: evidence.brand,
    model: evidence.model,
    specs: { ...specs, Marca: evidence.brand, Modelo: evidence.model }
  };
};
