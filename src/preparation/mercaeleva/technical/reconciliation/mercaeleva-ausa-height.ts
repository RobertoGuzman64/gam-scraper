import type { ProductRecord } from "../../../../contracts/catalog.js";

const sourceHeight = "ALTURA DE TRABAJO 4.30mm";
const correctedHeight = "ALTURA DE ELEVACION 4.300 mm";

export const normalizeMercaelevaAusaHeightText = (
  record: ProductRecord,
  text: string | null
): string | null => {
  if (!text || record.providerId !== "mercaeleva" ||
    (record.reference !== "M855-6850" && record.reference !== "M640-1938") ||
    record.brand !== "Ausa" || record.model !== "C250HX4" ||
    record.title !== "Ausa C250HX4 CARRETILLA 4x4 2500KG" ||
    record.specs?.["Altura máxima de elevación"] !== "4300 mm" ||
    !record.url.startsWith("https://sales.mercaeleva.com/es/for-sale/machine/Ausa-C250HX4-") ||
    !record.url.endsWith(`-${record.reference}`) ||
    !record.longDescription?.includes(sourceHeight)) return text;
  return text.replaceAll(sourceHeight, correctedHeight)
    .replace("El anuncio abrevia esta altura como «4.30mm», mientras que el campo técnico la expresa en milímetros de forma inequívoca. ", "")
    .replace(", frente a la escritura abreviada e imprecisa «4.30mm» del anuncio", "");
};
