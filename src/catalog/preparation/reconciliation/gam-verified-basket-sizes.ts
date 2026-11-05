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
    source: "https://manuals.genielift.com/Operators/english/43648.pdf" },
  { references: ["6622", "6625"], brand: "GENIE", model: "GS-5390", original: "4 83 88x1 metros", dimensions: "3,98 x 1,83 m",
    source: "https://www.genielift.com/docs/default-source/product-specifications/rough-terrain-scissor-lifts/en-gb/gsspec_gs-3390-4390-5390_en-%28gen0965%29-lr-3.pdf" },
  { references: ["6626"], brand: "JLG", model: "860SJ", original: "1 83X0 91 metros", dimensions: "1,83 x 0,91 m",
    source: "https://podnosnikipolska.pl/wp-content/uploads/2016/08/860SJ_EN-pdf.pdf" },
  { references: ["6169"], brand: "CTE", model: "TRCS 180", original: "1400x700x1100 metros", dimensions: "1,4 x 0,7 x 1,1 m",
    source: "https://ctelift.com/es/plataforma-arana-trcs180/" },
  { references: ["6171"], brand: "CTE", model: "TRCS 210E", original: "1400x700x1100 metros", dimensions: "1,4 x 0,7 x 1,1 m",
    source: "https://ctelift.com/es/plataforma-arana-trcs210e/" }
] as const;

const compact = (value: string): string => fold(value).replace(/[^a-z0-9]/gu, "");

export const reconcileGamVerifiedBasketSizes = (record: ProductRecord): ProductRecord => {
  if (record.providerId !== "gam" || (record.categoryKey !== "elevacion" && record.categoryKey !== "elevacion-nueva") ||
    !record.reference || !record.brand || !record.model) return record;
  const source = verified.find((item) => item.references.some((reference) => reference === record.reference));
  if (!source || (record.condition !== "Segunda mano" && record.condition !== "Nuevo") ||
    ((record.condition === "Nuevo") !== (record.categoryKey === "elevacion-nueva")) ||
    compact(record.brand) !== compact(source.brand) || compact(record.model) !== compact(source.model) ||
    compact(String(record.specs?.Marca ?? "")) !== compact(source.brand) ||
    compact(String(record.specs?.Modelo ?? "")) !== compact(source.model) ||
    record.specs?.["Dimensiones Cesta"] !== source.original ||
    !(compact(record.shortDescription ?? "").includes(compact(`${source.brand} ${source.model}`)) ||
      (source.model.endsWith("J") && compact(record.shortDescription ?? "").includes(
        compact(`${source.brand} ${source.model.slice(0, -1)}`)) &&
        compact(record.longDescription ?? "").includes(compact(`${source.brand} ${source.model}`))) ||
      (record.reference === "6169" && compact(record.title ?? "").includes("trcs180")) ||
      (record.reference === "6171" && compact(record.title ?? "").includes("traccess210e")))) return record;
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
