import { createHash } from "node:crypto";
import type { ProductRecord } from "../../../../../contracts/catalog.js";

const original = "Ref. MER0624 CARRETILLA ELEVADORA ELECTRICA 1600 KG MASTIL TRIPLEX LINDE E16P-01 ALTURA DE TRABAJO 3.000mm HORAS 16532 AÑO DE FABRICACION 2009";
const sourceDescriptionHash = "daccc28eb6d6fbab3897fb929e3935cfa82887f3e79d329f1a7731a828b5be60";
const sourceSpecsHash = "9ac66514223e30eff91f6222924c1e2dae67dd317b3fb5cf84014982faf53889";

const digest = (value: string): string => createHash("sha256").update(value).digest("hex");

export const reconcileMercaelevaVerifiedLindeE16pMast = (record: ProductRecord): ProductRecord => {
  if (record.providerId !== "mercaeleva" || record.reference !== "M104-0836" ||
    record.url !== "https://sales.mercaeleva.com/es/for-sale/machine/Linde-E16P-01-M104-0836" ||
    record.categoryKey !== "venta" || record.condition !== "Segunda mano" ||
    record.brand !== "Linde" || record.model !== "E16P-01" || record.year !== "2009" ||
    record.horometer !== "16 532" || record.serialNumber !== null ||
    record.title !== "Linde E16P-01 CARRETILLA ELEVADORA ELECTRICA 1600 KG" ||
    record.shortDescription !== null || record.longDescription !== original ||
    digest(record.longDescription) !== sourceDescriptionHash ||
    record.specs?.["Artículo No."] !== "MER0624" ||
    record.specs?.["Tipo de mástil"] !== "Dúplex/estándar" ||
    digest(JSON.stringify(record.specs)) !== sourceSpecsHash) return record;

  return { ...record, longDescription: original.replace("MASTIL TRIPLEX", "MASTIL DUPLEX") };
};
