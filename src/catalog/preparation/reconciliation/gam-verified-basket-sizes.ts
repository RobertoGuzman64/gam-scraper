import type { ProductRecord } from "../../../contracts/catalog.js";
import { fold } from "../mapping/attribute-utils.js";

const verified = [
  { references: ["6607"], brand: "GENIE", model: "Z45/25J", original: "1 76 83X0 metros", dimensions: "1,83 x 0,76 m",
    source: "https://www.genielift.com/docs/default-source/product-specifications/articulated-boom-lift/es-mx/especificaciones-tecnicas-z-45-25j-rt.pdf" },
  { references: ["6630", "6632"], brand: "HAULOTTE", model: "HA20PX", original: "1 8 8 x 0 metros", dimensions: "1,8 x 0,8 m",
    source: "https://rentalone.es/wp-content/uploads/2020/07/FITXA-TECNICA-HAULOTTE-HA20PX-ES-BD.pdf" },
  { references: ["6614", "6615", "6616"], brand: "JLG", model: "4394RT", original: "18 3 81X2 metros", dimensions: "3,81 x 2,18 m",
    source: "https://irp.cdn-website.com/a66d308d/files/uploaded/JLG%20Scissor%20Lifts%20Spec%20Overview%20Rev%2014%20May%202023.pdf" },
  { references: ["6631"], brand: "MANITOU", model: "150 AETJC", original: "1 2x0 96 metros", dimensions: "1,2 x 0,96 m",
    source: "https://www.alpesur.com/images/pdf-maquinaria/150aetc.pdf" },
  { references: ["6617"], brand: "GENIE", model: "S-65", original: "1 76 83 x 0 metros", dimensions: "1,83 x 0,76 m",
    source: "https://manuals.genielift.com/Operators/english/43648.pdf" }
] as const;

const compact = (value: string): string => fold(value).replace(/[^a-z0-9]/gu, "");

export const reconcileGamVerifiedBasketSizes = (record: ProductRecord): ProductRecord => {
  if (record.providerId !== "gam" || record.categoryKey !== "elevacion" ||
    record.condition !== "Segunda mano" || !record.reference || !record.brand || !record.model) return record;
  const source = verified.find((item) => item.references.some((reference) => reference === record.reference));
  if (!source || compact(record.brand) !== compact(source.brand) || compact(record.model) !== compact(source.model) ||
    compact(String(record.specs?.Marca ?? "")) !== compact(source.brand) ||
    compact(String(record.specs?.Modelo ?? "")) !== compact(source.model) ||
    record.specs?.["Dimensiones Cesta"] !== source.original ||
    !(compact(record.shortDescription ?? "").includes(compact(`${source.brand} ${source.model}`)) ||
      (source.model.endsWith("J") && compact(record.shortDescription ?? "").includes(
        compact(`${source.brand} ${source.model.slice(0, -1)}`)) &&
        compact(record.longDescription ?? "").includes(compact(`${source.brand} ${source.model}`))))) return record;
  try {
    const url = new URL(record.url);
    const parts = url.pathname.split("/").filter(Boolean);
    if (url.protocol !== "https:" || url.hostname !== "online.gamrentals.com" || url.search || url.hash ||
      parts.length !== 3 || parts[0] !== "es" || !(parts[2] ?? "").startsWith(`${record.reference}-`)) return record;
  } catch {
    return record;
  }
  return { ...record, specs: { ...record.specs, "Dimensiones Cesta": source.dimensions } };
};
