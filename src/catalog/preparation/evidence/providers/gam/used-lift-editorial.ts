import type { ProductRecord } from "../../../../../contracts/catalog.js";
import { fold } from "../../../mapping/attribute-utils.js";

const correctHysterUsedLift = (record: ProductRecord): ProductRecord => {
  if (record.providerId !== "gam" || record.categoryKey !== "manutencion" ||
    record.condition !== "Segunda mano" || fold(record.brand ?? "") !== "hyster" ||
    fold(String(record.specs?.["Marca"] ?? "")) !== "hyster" ||
    !record.model || fold(String(record.specs?.["Modelo"] ?? "")) !== fold(record.model) ||
    !record.longDescription || !record.shortDescription) return record;

  let publishedYear: string;
  let publishedHeight: string;
  let verifiedHeight: string;
  let originalOpening: string;
  if (record.reference === "5275" && record.year === "2013" &&
    record.url === "https://online.gamrentals.com/es/carretillas-elevadoras-glp-segunda-mano/5275-2013-hyster-h35ft" &&
    record.model === "H3.5FT" && record.title === "Carretilla elevadora GLP 3500Kg Hyster H3.5FT" &&
    record.shortDescription === "➨ HYSTER H3.5FT Segunda Mano ➨ Venta de carretilla frontal GLP de 3500 kg de ocasión ➨ Año 2013" &&
    record.specs?.["Nº de serie"] === "L177B38411L" &&
    record.specs?.["Altura de elevación (mm)"] === "4600 mm" &&
    record.specs?.["Capacidad de carga (kg)"] === "3500 KG") {
    publishedYear = "fabricada en 2025";
    publishedHeight = "altura de elevación de 6,5 metros";
    verifiedHeight = "altura de elevación de 4,6 metros";
    originalOpening = "Equipo propulsado por GLP (Gas Licuado del Petroleo) La Hyster H3.5FT, fabricada en 2025,";
  } else if (record.reference === "5864" && record.year === "2018" &&
    record.url === "https://online.gamrentals.com/es/apiladoras-elevadoras-electricas-segunda-mano/5864-2018-hyster-s12" &&
    record.model === "S1.2" && record.title === "Apilador eléctrico 1200 Kg HYSTER S1.2" &&
    record.shortDescription === "➨ HYSTER S1.2 de segunda mano ➨ Venta de apilador eléctrico Hyster ⭐Capacidad de carga de 1200 kg" &&
    record.specs?.["Nº de serie"] === "D456T07538V" &&
    record.specs?.["Altura de elevación (mm)"] === "3540 mm" &&
    record.specs?.["Capacidad de carga (kg)"] === "1200 KG") {
    publishedYear = "fabricado en 2021";
    publishedHeight = "altura de elevación de 3,2 metros";
    verifiedHeight = "altura de elevación de 3,54 metros";
    originalOpening = "El apilador eléctrico a pie HYSTER S1.2, fabricado en 2021,";
  } else {
    return record;
  }

  const long = record.longDescription;
  if (!long.startsWith(originalOpening) ||
    long.split(publishedYear).length !== 2 ||
    [...long.matchAll(/altura de elevación de\s+\d+(?:[.,]\d+)?\s+metros/gi)].length !== 1 ||
    !long.includes(publishedHeight) ||
    !long.includes(record.model)) return record;

  return {
    ...record,
    longDescription: long.replace(publishedYear, `fabricad${record.reference === "5275" ? "a" : "o"} en ${record.year}`)
      .replace(publishedHeight, verifiedHeight)
  };
};

const correctToyotaUsedForklift = (record: ProductRecord): ProductRecord => {
  if (record.providerId !== "gam" || record.categoryKey !== "manutencion" ||
    record.condition !== "Segunda mano" || record.reference !== "6887" ||
    record.url !== "https://online.gamrentals.com/es/carretillas-elevadoras-electricas-segunda-mano/6887-2017-toyota-8fbmt20" ||
    record.title !== "Carretilla Elevadora Eléctrica 2000 Kg TOYOTA 8FBMT20" ||
    record.shortDescription !== "➨ TOYOTA 8FBMT20 ➨ Venta de Carretilla Elevadora Eléctrica 5,5 metros ⭐Capacidad de carga de 2000 kg" ||
    fold(record.brand ?? "") !== "toyota" || fold(record.model ?? "") !== "8fbmt20" ||
    fold(String(record.specs?.["Marca"] ?? "")) !== "toyota" ||
    fold(String(record.specs?.["Modelo"] ?? "")) !== "8fbmt20" ||
    record.serialNumber !== "8FBM20T-11129" ||
    record.specs?.["Nº de serie"] !== "8FBM20T-11129" ||
    record.specs?.["Altura de elevación (mm)"] !== "5500 mm" ||
    record.specs?.["Capacidad de carga (kg)"] !== "2000 KG" ||
    record.year !== "2000" || record.yearSource !== "titulo" ||
    !record.image?.endsWith("/2017-toyota-8fbmt20.jpg") ||
    !record.longDescription?.startsWith("La TOYOTA 8FBMT20 es una carretilla elevadora eléctrica")) return record;

  const long = record.longDescription;
  const phrases = [
    "altura de elevación de 4,7 metros",
    "capacidad de carga indicada de 2500 kg",
    "Fabricada en el año 2016",
    "altura de 4,7 metros"
  ];
  if (phrases.some((phrase) => long.split(phrase).length !== 2) ||
    [...long.matchAll(/\b(?:altura de elevación de|altura de)\s+\d+(?:[.,]\d+)?\s+metros\b/gi)].length !== 2 ||
    [...long.matchAll(/\b(?:capacidad de carga indicada de|capacidad de carga de)\s+\d+\s+kg\b/gi)].length !== 1 ||
    [...long.matchAll(/\b(?:fabricad[ao] en el año|año de fabricación)\s+\d{4}\b/gi)].length !== 1) return record;

  return {
    ...record,
    year: "2017",
    yearSource: "url",
    longDescription: long
      .replace("altura de elevación de 4,7 metros", "altura de elevación de 5,5 metros")
      .replace("capacidad de carga indicada de 2500 kg", "capacidad de carga indicada de 2000 kg")
      .replace("Fabricada en el año 2016", "Fabricada en el año 2017")
      .replace("altura de 4,7 metros", "altura de 5,5 metros")
  };
};

export const reconcileGamUsedLiftEditorial = (record: ProductRecord): ProductRecord => {
  const hyster = correctHysterUsedLift(record);
  return hyster === record ? correctToyotaUsedForklift(record) : hyster;
};
