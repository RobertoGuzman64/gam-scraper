import type { ProductRecord } from "../../../../contracts/catalog.js";

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

const extremeTopics = [
  /\bcapacidad de carga\b/iu,
  /\bcentro de carga\b/iu,
  /\bion de litio|bater[ií]a LFP\b/iu,
  /\brecargas parciales|carga lateral|cargadores\b/iu,
  /\btemperatura de la bater[ií]a|calentamiento autom[aá]tico\b/iu,
  /\bmotor de tracci[oó]n|imanes permanentes\b/iu,
  /\bmotor de elevaci[oó]n|refrigeraci[oó]n por agua\b/iu,
  /\baltura de elevaci[oó]n|configuraciones de m[aá]stil\b/iu,
  /\bcapacidad residual|tablas de capacidades\b/iu,
  /\bradio de giro\b/iu,
  /\bvelocidad de desplazamiento\b/iu,
  /\baltura libre al suelo\b/iu,
  /\bneum[aá]ticos|ruedas delanteras dobles\b/iu,
  /\bIPX4|salpicaduras de agua\b/iu,
  /\bsistema de presencia|reducci[oó]n de velocidad en curvas\b/iu,
  /\biluminaci[oó]n LED|pantalla informativa|pantalla en color\b/iu,
  /\bvisibilidad|ergon[oó]mico\b/iu,
  /\bfrenado regenerativo\b/iu,
  /\bdesplazadores laterales|posicionadores de horquillas|telemetr[ií]a\b/iu,
  /\bno (?:es(?:t[aá])?|est[aá]) dise[nñ]ad[ao]|no es un equipo todoterreno\b/iu,
  /\balmacenes|muelles de carga|patios industriales\b/iu
] as const;

const technicalTopics = (sentence: string): Set<number> => new Set(
  extremeTopics.flatMap((pattern, index) => pattern.test(sentence) ? [index] : [])
);

const extremeRedundant = (sentence: string): boolean =>
  /^(?:Por (?:todo )?ello|Gracias a estas caracter[ií]sticas|En este sentido),/iu.test(sentence) ||
  /\b(?:representa|constituye) una (?:soluci[oó]n|alternativa)\b/iu.test(sentence);

const summarizeExtremeDescription = (record: ProductRecord, original: string): string | null => {
  if (words(original).length <= 800 || !identityMatches(record)) return null;
  const source = sentences(original);
  if (source.length < 35) return null;

  const numeric = source.map(technicalNumbers);
  const topics = source.map(technicalTopics);
  const selected = new Set<number>([0, 1]);
  const coveredNumbers = new Set<string>([...numeric[0] ?? [], ...numeric[1] ?? []]);
  const coveredTopics = new Set<number>([...topics[0] ?? [], ...topics[1] ?? []]);
  let totalWords = words(source[0] ?? "").length + words(source[1] ?? "").length;
  const targetWords = 750;
  const allNumbers = technicalNumbers(original);
  const allTopics = new Set(topics.flatMap((items) => [...items]));

  while ([...allNumbers].some((value) => !coveredNumbers.has(value)) ||
    [...allTopics].some((value) => !coveredTopics.has(value))) {
    let bestIndex: number | null = null;
    let bestScore = -Infinity;
    for (let index = 2; index < source.length; index++) {
      if (selected.has(index)) continue;
      const sentence = source[index];
      if (!sentence) continue;
      const count = words(sentence).length;
      if (totalWords + count > targetWords) continue;
      const newNumbers = [...numeric[index] ?? []].filter((value) => !coveredNumbers.has(value)).length;
      const newTopics = [...topics[index] ?? []].filter((value) => !coveredTopics.has(value)).length;
      if (newNumbers === 0 && newTopics === 0) continue;
      const score = newNumbers * 25 + newTopics * 15 - count * 0.18 -
        (extremeRedundant(sentence) ? 20 : 0) -
        (/^(?:Esta|Este|Estas|Estos|Gracias|Por ello)\b/iu.test(sentence) ? 8 : 0);
      if (score > bestScore) {
        bestIndex = index;
        bestScore = score;
      }
    }
    if (bestIndex === null) return null;
    selected.add(bestIndex);
    totalWords += words(source[bestIndex] ?? "").length;
    for (const value of numeric[bestIndex] ?? []) coveredNumbers.add(value);
    for (const value of topics[bestIndex] ?? []) coveredTopics.add(value);
  }

  const chosen = [...selected].sort((a, b) => a - b).map((index) => source[index] ?? "");
  if (chosen.length < 7 || totalWords >= words(original).length / 2 ||
    [...allNumbers].some((value) => !technicalNumbers(chosen.join(" ")).has(value))) return null;
  const paragraphs: string[] = [];
  for (let index = 0; index < chosen.length; index += 3) {
    paragraphs.push(chosen.slice(index, index + 3).join(" "));
  }
  return paragraphs.join("\n\n");
};

export const removeGamOrphanAffirmative = (record: ProductRecord, preparedGeneral: string | null): string | null => {
  const original = record.longDescription;
  if (!original || preparedGeneral !== original) return null;
  const count = words(original).length;
  if (record.brand !== "HYSTER" || record.categoryKey !== "carretillas-nuevas" ||
    count < 150 || count > 400 || original.includes("\n\n") || !identityMatches(record)) return null;
  const pattern = /(?<=\.)\s+Sí\.\s+(?=[A-ZÁÉÍÓÚÑ])/gu;
  const matches = [...original.matchAll(pattern)];
  if (matches.length !== 1) return null;
  return original.replace(pattern, " ");
};

export const resolveGamLongDescription = (record: ProductRecord): string | null => {
  const original = record.longDescription;
  if (!original) return null;
  const extreme = summarizeExtremeDescription(record, original);
  if (extreme !== null) return extreme;
  if (words(original).length <= 800 || original.includes("\n\n") || !identityMatches(record)) return null;

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

export const removeGamDetachedAffirmatives = (record: ProductRecord, preparedGeneral: string | null): string | null => {
  const original = record.longDescription;
  if (removeGamOrphanAffirmative(record, preparedGeneral) !== null) return null;
  if (!original || !preparedGeneral || record.providerId !== "gam" || record.condition !== "Nuevo" ||
    !record.brand || !record.model || !record.reference || !record.title ||
    !["carretillas-nuevas", "apiladores-nuevos", "elevacion-nueva", "limpieza-fregadoras"].includes(record.categoryKey) ||
    normalize(spec(record, "Marca") ?? "") !== normalize(record.brand) ||
    normalize(spec(record, "Modelo") ?? "") !== normalize(record.model) ||
    (record.externalReference && normalize(record.externalReference) !== normalize(record.model)) ||
    !normalize(record.title).includes(normalize(record.brand)) ||
    !normalize(record.title).includes(normalize(record.model)) ||
    !normalize(original).includes(normalize(record.brand)) ||
    !normalize(original).includes(normalize(record.model)) ||
    /\bNo\.\s+[A-ZÁÉÍÓÚÑ]/u.test(original)) return null;
  try {
    const url = new URL(record.url);
    const slug = url.pathname.split("/").at(-1) ?? "";
    if (url.protocol !== "https:" || url.hostname !== "online.gamrentals.com" ||
      !slug.startsWith(`${record.reference}-`) || !normalize(slug).includes(normalize(record.brand)) ||
      !normalize(slug).includes(normalize(record.model)) || url.search || url.hash) return null;
  } catch {
    return null;
  }
  const pattern = /(?<=\.)\s+Sí\.\s+(?=[A-ZÁÉÍÓÚÑ])/gu;
  const sourceCount = [...original.matchAll(pattern)].length;
  const preparedCount = [...preparedGeneral.matchAll(pattern)].length;
  if (sourceCount !== 1 || preparedCount !== 1 ||
    words(preparedGeneral).length < 150) return null;
  return preparedGeneral.replace(pattern, " ");
};


const vehicleListingChecklist = "✔️ Mantenimiento al día✔️ Revisión recién pasada✔️ Estado impecable de motor, interiores y carrocería";
const vehicleListingHeader = "Vehículo en Perfecto Estado – Recién Revisado y Listo para Rodar";

export const removeGamVehicleListingMarkers = (record: ProductRecord, preparedGeneral: string | null): string | null => {
  if (record.providerId !== "gam" || record.categoryKey !== "movilidad" || record.condition !== "Segunda mano" ||
    !record.reference || !/^\d+$/u.test(record.reference) || !record.longDescription || !preparedGeneral ||
    !record.longDescription.includes(vehicleListingHeader) ||
    !record.longDescription.includes(vehicleListingChecklist) ||
    !record.longDescription.includes("Ponemos a la venta este coche") ||
    !preparedGeneral.includes(record.longDescription)) return null;
  try {
    const url = new URL(record.url);
    if (url.protocol !== "https:" || url.hostname !== "online.gamrentals.com" ||
      url.search || url.hash || !url.pathname.startsWith(`/es/vehiculos-segunda-mano/${record.reference}-`)) return null;
  } catch {
    return null;
  }
  const revised = preparedGeneral
    .replace(/^\? (?=Vehículo en Perfecto Estado)/u, "")
    .replace("Listo para Rodar ? Ponemos a la venta", "Listo para Rodar. Ponemos a la venta")
    .replace("Listo para Rodar Ponemos a la venta", "Listo para Rodar. Ponemos a la venta")
    .replace(vehicleListingChecklist,
      "Mantenimiento al día. Revisión recién pasada. Estado impecable de motor, interiores y carrocería.");
  return revised === preparedGeneral ? null : revised;
};

const residualResponseModels: Readonly<Record<string, number>> = {
  "HYSTER:H20FT": 1,
  "HYSTER:H25A6": 1,
  "HYSTER:H25FT": 1,
  "HYSTER:J20UTTL": 2,
  "TENNANT:FAX6ROVR": 3,
  "BRAVI:SMALLE": 3,
  "BRAVI:LEONARDOHD430": 1,
  "HYSTER:H45FT6": 1,
  "HYSTER:H28XD12": 1
};

const residualResponse = /(?<=\.)\s+(?:Sí|No)\.\s+(?=[A-ZÁÉÍÓÚÑ])/gu;
const pramacEmptyHeadings = "El panel de control manual está montado en grupo y está completo con: Instrumentación: Comandos: Protección con alarma: Protecciones con paro:";

export const removeGamResidualEditorialArtifacts = (record: ProductRecord, preparedGeneral: string | null): string | null => {
  if (record.providerId !== "gam" || record.condition !== "Nuevo" ||
    !record.reference || !record.brand || !record.model || !record.title ||
    !record.longDescription || !preparedGeneral ||
    normalize(spec(record, "Marca") ?? "") !== normalize(record.brand) ||
    normalize(spec(record, "Modelo") ?? "") !== normalize(record.model) ||
    (record.externalReference && normalize(record.externalReference) !== normalize(record.model)) ||
    !normalize(record.title).includes(normalize(record.brand)) ||
    !normalize(record.title).includes(normalize(record.model))) return null;

  try {
    const url = new URL(record.url);
    const slug = url.pathname.split("/").at(-1) ?? "";
    if (url.protocol !== "https:" || url.hostname !== "online.gamrentals.com" ||
      url.search || url.hash || !slug.startsWith(`${record.reference}-`) ||
      !normalize(slug).includes(normalize(record.model))) return null;
  } catch {
    return null;
  }

  const modelKey = `${normalize(record.brand).toUpperCase()}:${normalize(record.model).toUpperCase()}`;
  if (record.brand.toUpperCase() === "PRAMAC" &&
    ["GSW65P", "GSW80P", "GSW110V", "GSW165P", "GSW200P"].includes(record.model) &&
    record.longDescription.endsWith(pramacEmptyHeadings) &&
    preparedGeneral.endsWith(pramacEmptyHeadings)) {
    return preparedGeneral.slice(0, -pramacEmptyHeadings.length) +
      "El panel de control manual está montado en grupo.";
  }

  const expected = residualResponseModels[modelKey];
  if (expected === undefined ||
    (preparedGeneral !== record.longDescription &&
      !(record.model === "H2.5FT" && removeGamOrphanAffirmative(record, record.longDescription) === preparedGeneral))) return null;
  let revised = preparedGeneral;
  if (record.model === "H2.0FT") {
    revised = revised.replace("La Hyster H2.0FT es ideal para: Sí. ", "");
  } else if (record.model === "H2.5A6") {
    revised = revised.replace("La H2.5A6 está diseñada para tareas en sectores como: Sí. ", "");
  } else if (record.model === "H2.5FT") {
    revised = revised.replace("Incluye: La Hyster H2.5FT es ideal para trabajar en entornos como: Sí. ", "");
  } else {
    const matches = [...revised.matchAll(residualResponse)];
    if (matches.length !== expected) return null;
    revised = revised.replace(residualResponse, " ");
  }
  if (revised === preparedGeneral) return null;
  const removed = [...preparedGeneral.matchAll(/\b(?:Sí|No)\.\s+(?=[A-ZÁÉÍÓÚÑ])/gu)].length -
    [...revised.matchAll(/\b(?:Sí|No)\.\s+(?=[A-ZÁÉÍÓÚÑ])/gu)].length;
  return removed === expected ? revised : null;
};
