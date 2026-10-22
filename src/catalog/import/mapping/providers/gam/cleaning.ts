import type { ProductRecord } from "../../../../../contracts/catalog.js";
import { numberToken } from "../../attribute-utils.js";
import type { Attribute, Candidate } from "../../attribute-types.js";

const cleaningFamily = (record: ProductRecord): "fregadora" | "barredora" | "aspiradora" | null => {
  let section = "";
  try {
    const url = new URL(record.url);
    if (url.hostname !== "online.gamrentals.com") return null;
    const path = url.pathname.split("/").filter(Boolean);
    if (path[0] !== "es") return null;
    section = path[1] ?? "";
  } catch {
    return null;
  }
  const families = [
    { type: "fregadora", category: "limpieza-fregadoras", section: "fregadoras-industriales-nuevas", title: /\bfregadora\b/i },
    { type: "barredora", category: "limpieza-barredoras", section: "barredoras-industriales-nuevas", title: /\bbarredora\b/i },
    { type: "aspiradora", category: "marcas-nuevas", section: "aspiradoras-industriales-nuevas", title: /\baspiradora\b/i }
  ] as const;
  for (const family of families) {
    if (family.title.test(record.title ?? "") && (section === family.section || section === "tennant" && record.categoryKey === family.category)) {
      return family.type;
    }
  }
  return null;
};

const foldText = (value: string): string => value.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

const energy = (description: string): string | null => {
  const text = foldText(description);
  const found = new Set<string>();
  if (/\b(?:a bateria|alimentad[oa]s? por baterias?|funciona(?:miento)? (?:con|a) baterias?|opera (?:con|a) baterias?|motor a bateria|equipa(?:d[oa])? con baterias?|equipad[oa]s? con (?:un sistema de baterias?|una bateria que (?:proporciona|ofrece|permite|garantiza))|con baterias? de \d+(?:[.,]\d+)?\s*v y autonomia|gracias a su bateria|autonomia[^.!?]{0,90}baterias?|baterias? (?:de (?:iones|gel|litio|alta capacidad|larga duracion|\d)|que ofrece|permite|proporciona|garantiza|para el funcionamiento))\b/.test(text)) {
    found.add("Batería");
  }
  if (/\bcable de alimentacion de \d+(?:[.,]\d+)? metros?\b|\balimentacion por cable\b|\bfunciona con cable\b/.test(text)) {
    found.add("Cable");
  }
  if (/\b(?:motor(?:es)? (?:a |de )?diesel|alimentad[oa]s? (?:por|con) diesel|funciona(?:miento)? (?:con|a) diesel|version(?:es)? diesel)\b/.test(text)) {
    found.add("Diésel");
  }
  if (/\b(?:motor(?:es)? (?:a |de )?(?:glp|lpg)|alimentad[oa]s? (?:por|con) (?:glp|lpg)|funciona(?:miento)? (?:con|a) (?:glp|lpg)|version(?:es)? (?:glp|lpg))\b/.test(text)) {
    found.add("GLP");
  }
  if (/\bbaterias? opcional(?:es)?\b/.test(text)) return null;
  if (/\bdiesel\b/.test(text) && /\b(?:glp|lpg)\b/.test(text)) return null;
  if (/\b(?:diesel\s*\/\s*(?:lpg|glp)|(?:lpg|glp)\s*\/\s*diesel|gasolina\s+o\s+diesel|diesel\s+o\s+gasolina)\b/.test(text)) return null;
  if (/\b(?:gasolina|gasoleo)\b/.test(text) && found.size > 0) return null;
  return found.size === 1 ? [...found][0] ?? null : null;
};

const driver = (description: string): string | null => {
  const text = foldText(description);
  if (/\b(?:robot|robotica|autonom[oa])\b/.test(text) && /\b(?:fregadora|barredora|aspiradora)\b/.test(text)) return null;
  const onBoard = /\b(?:conductor|operari[oa]|operador|hombre) sentado\b|\b(?:conductor|operari[oa]|operador|hombre) a bordo\b|\boperacion a bordo\b/.test(text);
  const walking = /\b(?:conductor|operari[oa]|operador) acompanante\b|\bhombre a pie\b|\b(?:conductor|operari[oa]|operador) a pie\b|\bwalk.behind\b/.test(text);
  if (onBoard === walking) return null;
  return onBoard ? "Hombre a bordo" : "Hombre a pie";
};

const workWidth = (description: string): number | null => {
  const text = foldText(description);
  const expression = /\b(?:(?:ancho|anchura) de (?:trabajo|barrido|fregado|restregado|limpieza)|(?:franja|trayectoria) de limpieza(?: total)?)\b[^\d.!?]{0,55}?(\d[\d.,]*)\s*(mm|cm|metros?|m)\b/g;
  if (/\bmientras que (?:el|los) (?:cabezal|cepillos?) [^.!?]{0,85}\b(?:cubre|abarca|tiene un ancho de)\s+\d[\d.,]*\s*(?:mm|cm|m)\b/.test(text)) return null;
  const values = new Set<number>();
  for (const match of text.matchAll(expression)) {
    if (/\b(?:hasta|m[aá]ximo|puede llegar)\b/.test(match[0])) continue;
    const raw = match[1];
    const unit = match[2];
    if (!raw || !unit) continue;
    const parsed = numberToken(raw);
    if (parsed === null || parsed <= 0) continue;
    const mm = parsed * (unit === "mm" ? 1 : unit === "cm" ? 10 : 1000);
    if (!Number.isFinite(mm)) return null;
    values.add(Math.round(mm * 1000) / 1000);
    const rest = text.slice((match.index ?? 0) + match[0].length, (match.index ?? 0) + match[0].length + 85);
    if (/\b(?:o|y|hasta)\s+\d[\d.,]*\s*(?:mm|cm|metros?|m)(?![a-z0-9²³])/.test(rest)) return null;
  }
  return values.size === 1 ? [...values][0] ?? null : null;
};

export const gamCleaningCandidate = (record: ProductRecord, attribute: Attribute): Candidate | null => {
  if (!cleaningFamily(record)) return null;
  const modelCode = record.model?.match(/\b([a-z]{1,4}\d{2,4})([a-z]{1,3})\b/i);
  if (modelCode?.[1] && modelCode[2] && record.longDescription) {
    const variants = record.longDescription.match(new RegExp(`\\b${modelCode[1]}[a-z]{1,3}\\b`, "gi")) ?? [];
    if (variants.length > 0 && !variants.some((variant) => variant.toLowerCase() === `${modelCode[1]}${modelCode[2]}`.toLowerCase())) {
      return null;
    }
  }
  const text = `${record.title}. ${record.longDescription ?? record.shortDescription ?? ""}`;
  if (attribute.name === "Alimentación" && attribute.type === "SELECT") {
    const value = energy(text);
    return value === null ? null : { key: attribute.name, value };
  }
  if (attribute.name === "Tipo de conductor" && attribute.type === "SELECT") {
    const modelToken = record.model?.split(/[^a-zA-Z0-9]+/).find((part) => part.length >= 3 && /[a-zA-Z]/.test(part) && /\d/.test(part));
    const trustedShort = modelToken && record.shortDescription &&
      new RegExp(`\\b${modelToken}\\b`, "i").test(record.shortDescription)
      ? record.shortDescription : "";
    const value = driver(`${text} ${trustedShort}`);
    return value === null ? null : { key: attribute.name, value };
  }
  if (attribute.name === "Ancho de trabajo" && attribute.type === "NUMBER" && attribute.unit_option === "mm") {
    const value = workWidth(text);
    return value === null ? null : { key: attribute.name, value };
  }
  return null;
};
