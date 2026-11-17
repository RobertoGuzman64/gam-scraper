import type { ProductRecord } from "../../../../contracts/catalog.js";
import { sameEditorialUnit } from "./editorial-source-contract.js";

const folded = (value: string): string => value.normalize("NFD")
  .replace(/[\u0300-\u036f]/gu, "").toLocaleLowerCase("es").replace(/[^a-z0-9]/gu, "");

export const resolveSourcedShortContext = (
  source: ProductRecord, prepared: ProductRecord, general: string | null, authenticatedOrigin: boolean
): string | null => {
  const short = source.shortDescription?.trim();
  const long = source.longDescription?.trim();
  const sourceModelSpec = source.specs?.Modelo;
  if (!authenticatedOrigin || !short || !long || !general?.trim() ||
    !sameEditorialUnit(source, prepared) ||
    !source.title || !prepared.title || !source.model ||
    source.specs?.Marca !== prepared.specs?.Marca ||
    sourceModelSpec !== prepared.specs?.Modelo ||
    typeof sourceModelSpec !== "string" ||
    folded(sourceModelSpec) !== folded(source.model) ||
    !folded(source.title).includes(folded(source.model)) ||
    !folded(prepared.title).includes(folded(source.model)) ||
    !folded(short).includes(folded(source.model)) ||
    folded(general).includes(folded(short)) ||
    /https?:\/\/|<[^>]+>|@|\b(?:oferta|descuento|financiaci[oó]n)\b/iu.test(short)) return null;
  const shortWords = short.split(/\s+/u).length;
  const longWords = long.split(/\s+/u).length;
  if (shortWords < 28 || shortWords > 90 || longWords < 12 || longWords > 42 ||
    shortWords < longWords + 8 || general.trim().split(/\s+/u).length > 42 ||
    !/[.!?]$/u.test(short)) return null;
  return `${general.trim()}${/[.!?]$/u.test(general.trim()) ? "" : "."} La descripción específica de esta referencia añade: ${short}`;
};
