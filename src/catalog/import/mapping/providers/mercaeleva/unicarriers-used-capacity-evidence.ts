import { createHash } from "node:crypto";
import type { ProductRecord } from "../../../../../contracts/catalog.js";

const sourceTitle = "UniCarriers E2D2A30 CARRETILLA ELEVADORA DIESEL 3000 KG";
const sourceSummary = "Ref. MER0987 CARRETILLA ELEVADORA DIESEL 3000 KG UNICARRIERS E2D2A30 HORAS 8142";
const sourceTechnicalHash = "17f48d6376837e5d3c8bcabce082dd67056764afeba7a002e91afbdbd8518f02";
const sourceSummaryHash = "f974aeaa6ed39dc8a84104b9fe5665048ef2f73eedd4fd9ff342abeb009ce4a7";

const digest = (value: string): string => createHash("sha256").update(value).digest("hex");

export const reconcileMercaelevaVerifiedUnicarriersCapacity = (record: ProductRecord): ProductRecord => {
  if (record.providerId !== "mercaeleva" || record.reference !== "M582-1882" ||
    record.categoryKey !== "venta" || record.condition !== "Segunda mano" ||
    record.url !== "https://sales.mercaeleva.com/es/for-sale/machine/UniCarriers-E2D2A30-M582-1882" ||
    record.brand !== "UniCarriers" || record.model !== "E2D2A30" || record.year !== null ||
    record.serialNumber !== null || record.horometer !== "8142" ||
    record.title !== sourceTitle || record.shortDescription !== null ||
    record.longDescription !== sourceSummary ||
    digest(record.longDescription) !== sourceSummaryHash ||
    record.specs?.["Marca"] !== "UniCarriers" || record.specs?.["Modelo"] !== "E2D2A30" ||
    record.specs?.["Título adicional"] !== "CARRETILLA ELEVADORA DIESEL 3000 KG" ||
    record.specs?.["Artículo No."] !== "MER0987" ||
    record.specs?.["Capacidad máxima de elevación"] !== "2500 kg" ||
    digest(JSON.stringify(record.specs)) !== sourceTechnicalHash) return record;

  const preparedAdditionalTitle = "CARRETILLA ELEVADORA DIESEL 2500 KG";
  return {
    ...record,
    title: "UniCarriers E2D2A30 CARRETILLA ELEVADORA DIESEL 2500 KG",
    longDescription: "Ref. MER0987 CARRETILLA ELEVADORA DIESEL 2500 KG UNICARRIERS E2D2A30 HORAS 8142",
    specs: { ...record.specs, "Título adicional": preparedAdditionalTitle }
  };
};
