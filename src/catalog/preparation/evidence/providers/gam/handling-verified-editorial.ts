import type { ProductRecord } from "../../../../../contracts/catalog.js";
import { fold } from "../../../mapping/attribute-utils.js";

const originalPage = (record: ProductRecord, route: string, slug: string): boolean => {
  try {
    const url = new URL(record.url);
    return url.hostname === "online.gamrentals.com" &&
      url.pathname === `/es/${route}/${record.reference}-${slug}`;
  } catch {
    return false;
  }
};

const agreedModel = (record: ProductRecord, model: string): boolean =>
  record.providerId === "gam" && record.categoryKey === "manutencion" &&
  record.condition === "Segunda mano" && fold(record.brand ?? "") === "hyster" &&
  fold(record.model ?? "") === model &&
  fold(String(record.specs?.["Marca"] ?? "")) === "hyster" &&
  fold(String(record.specs?.["Modelo"] ?? "")) === model;

const correctUsedHysterLift = (record: ProductRecord): ProductRecord => {
  if (!agreedModel(record, "h3.5ft") || record.reference !== "6702" ||
    !originalPage(record, "carretillas-elevadoras-glp-segunda-mano", "2019-hyster-h35ft") ||
    fold(record.title ?? "") !== "carretilla elevadora glp 3500kg hyster h3.5ft" ||
    !/^➨ HYSTER H3\.5FT Segunda Mano ➨ Venta de carretilla frontal GLP de 3500 kg de ocasión ➨ Año 2019$/.test(record.shortDescription ?? "") ||
    record.year !== "2019" ||
    record.specs?.["Nº de serie"] !== "P177B09051T" ||
    record.specs?.["Año de fabricación"] !== "2019" ||
    fold(String(record.specs?.["Altura de elevación (mm)"] ?? "")) !== "3600 mm" ||
    fold(String(record.specs?.["Capacidad de carga (kg)"] ?? "")) !== "3500 kg" ||
    !record.longDescription) return record;
  const mentions = [...record.longDescription.matchAll(/\baltura de elevación de\s+(\d+(?:[.,]\d+)?)\s+metros\b/gi)];
  if (mentions.length !== 1 || mentions[0]?.[1] !== "4,6" ||
    !record.longDescription.startsWith("Equipo propulsado por GLP (Gas Licuado del Petroleo) La Hyster H3.5FT, fabricada en 2019,") ||
    !/\bcapacidad de carga de 3\.500 kg\b/.test(record.longDescription) ||
    /\b(?:diesel|eléctrico|eléctrica|4,6 metros)\b/i.test(record.longDescription.replace(mentions[0][0], ""))) return record;
  return {
    ...record,
    longDescription: record.longDescription.replace(mentions[0][0], mentions[0][0].replace("4,6", "3,6"))
  };
};

const correctNewHysterCapacity = (record: ProductRecord): ProductRecord => {
  if (record.providerId !== "gam" || record.categoryKey !== "carretillas-nuevas" ||
    record.condition !== "Nuevo" || fold(record.brand ?? "") !== "hyster" ||
    fold(record.model ?? "") !== "h12xd-12" ||
    fold(String(record.specs?.["Marca"] ?? "")) !== "hyster" ||
    fold(String(record.specs?.["Modelo"] ?? "")) !== "h12xd-12" ||
    record.reference !== "6272" ||
    !originalPage(record, "hyster", "carretilla-elevadora-diesel-hyster-h12xd-12") ||
    fold(record.title ?? "") !== "carretilla elevadora diesel 12500kg hyster h12xd-12" ||
    !record.shortDescription || !record.longDescription ||
    !/^➨ HYSTER H12XD-12 ➨ Venta de Carretilla Elevadora Diésel 6,6 metros ⭐Capacidad de carga de 12000 kg$/.test(record.shortDescription) ||
    fold(String(record.specs?.["Capacidad de carga (kg)"] ?? "")) !== "12500 kg" ||
    fold(String(record.specs?.["Tipo motor"] ?? "")) !== "diesel" ||
    !record.longDescription.startsWith("Si buscas una carretilla elevadora diésel preparada para trabajo intensivo") ||
    !/\bHyster H12XD-12\b/.test(record.longDescription) ||
    !/\bcapacidad nominal de hasta 12\.500 kg\b/.test(record.longDescription) ||
    [...record.longDescription.matchAll(/\b(\d[\d.]*)\s*kg\b/gi)]
      .some((match) => match[1] !== "12.500")) return record;
  return { ...record, shortDescription: record.shortDescription.replace("12000 kg", "12500 kg") };
};

export const reconcileGamVerifiedHandlingEditorial = (record: ProductRecord): ProductRecord => {
  const correctedHeight = correctUsedHysterLift(record);
  return correctedHeight === record ? correctNewHysterCapacity(record) : correctedHeight;
};
