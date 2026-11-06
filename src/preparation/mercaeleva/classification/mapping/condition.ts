import type { ProductRecord } from "../../../../contracts/catalog.js";

const fold = (value: string): string => value.toLocaleLowerCase("es").normalize("NFD")
  .replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, " ").trim();

export const mercaelevaConditionEvidence = (record: ProductRecord): { readonly isNew: boolean; readonly isUsed: boolean } => {
  const mercaelevaState = record.providerId === "mercaeleva" && typeof record.specs?.["Estado"] === "string"
    ? fold(record.specs["Estado"]) : null;
  const newInSource = mercaelevaState === "nuevo" || mercaelevaState === "nueva";
  const usedInSource = mercaelevaState === "usado" || mercaelevaState === "usada" ||
    mercaelevaState === "segunda mano" || mercaelevaState === "de segunda mano";
  const documentedUsed = record.providerId === "mercaeleva" &&
    record.reference === "M958-0132" &&
    record.url === "https://sales.mercaeleva.com/es/for-sale/machine/BT-SWE-160-M958-0132" &&
    record.categoryKey === "venta" && record.brand === "BT" && record.model === "SWE 160" &&
    record.specs?.["Marca"] === "BT" && record.specs?.["Modelo"] === "SWE 160" &&
    record.specs?.["Artículo No."] === "MER0603" &&
    fold(record.title ?? "") === "bt swe 160 apilador electrico 1600 kg" &&
    fold(String(record.specs?.["Título adicional"] ?? "")) === "apilador electrico 1600 kg";
  const documentedUsedCabin = record.providerId === "mercaeleva" &&
    record.reference === "M294-4678" &&
    record.url === "https://sales.mercaeleva.com/es/for-sale/machine/M294-4678" &&
    record.categoryKey === "venta" && record.categoryName === "Maquinaria en venta" &&
    record.brand === null && record.model === null &&
    fold(record.title ?? "") === "modulo caseta diafana con aire 6m x 2,35m" &&
    fold(record.longDescription ?? "") ===
      "modulo caseta diafana con aire 6m x 2,35m puerta en lateral (lado corto) cbox - caseta6" &&
    fold(String(record.specs?.["Título adicional"] ?? "")) ===
      "modulo caseta diafana con aire 6m x 2,35m" &&
    record.image?.startsWith("https://files2.machineric.com/clients/mercaeleva/machines/M294-4678/public/") === true;
  return { isNew: newInSource, isUsed: usedInSource || documentedUsed || documentedUsedCabin };
};
