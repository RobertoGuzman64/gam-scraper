import type { ProductRecord } from "../../../../contracts/catalog.js";
import { sameEditorialUnit } from "../../core/editorial-source-contract.js";
import { editorialFamilyOf } from "../../core/editorial-families.js";

const widths = /^(\d{1,2}(?:[.,]\d{1,3})?)\s*m\s*,\s*(\d{1,2}(?:[.,]\d{1,3})?)\s*m$/iu;

export const resolveSourcedAmbiguousWidth = (
  source: ProductRecord, prepared: ProductRecord, general: string | null, authenticatedOrigin: boolean
): string | null => {
  const value = source.specs?.Anchura;
  const current = general?.trim();
  if (!authenticatedOrigin || !sameEditorialUnit(source, prepared) ||
    typeof value !== "string" || value !== prepared.specs?.Anchura || !current ||
    !source.brand?.trim() || !source.title || !prepared.title ||
    !source.title.toLocaleLowerCase("es").includes(source.brand.toLocaleLowerCase("es")) ||
    !prepared.title.toLocaleLowerCase("es").includes(source.brand.toLocaleLowerCase("es"))) return null;
  const sourceFamily = editorialFamilyOf(current);
  const preparedFamily = editorialFamilyOf(prepared.title);
  if (sourceFamily && preparedFamily && preparedFamily !== sourceFamily) return null;
  const match = widths.exec(value.trim());
  if (!match?.[1] || !match[2]) return null;
  const first = Number(match[1].replace(",", "."));
  const second = Number(match[2].replace(",", "."));
  if (first === second || first < 0.5 || second < 0.5 || first > 5 || second > 5 ||
    [first, second].some((measure) => current.includes(`${measure.toLocaleString("es-ES")} m`))) return null;
  return `${current} La ficha técnica de esta referencia consigna dos valores de anchura, ${first.toLocaleString("es-ES")} m y ${second.toLocaleString("es-ES")} m, sin aclarar a qué configuración corresponde cada uno. Se debe comprobar la anchura real de la unidad antes de planificar accesos y transporte.`;
};
