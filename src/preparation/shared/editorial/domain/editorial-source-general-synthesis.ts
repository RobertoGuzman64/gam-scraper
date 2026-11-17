import type { ProductRecord } from "../../../../contracts/catalog.js";
import { sameEditorialUnit } from "./editorial-source-contract.js";

const wordCount = (value: string): number => value.trim().split(/\s+/u).filter(Boolean).length;

const quantities = (value: string): ReadonlySet<string> =>
  new Set(value.match(/\d+(?:[.,]\d+)*/gu) ?? []);

const condition = /\b(?:opci[oó]n|opcionales?|alternativas|excepto|salvo|sin\s+|no\s+(?:incluye|dispone|incorpora|requiere)|depende\s+de|seg[uú]n\s+(?:la|el|las|los))\b/iu;
const technical = /\b(?:motor|sistema|direcci[oó]n|tracci[oó]n|bater[ií]a|control|freno|frenado|carga|capacidad|altura|alcance|horquilla|m[aá]stil|transmisi[oó]n|cesta|estabilizaci[oó]n|plataforma|seguridad|cabina|ruedas|pendiente|potencia|hidr[aá]ulic[oa]|ruido|autonom[ií]a|giro|neum[aá]tic[oa]|movimiento|velocidad|operador|operari[oa]|elevaci[oó]n|iluminaci[oó]n)\b/giu;
const safetyFeatures = /\b(?:sensores?|alarmas?|parada de emergencia|frenado regenerativo|detectores?|control proporcional)\b/giu;
const essentialFeatures = /\b(?:freno (?:de servicio )?electromagn[eé]tico|Smart Lift|Thermo-Sentry)\b/giu;
const proprietaryFeatures = /\b(?:[A-Z][a-z]+-[A-Z][a-z]+|[A-Z][a-z]+[A-Z][a-z]+)\b/gu;
const promotional = /\b(?:cont[aá]ctanos|cons[uú]ltanos|ll[aá]manos|pide\s+presupuesto|tu\s+negocio|tu\s+empresa|invierte\s+en|descubre|conf[ií]a\s+en|soluci[oó]n\s+ideal|mejor\s+elecci[oó]n|nuestro\s+equipo\s+comercial)\b/iu;

export const synthesizeSourcedLongGeneral = (
  source: ProductRecord, prepared: ProductRecord, general: string | null, authenticatedOrigin: boolean
): string | null => {
  const original = source.longDescription?.trim();
  if (!authenticatedOrigin || !sameEditorialUnit(source, prepared) || !original || !general ||
    wordCount(original) < 260 || wordCount(original) > 1500 ||
    /https?:\/\/|<[^>]+>|@/u.test(original)) return null;
  const current = general.trim();
  const appended = `\n\n${original}`;
  const prefix = current === original ? "" :
    current.startsWith("La ficha técnica de ") && current.endsWith(appended) ?
      current.slice(0, -appended.length) : null;
  if (prefix === null) return null;

  const veryLong = wordCount(original) > 800;
  const expansive = !prefix && wordCount(original) > 500 && wordCount(original) <= 800;
  const maxWords = veryLong ? 295 : prefix ? 275 - wordCount(prefix) : 285;
  const targetWords = veryLong ? 270 : prefix ? maxWords - 30 : 230;
  const sentences = original.split(/(?<=[.!?])\s+(?=[¿¡A-ZÁÉÍÓÚÜÑ0-9])/u).map((value) => value.trim());
  if (sentences.length < 10 || sentences.some((sentence) => !/[.!?]$/u.test(sentence))) return null;
  const summarize = (limit: number, target: number, preserveAdditional: boolean): string | null => {
    const selected = new Set<number>([0]);
    const retained = new Set(quantities(sentences[0] ?? ""));
    const retainedConditions = new Set<string>();
    for (let index = 1; index < sentences.length; index += 1) {
      const sentence = sentences[index] ?? "";
      const numbers = quantities(sentence);
      const qualifier = condition.exec(sentence)?.[0].trim().toLocaleLowerCase("es") ?? "";
      const newCondition = qualifier && (!veryLong || !retainedConditions.has(qualifier.split(/\s+/u)[0] ?? ""));
      if ([...numbers].some((number) => !retained.has(number)) || newCondition) {
        selected.add(index);
        for (const number of numbers) retained.add(number);
        if (qualifier) retainedConditions.add(qualifier.split(/\s+/u)[0] ?? "");
      }
    }

    for (const [index, sentence] of sentences.entries()) {
      if (preserveAdditional && (sentence.match(safetyFeatures) || sentence.match(essentialFeatures))) selected.add(index);
    }
    for (const index of [...selected]) {
      if ((preserveAdditional || prefix) && index > 0 && /^(?:Este sistema|Este motor|Esta tecnología|Esta característica)\b/iu.test(sentences[index] ?? "")) selected.add(index - 1);
      if ((preserveAdditional || prefix) && /\bDSS\b/u.test(sentences[index] ?? "")) {
        const qualifier = sentences.findIndex((sentence) => /\bDSS\b/u.test(sentence) && /\bopcional(?:mente)?\b/iu.test(sentence));
        if (qualifier >= 0) selected.add(qualifier);
      }
      if (index > 0 && /^(?:S[ií]|No)[,.]/iu.test(sentences[index] ?? "") &&
        /^¿/u.test(sentences[index - 1] ?? "")) selected.add(index - 1);
    }

    const length = (): number => [...selected].reduce((total, index) =>
      total + wordCount(sentences[index] ?? ""), 0);
    if (length() > limit) return null;

    const candidates = sentences.map((sentence, index) => ({
      index,
      words: wordCount(sentence),
      score: [...sentence.matchAll(technical)].length - (promotional.test(sentence) ? 10 : 0)
    })).filter((item) => !selected.has(item.index) && item.score >= 1 &&
      !promotional.test(sentences[item.index] ?? "") && !/^[¿¡]/u.test(sentences[item.index] ?? ""))
      .sort((left, right) => right.score - left.score || left.index - right.index);
    for (const candidate of candidates) {
      if (length() >= target) break;
      if (length() + candidate.words <= limit) selected.add(candidate.index);
    }

    if ((preserveAdditional || prefix) && [...selected].some((index) => /\b(?:Este sistema|Este motor)\b/iu.test(sentences[index] ?? "") &&
      index > 0 && !selected.has(index - 1))) return null;
    const summarized = [...selected].sort((left, right) => left - right)
      .map((index) => sentences[index]).join(" ");
    if (wordCount(summarized) < (veryLong ? 215 : 160) || wordCount(summarized) >= (preserveAdditional ? 415 : 300) ||
      [...quantities(original)].some((number) => !quantities(summarized).has(number)) ||
      [...original.matchAll(safetyFeatures)].some((match) => !summarized.includes(match[0])) ||
      [...original.matchAll(proprietaryFeatures)].some((match) => !summarized.includes(match[0]))) return null;
    return summarized === original ? null : prefix ? `${prefix}\n\n${summarized}` : summarized;
  };
  return summarize(maxWords, targetWords, false) ??
    (expansive ? summarize(410, 350, true) : null);
};
