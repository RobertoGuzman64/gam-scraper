import type { ProductRecord } from "../../../../../contracts/catalog.js";
import { fold } from "../../attribute-utils.js";
import { validMercaelevaTechnicalSource } from "./technical.js";

export const verifiedMercaelevaMbCapacity = (record: ProductRecord): number | null => {
  if (!validMercaelevaTechnicalSource(record) || record.categoryKey !== "venta" ||
    record.condition !== "Nuevo" || record.year !== "2025" ||
    fold(record.brand ?? "") !== "mb" || fold(String(record.specs?.["Marca"] ?? "")) !== "mb" ||
    !record.model || fold(String(record.specs?.["Modelo"] ?? "")) !== fold(record.model) ||
    record.specs?.["Estado"] !== "Nuevo" || record.shortDescription?.trim() ||
    record.longDescription?.trim() ||
    record.specs?.["Tipo de Batería"] !== "Li-ion") return null;

  if (record.reference === "M062-8951" && record.model === "EFL303" &&
    record.url === "https://sales.mercaeleva.com/es/for-sale/machine/MB-EFL303-M062-8951" &&
    record.title === "MB EFL303 Carretilla eléctrica de 3.000 kg con batería de Litio" &&
    record.specs?.["Título adicional"] === "Carretilla eléctrica de 3.000 kg con batería de Litio" &&
    record.specs?.["Capacidad máxima de elevación"] === "2500 kg" &&
    record.specs?.["Voltaje de la batería"] === "80 V" &&
    record.specs?.["Capacidad de la batería"] === "205 Ah") return 3000;

  if (record.reference === "M119-9334" && record.model === "EPL185" &&
    record.url === "https://sales.mercaeleva.com/es/for-sale/machine/MB-EPL185-M119-9334" &&
    record.title === "MB EPL185 Transpaleta Eléctrica con batería de Litio de 1.800kg" &&
    record.specs?.["Título adicional"] === "Transpaleta Eléctrica con batería de Litio de 1.800kg" &&
    record.specs?.["Capacidad máxima de elevación"] === "1500 kg" &&
    record.specs?.["Voltaje de la batería"] === "48 V" &&
    record.specs?.["Capacidad de la batería"] === "30 Ah") return 1800;

  return null;
};
