import { createHash } from "node:crypto";
import type { ProductRecord } from "../../../../contracts/catalog.js";
import { fold } from "../../../shared/classification/mapping/attribute-utils.js";

const agreedIdentity = (record: ProductRecord, brand: string, model: string, route: string): boolean => {
  if (record.providerId !== "gam" || fold(record.brand ?? "") !== brand ||
    fold(record.model ?? "") !== model || fold(String(record.specs?.["Marca"] ?? "")) !== brand ||
    fold(String(record.specs?.["Modelo"] ?? "")) !== model ||
    !record.title || !record.shortDescription || !record.longDescription) return false;
  try {
    const url = new URL(record.url);
    const path = url.pathname.split("/").filter(Boolean);
    return url.hostname === "online.gamrentals.com" && path.length === 3 &&
      path[0] === "es" && path[1] === route &&
      (path[2] ?? "").startsWith(`${record.reference}-`) &&
      (path[2] ?? "").includes(model.replace(/[^a-z0-9]/g, ""));
  } catch {
    return false;
  }
};

const singleMention = (text: string, expression: RegExp): boolean => [...text.matchAll(expression)].length === 1;

const correctToyotaPalletLoad = (record: ProductRecord): ProductRecord => {
  if (record.condition !== "Segunda mano" || record.categoryKey !== "manutencion" ||
    !agreedIdentity(record, "toyota", "lwe180", "transpaletas-elevadoras-electricas-segunda-mano") ||
    fold(record.title ?? "") !== "transpaleta electrica a pie toyota lwe180" ||
    fold(String(record.specs?.["Capacidad de carga (kg)"] ?? "")) !== "1800 kg" ||
    !record.shortDescription || !record.longDescription ||
    !/^➨\s*TOYOTA LWE180\s*➨\s*Venta de Transpaleta Toyota ocasión\s*⭐\s*Capacidad de carga de 1900 kg\s*$/i.test(record.shortDescription) ||
    !record.longDescription.startsWith("La TOYOTA LWE180 es una transpaleta eléctrica") ||
    !singleMention(record.longDescription, /\bcapacidad de carga de 1900 kg\b/gi) ||
    /\bcapacidad\s+(?:nominal\s+)?(?:de\s+)?carga\s+(?:de\s+)?(?!1900\b)\d+[.,]?\d*\s*(?:kg|toneladas?)\b/i.test(record.longDescription)) return record;
  const short = record.shortDescription.replace(/(Capacidad de carga de )1900(?= kg\b)/i, (_, prefix: string) => `${prefix}1800`);
  const long = record.longDescription.replace(/(capacidad de carga de )1900(?= kg\b)/i, (_, prefix: string) => `${prefix}1800`);
  return { ...record, shortDescription: short, longDescription: long };
};

const correctYaleForkliftLoad = (record: ProductRecord): ProductRecord => {
  if (record.condition !== "Nuevo" || record.categoryKey !== "carretillas-nuevas" ||
    !agreedIdentity(record, "yale", "gdp160ef12", "carretillas-elevadora-diesel-yale") ||
    fold(record.title ?? "") !== "carretilla elevadora diesel 16400kg yale gdp160ef12" ||
    fold(String(record.specs?.["Capacidad de carga (kg)"] ?? "")) !== "16000 kg" ||
    !record.shortDescription || !record.longDescription ||
    !/^➨\s*YALE GDP160EF12\s*➨\s*Venta de Carretilla Elevadora Diésel 7 metros nueva\s*⭐\s*Capacidad de carga de 16400 kg\s*$/i.test(record.shortDescription) ||
    !record.longDescription.startsWith("La Carretilla Elevadora Diésel Yale GDP160EF12") ||
    !/\bcapacidad de carga excepcional de hasta 16000 kg \(16 toneladas\)/i.test(record.longDescription) ||
    /\b16400\b/.test(record.longDescription) ||
    !/\bdiesel\b/.test(fold(String(record.specs?.["Tipo motor"] ?? ""))) ||
    fold(String(record.specs?.["Motorización"] ?? "")) !== "diesel" ||
    [...record.longDescription.matchAll(/\bcapacidad\s+(?:nominal\s+)?(?:de\s+)?carga\s+(?:de\s+)?(?:hasta\s+)?(\d[\d.,]*)\s*kg\b/gi)]
      .some((match) => match[1] !== "16000")) return record;
  if (!record.title) return record;
  return {
    ...record,
    title: record.title.replace(/16400(?=\s*kg\b)/i, "16000"),
    shortDescription: record.shortDescription.replace(/16400(?=\s*kg\b)/i, "16000")
  };
};

const correctYaleErp25vlLoad = (record: ProductRecord): ProductRecord => {
  if (record.providerId !== "gam" || record.reference !== "6837" ||
    record.categoryKey !== "manutencion" || record.condition !== "Segunda mano" ||
    record.url !== "https://online.gamrentals.com/es/carretillas-elevadoras-electricas-segunda-mano/6837-2015-yale-erp25vl" ||
    record.externalReference !== "GAM-19577" || record.serialNumber !== "A976B05155N" ||
    record.year !== "2015" || record.brand !== "YALE" || record.model !== "ERP25VL" ||
    record.title !== "Carretilla elevadora eléctrica 3500 Kg YALE ERP25VL" ||
    record.shortDescription !== "➨ YALE ERP25VL de segunda mano ➨ Venta de Carretilla Elevadora Eléctrica 4,9 metros ⭐Capacidad de carga de 2500 kg" ||
    record.specs?.Marca !== "YALE" || record.specs?.Modelo !== "ERP25VL" ||
    record.specs?.["Nº de serie"] !== "A976B05155N" ||
    record.specs?.["Capacidad de carga (kg)"] !== "2500 KG" ||
    record.specs?.["Altura de elevación (mm)"] !== "4950 mm" ||
    !record.longDescription ||
    createHash("sha256").update(record.longDescription).digest("hex") !==
      "6c9854b08ae0f5480691b4465e87b7f9f133701d2a8cbac4da249b323594c848") return record;
  return {
    ...record,
    title: "Carretilla elevadora eléctrica 2500 kg YALE ERP25VL",
    longDescription: record.longDescription.replace(
      "capacidad de carga indicada de 3500 kg", "capacidad de carga indicada de 2500 kg"
    )
  };
};

export const reconcileGamHandlingCapacityEditorial = (record: ProductRecord): ProductRecord => {
  const corrected = correctToyotaPalletLoad(record);
  const yale = corrected === record ? correctYaleForkliftLoad(record) : corrected;
  return yale === record ? correctYaleErp25vlLoad(record) : yale;
};
