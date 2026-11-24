import type { ProductRecord } from "../../../contracts/catalog.js";
import { sameEditorialUnit } from "../core/editorial-source-contract.js";

const wordCount = (value: string): number => value.trim().split(/\s+/u).filter(Boolean).length;

const promotional = /\b(?:elecci[oó]n|soluci[oó]n|opci[oó]n|inversi[oó]n|herramienta indispensable|herramienta ideal|alternativa ideal|perfect[oa] para|excelente combinaci[oó]n|equipo preparado|ideal para|productividad|rentabilidad|eficiencia operativa|optimizar|mejorar los resultados|mejorar la eficiencia|calidad y la experiencia|lista para enfrentar|rendimiento superior|limpieza efectiva|se destaca como|soluci[oó]n robusta|herramienta esencial)\b/iu;
const protectedSafety = /\b(?:alarmas?|sensores?|emergencia|antivuelco|Thermo-Sentry)\b/iu;
const protectedClaim = /\b(?:alarmas?|sensores?|frenos?|frenado|estabilizaci[oó]n|antivuelco|emergencia|seg[uú]n|excepto|salvo|opcional(?:es|mente)?|garant[ií]a|certificad[oa]|homologad[oa]|bater[ií]as?|motor(?:es)?|transmisi[oó]n|sistema hidr[aá]ulico|neum[aá]ticos?|filtros?|cabina|combustible|autonom[ií]a|capacidad de carga|altura de trabajo|control de polvo|retenci[oó]n)\b/iu;

export const removeSourcedPromotionalClosing = (
  source: ProductRecord, prepared: ProductRecord, general: string | null, authenticatedOrigin: boolean
): string | null => {
  const original = source.longDescription?.trim();
  const current = general?.trim();
  if (!authenticatedOrigin || !sameEditorialUnit(source, prepared) ||
    !source.model || !source.title?.includes(source.model) || !original || !current ||
    wordCount(original) < 175 || wordCount(original) > 1500 || protectedSafety.test(original) ||
    /<[^>]+>|https?:\/\/|@/u.test(original)) return null;
  const sentences = original.split(/(?<=[.!?])\s+(?=[¿¡A-ZÁÉÍÓÚÜÑ0-9])/u);
  if (sentences.length < 5) return null;
  const tail = sentences.at(-1)?.trim();
  if (!tail || !tail.endsWith(".") || wordCount(tail) < 11 || wordCount(tail) > 65) return null;
  const location = current.indexOf(original);
  const continuation = location < 0 || location !== current.lastIndexOf(original) ? null :
    current.slice(location + original.length);
  const documentedContinuation = continuation !== null &&
    (continuation === "" || /^ La descripción (?:breve del anuncio identifica|del anuncio menciona)\b/u.test(continuation));
  if (!current.endsWith(tail) && !documentedContinuation) return null;
  const retained = current.endsWith(tail) ? current.slice(0, -tail.length).trim() :
    current.slice(0, location + original.length - tail.length).trimEnd();
  if (wordCount(retained) < 145 || /[¿¡]\s*$/u.test(retained)) return null;
  const suffix = current.endsWith(tail) ? "" : continuation ?? "";
  if (/^S[ií],/iu.test(tail) && /^¿Es adecuad[oa]\b/iu.test(sentences.at(-2) ?? "")) {
    const neutral = tail.replace(/\bes una opci[oó]n perfecta para\b/iu, "se presenta como opción para")
      .replace(/\bes ideal para\b/iu, "se presenta como opción para");
    return neutral !== tail && !/\d/u.test(tail.replaceAll(source.model, "")) ?
      `${retained} ${neutral}${suffix}` : null;
  }
  if (/^(?:S[ií]|No)[,.]/iu.test(tail) || !promotional.test(tail) || protectedClaim.test(tail) ||
    /[¿¡:]|\b(?:no|sin|requiere|debe|s[oó]lo|solo|siempre)\b/iu.test(tail)) return null;
  const variantNeutral = source.model.replace(/\s+bater[ií]a$/iu, "");
  const withoutModel = tail.replaceAll(source.model, "").replaceAll(variantNeutral, "");
  if (/\d/u.test(withoutModel) || /[A-Z]{2,}\d/u.test(withoutModel)) return null;
  return `${retained}${suffix}`;
};
