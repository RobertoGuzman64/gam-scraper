import { createHash } from "node:crypto";
import type { ProductRecord } from "../../../../contracts/catalog.js";

const fingerprint = "5e1cb74c7c777e46475fcc70507e2186b582011747947defbc5f9fa71f7daf51";

const digest = (record: ProductRecord): string => createHash("sha256")
  .update(JSON.stringify(Object.entries(record).filter(([key]) => key !== "scrapedAt")))
  .digest("hex");

export const describeMercaelevaE48pPublicationConflict = (record: ProductRecord): string | null => {
  if (record.providerId !== "mercaeleva" || record.reference !== "M827-8304" ||
    record.url !== "https://sales.mercaeleva.com/es/for-sale/machine/Linde-E48P-M827-8304" ||
    record.specs?.["Artículo No."] !== "MER0798" ||
    digest(record) !== fingerprint) return null;
  return "MER0798: el anuncio del vendedor publica 4.800 kg y mástil dúplex en el texto, pero 3.000 kg y mástil tríplex en los campos técnicos; la republicación en Machineryline conserva ambas discrepancias. Confirmar capacidad efectiva y mástil instalado con el vendedor o la placa antes de validar la ficha";
};

export const reconcileMercaelevaVerifiedLindeE48p = (record: ProductRecord): ProductRecord => {
  if (describeMercaelevaE48pPublicationConflict(record) === null || !record.specs ||
    record.specs["Capacidad máxima de elevación"] !== "3000 kg" ||
    record.specs["Tipo de mástil"] !== "Triple" ||
    record.specs["Altura máxima de elevación"] !== "3300 mm") return record;
  return {
    ...record,
    specs: {
      ...record.specs,
      "Capacidad máxima de elevación": "4800 kg",
      "Tipo de mástil": "Dúplex/estándar"
    }
  };
};
