import type { ProductRecord } from "../../../../../contracts/catalog.js";

const normalize = (value: string): string => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "")
  .toLowerCase().replace(/[^a-z0-9]/g, "");

const words = (text: string): string[] => text.split(/\s+/u).filter(Boolean);

const spec = (record: ProductRecord, key: string): string | null => {
  const value = record.specs?.[key];
  return typeof value === "string" ? value : null;
};

const sentences = (text: string): string[] => text.trim()
  .split(/(?<=[.!?])\s+(?=[A-ZÁÉÍÓÚÑ¿])/u).map((sentence) => sentence.trim()).filter(Boolean);

const technicalNumbers = (text: string): Set<string> =>
  new Set(text.match(/\d+(?:[.,]\d+)*/gu) ?? []);

const lexicalTerms = (text: string): Set<string> =>
  new Set(text.normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toLowerCase().split(/[^a-z0-9]+/u).filter((term) => term.length >= 5));

const redundantConclusion = (sentence: string): boolean =>
  /^(?:Por (?:todo )?ello|Por estas caracter[ií]sticas|Gracias a estas caracter[ií]sticas),/iu.test(sentence) &&
  /\b(?:soluci[oó]n|alternativa)\b/iu.test(sentence) && /\bempresas\b/iu.test(sentence);

const tokens = (text: string): string[] => text.normalize("NFD").replace(/[\u0300-\u036f]/g, "")
  .toLowerCase().split(/[^a-z0-9]+/u).filter(Boolean);

const overlappingClaim = (a: string, b: string): boolean => {
  const first = tokens(a);
  const second = tokens(b);
  if (first.length < 12 || second.length < 12) return false;
  const phrases = new Set<string>();
  for (let index = 0; index <= first.length - 12; index++) phrases.add(first.slice(index, index + 12).join(" "));
  if (!second.some((_, index) => index <= second.length - 12 && phrases.has(second.slice(index, index + 12).join(" ")))) return false;
  const one = lexicalTerms(a);
  const two = lexicalTerms(b);
  const intersection = [...one].filter((word) => two.has(word)).length;
  if (intersection / (one.size + two.size - intersection) < 0.5) return false;
  const qualifiers = ["no", "sin", "siempre", "solo", "solamente", "hasta", "fabricante", "limites", "limitaciones"];
  return qualifiers.every((qualifier) => !tokens(a).includes(qualifier) || tokens(b).includes(qualifier));
};

const redundantRestatement = (sentence: string, earlier: readonly string[]): boolean => {
  const prefix = normalize(sentence.slice(0, 85));
  return (prefix.length >= 60 && earlier.some((other) => normalize(other.slice(0, 85)) === prefix)) ||
    earlier.some((other) => overlappingClaim(sentence, other));
};

const marketingTerms = new Set([
  "alternativa", "representa", "constituye", "empresas", "buscan", "combinando", "solucion",
  "optimizar", "eficiencia", "facilidad", "capaz", "adaptarse", "potente", "robusta",
  "robusto", "renunciar", "reducir", "gestion", "logisticas", "manejo", "versatil",
  "versatilidad", "interesante", "practica", "practico", "sencillo", "avanzar"
]);

const noNewFacts = (sentence: string, remaining: string): boolean => {
  const remainingNumbers = technicalNumbers(remaining);
  if ([...technicalNumbers(sentence)].some((value) => !remainingNumbers.has(value))) return false;
  const statementTerms = lexicalTerms(sentence);
  const remainingTerms = lexicalTerms(remaining);
  if (statementTerms.size === 0) return false;
  const newTerms = [...statementTerms].filter((term) => !remainingTerms.has(term));
  if (newTerms.some((term) => !marketingTerms.has(term))) return false;
  return (statementTerms.size - newTerms.length) / statementTerms.size >= 0.75;
};

const identityMatches = (record: ProductRecord): boolean => {
  if (record.providerId !== "gam" || record.condition !== "Nuevo" || !record.reference ||
    !record.title || !record.brand || !record.model || !record.longDescription ||
    !["carretillas-nuevas", "marcas-nuevas", "elevacion-nueva", "apiladores-nuevos"].includes(record.categoryKey) ||
    normalize(spec(record, "Marca") ?? "") !== normalize(record.brand) ||
    normalize(spec(record, "Modelo") ?? "") !== normalize(record.model) ||
    (record.externalReference && normalize(record.externalReference) !== normalize(record.model)) ||
    !normalize(record.title).includes(normalize(record.brand)) ||
    !normalize(record.title).includes(normalize(record.model)) ||
    !normalize(record.longDescription).includes(normalize(`${record.brand}${record.model}`))) return false;
  try {
    const url = new URL(record.url);
    return url.protocol === "https:" && url.hostname === "online.gamrentals.com" &&
      url.pathname.split("/").at(-1)?.startsWith(`${record.reference}-`) === true &&
      !url.search && !url.hash &&
      normalize(url.pathname.split("/").at(-1) ?? "").includes(normalize(record.model));
  } catch {
    return false;
  }
};

export const resolveGamLongDescription = (record: ProductRecord): string | null => {
  const original = record.longDescription;
  if (!original || words(original).length <= 800 || original.includes("\n\n") || !identityMatches(record)) return null;

  const sourceSentences = sentences(original);
  if (sourceSentences.length < 20) return null;
  const preserved = sourceSentences.map((sentence, sourceIndex) => ({ sentence, sourceIndex }));
  for (const [sourceIndex, sentence] of sourceSentences.entries()) {
    const index = preserved.findIndex((item) => item.sourceIndex === sourceIndex);
    if (index < 0) continue;
    if (!redundantConclusion(sentence) &&
      !redundantRestatement(sentence, sourceSentences.slice(0, sourceIndex))) continue;
    const remaining = preserved.filter((_, position) => position !== index).map((item) => item.sentence).join(" ");
    if (noNewFacts(sentence, remaining)) preserved.splice(index, 1);
  }

  const paragraphs: string[] = [];
  let paragraph: string[] = [];
  let length = 0;
  for (const { sentence } of preserved) {
    if (paragraph.length > 0 && (paragraph.length >= 4 || length + sentence.length > 620)) {
      paragraphs.push(paragraph.join(" "));
      paragraph = [];
      length = 0;
    }
    paragraph.push(sentence);
    length += sentence.length + 1;
  }
  if (paragraph.length > 0) paragraphs.push(paragraph.join(" "));
  return paragraphs.length > 1 ? paragraphs.join("\n\n") : null;
};
