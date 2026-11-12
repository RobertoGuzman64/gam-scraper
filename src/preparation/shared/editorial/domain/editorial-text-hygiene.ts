import type { ProductRecord } from "../../../../contracts/catalog.js";
import { verifiedEditorialIdentity } from "./editorial-source-contract.js";
import { resolveEditorialSource } from "./editorial-source.js";

const modelMentioned = (value: string, record: ProductRecord): boolean => {
  const fold = (text: string): string => text.normalize("NFD").replace(/[\u0300-\u036f]/gu, "")
    .toLocaleLowerCase("es").replace(/[^a-z0-9]/gu, "");
  return Boolean(record.model && fold(value).includes(fold(record.model)));
};

const cleanIntro = (text: string, record: ProductRecord): string => {
  const intro = /^(?:¡?hola[!.]|bienvenid[oa]s?\s+a\s+[^.!?]{5,90}[.!?])\s+/iu.exec(text);
  if (!intro) return text;
  const rest = text.slice(intro[0].length).trim();
  return rest.length >= 60 && modelMentioned(rest, record) ? rest : text;
};

const cleanDetachedAffirmative = (text: string): string =>
  text.replace(/(?<=\.)\s+S[ií]\.\s+(?=[A-ZÁÉÍÓÚÑ])/gu, " ");

const cleanLeadingMarkers = (text: string): string =>
  text.replace(/^[\s➨★⭐►•]+/u, "").replace(/\s+[➨★⭐►]+\s*/gu, ". ").trim();

export const cleanAuthenticatedSourceEditorial = (
  source: ProductRecord,
  short: string | null,
  general: string | null
): { readonly short: string | null; readonly general: string | null } => {
  if (!verifiedEditorialIdentity(source) || !resolveEditorialSource(source)) return { short, general };
  const sourceShort = short && short === source.shortDescription ? cleanLeadingMarkers(short) : short;
  const sourceGeneral = general && general === source.longDescription ?
    cleanDetachedAffirmative(cleanIntro(general.trim(), source)) : general;
  return { short: sourceShort, general: sourceGeneral };
};
