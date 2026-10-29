import type { ProductRecord } from "../../../../../contracts/catalog.js";
import { fold } from "../../../mapping/category-utils.js";

export const verifiedMercaelevaA14jeWorkingHeight = (
  record: ProductRecord, titleHeight: number, describedHeight: number, publishedHeight: number | null
): boolean =>
  record.providerId === "mercaeleva" &&
  record.reference === "M887-9469" &&
  record.url === "https://sales.mercaeleva.com/es/for-sale/machine/LGMG-A14JE-M887-9469" &&
  record.categoryKey === "venta" &&
  fold(record.brand ?? "") === "lgmg" &&
  fold(record.model ?? "") === "a14je" &&
  record.specs?.["Artículo No."] === "1332" &&
  fold(record.title ?? "") === "lgmg a14je plataforma articulada electrica 15 mt" &&
  !/\baltura\s+(?:de\s+)?trabajo\b/.test(fold(record.title ?? "")) &&
  titleHeight === 15 &&
  describedHeight === 16 &&
  publishedHeight === 16;
