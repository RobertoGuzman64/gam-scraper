import type { ProductRecord, SpecsMap } from "../../../../contracts/catalog.js";

export const documentedPlatformUnitDetails = (record: ProductRecord, technical: SpecsMap): {
  readonly publishedHours: string | null;
  readonly article: string;
} | null => {
  const hours = technical["Horas laborales"];
  const publishedHours = typeof hours === "string" && /^(?:0|[1-9]\d*) h$/.test(hours) ? hours : null;
  if ((hours !== undefined && !publishedHours) ||
    record.horometer !== (publishedHours ? publishedHours.slice(0, -2) : null)) return null;
  const article = technical["Artículo No."];
  if (typeof article !== "string" || !/^[\p{L}\d/-]+$/u.test(article)) return null;
  return { publishedHours, article };
};
