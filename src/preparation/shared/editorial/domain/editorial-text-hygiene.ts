import { containsEditorialIdentity } from "./editorial-identity-match.js";
import type { ProductRecord } from "../../../../contracts/catalog.js";
import { verifiedEditorialIdentity } from "./editorial-source-contract.js";
import { resolveEditorialSource } from "./editorial-source.js";

const cleanIntro = (text: string, record: ProductRecord): string => {
  const intro = /^(?:¡?hola[!.]|¡?claro[!.]|bienvenid[oa]s?\s+a\s+[^.!?]{5,90}[.!?])\s+/iu.exec(text);
  if (!intro) return text;
  const rest = text.slice(intro[0].length).trim();
  return rest.length >= 60 && containsEditorialIdentity(rest, record.model ?? "") ? rest : text;
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
