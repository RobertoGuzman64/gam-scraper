import type { ProductRecord } from "../../../../../contracts/catalog.js";
import { gamHandlingModelEvidence } from "./handling.js";

const families = [
    { type: "fregadora", category: "limpieza-fregadoras", section: "fregadoras-industriales-nuevas", title: /\b(?:micro)?fregadora\b/i },
    { type: "barredora", category: "limpieza-barredoras", section: "barredoras-industriales-nuevas", title: /\bbarredora\b/i },
    { type: "aspiradora", category: "marcas-nuevas", section: "aspiradoras-industriales-nuevas", title: /\baspiradora\b/i }
] as const;

export const cleaningFamily = (record: ProductRecord): "fregadora" | "barredora" | "aspiradora" | null => {
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
  for (const family of families) {
    if (family.title.test(record.title ?? "") && (section === family.section || section === "tennant" && record.categoryKey === family.category)) {
      return family.type;
    }
  }
  return null;
};

export const foldText = (value: string): string => value.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

export const energy = (description: string): string | null => {
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

export const batteryFromConfirmedDescription = (record: ProductRecord): string | null => {
  const descriptions = [record.shortDescription, record.longDescription].filter((description): description is string =>
    typeof description === "string" && description.trim().length > 0 && gamHandlingModelEvidence(record, description)
  );
  const text = foldText(descriptions.join(". "));
  if (/\bbaterias? opcional(?:es)?\b|\b(?:diesel|glp|lpg|gasolina)\b/.test(text)) return null;
  if (/\bautonomia\b[^.!?]{0,90}\bcon la bateria estandar\b|\b\d+(?:[.,]\d+)?\s*kg\s*\(\s*con baterias\s*\)/.test(text)) {
    return "Batería";
  }
  return null;
};

export const driver = (description: string): string | null => {
  const text = foldText(description);
  if (/\b(?:robot|robotica|autonom[oa])\b/.test(text) && /\b(?:fregadora|barredora|aspiradora)\b/.test(text)) return null;
  const onBoard = /\b(?:conductor|operari[oa]|operador|hombre) sentado\b|\b(?:conductor|operari[oa]|operador|hombre) a bordo\b|\boperacion a bordo\b/.test(text);
  const walking = /\b(?:conductor|operari[oa]|operador) acompanante\b|\bhombre a pie\b|\b(?:conductor|operari[oa]|operador) a pie\b|\bwalk.behind\b/.test(text);
  if (onBoard === walking) return null;
  return onBoard ? "Hombre a bordo" : "Hombre a pie";
};

