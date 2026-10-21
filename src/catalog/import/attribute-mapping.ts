import { SPEC_KEY_NORMALIZATION } from "../normalization/spec-rules.js";
import type { ProductRecord, SpecScalar, SpecValue } from "../../contracts/catalog.js";
import type { ImportCatalog } from "./prepare.js";

type Attribute = ImportCatalog["attributes"][number];

type Candidate = { readonly key: string; readonly value: SpecScalar };

const fold = (value: string): string => value.toLocaleLowerCase("es").normalize("NFD")
  .replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, " ").trim();

const aliases: Readonly<Record<string, readonly string[]>> = {
  "Tipo de mástil": ["Tipo Mástil"],
  "Capacidad de carga": ["Capacidad de carga (kg)"],
  "Altura de elevación": ["Altura de elevación (mm)", "Altura de elevación (m)"],
  "Peso operativo": ["Peso (kg)"],
  "Altura de trabajo": ["Altura de trabajo (mm)"],
  "Altura de plataforma": ["Altura plataforma", "Altura plataforma (mm)"],
  "Ancho de trabajo": ["Anchura trabajo (mm)"],
  "Potencia": ["Potencia (kW)"],
  "Horas de uso": ["Horas (h)", "Horas laborales"],
  "Año de fabricación": ["Año"],
  "Tipo de motor": ["Tipo motor"]
};

const scalar = (value: SpecValue): SpecScalar | null => {
  if (Array.isArray(value)) return value.length === 1 ? value[0] ?? null : null;
  return typeof value === "string" || typeof value === "number" || typeof value === "boolean" ? value : null;
};

const numberToken = (raw: string): number | null => {
  const value = raw.replace(/[\u00a0\u202f]/g, " ").trim();
  if (!/^\d[\d., ]*$/.test(value)) return null;
  let compact = value.replace(/ /g, "");
  if (/\d \d/.test(value) && !/^\d{1,3}(?: \d{3})+(?:[.,]\d{1,2})?$/.test(value)) return null;
  const dot = compact.lastIndexOf(".");
  const comma = compact.lastIndexOf(",");
  const last = Math.max(dot, comma);
  if (last >= 0) {
    const rest = compact.slice(last + 1);
    const before = compact.slice(0, last);
    if (rest.length <= 2 && rest.length > 0) compact = `${before.replace(/[.,]/g, "")}.${rest}`;
    else if (/^\d{1,3}(?:[.,]\d{3})+$/.test(compact)) compact = compact.replace(/[.,]/g, "");
    else return null;
  }
  const num = Number(compact);
  return Number.isFinite(num) && num >= 0 ? num : null;
};

const unitOf = (source: string): "mm" | "cm" | "m" | "kg" | "kw" | "h" | null => {
  const value = fold(source);
  if (["mm", "cm", "m", "metros", "metro", "kg", "kilogramos", "kilogramo", "kw", "h", "horas", "hora"].includes(value)) {
    if (value.startsWith("metro") || value === "m") return "m";
    if (value.startsWith("kilo") || value === "kg") return "kg";
    if (value.startsWith("hora") || value === "h") return "h";
    return value as "mm" | "cm" | "kw";
  }
  return null;
};

const numberValue = (value: SpecScalar, sourceKey: string, attribute: Attribute): number | null => {
  if (typeof value === "boolean") return null;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  const matched = value.trim().match(/^([\d.,\s\u00a0\u202f]+)\s*([a-záéíóú]+)?$/i);
  if (!matched?.[1]) return null;
  const parsed = numberToken(matched[1]);
  if (parsed === null) return null;
  const explicit = matched[2] ? unitOf(matched[2]) : null;
  if (matched[2] && !explicit) return null;
  const keyUnit = sourceKey.match(/\((mm|cm|m|kg|kw|h)\)/i)?.[1];
  const sourceUnit = explicit ?? (keyUnit ? unitOf(keyUnit) : null);
  const targetUnit = unitOf(attribute.unit_option);
  if (sourceUnit && targetUnit && sourceUnit !== targetUnit) {
    const ratios: Readonly<Record<string, number>> = { mm: 0.001, cm: 0.01, m: 1 };
    if (!(sourceUnit in ratios) || !(targetUnit in ratios)) return null;
    return parsed * (ratios[sourceUnit] ?? 0) / (ratios[targetUnit] ?? 1);
  }
  if (sourceUnit && !targetUnit && !(attribute.name === "Horas de uso" && sourceUnit === "h")) return null;
  return parsed;
};

const convert = (value: SpecScalar, key: string, attribute: Attribute): string | number | boolean | null => {
  if (attribute.type === "NUMBER") return numberValue(value, key, attribute);
  if (attribute.type === "BOOLEAN") {
    if (typeof value === "boolean") return value;
    if (typeof value !== "string") return null;
    if (["si", "true", "yes"].includes(fold(value))) return true;
    if (["no", "false"].includes(fold(value))) return false;
    return null;
  }
  if (typeof value === "boolean") return value ? "Sí" : "No";
  const text = String(value).trim();
  return text || null;
};

export const resolveAttributeValue = (record: ProductRecord, attribute: Attribute): string | number | boolean | null => {
  const keys = new Set([attribute.name, ...(aliases[attribute.name] ?? [])].map(fold));
  const candidates: Candidate[] = [];
  if (record.providerId === "gomariz") {
    let family = "";
    try { family = new URL(record.url).pathname.split("/").filter(Boolean)[2] ?? ""; } catch { family = ""; }
    if (attribute.name === "Capacidad de carga" && ["carretilla-industrial", "carretilla-retractil"].includes(family)) keys.add(fold("Capacidad"));
    if (attribute.name === "Capacidad de la cesta" && ["elevador-tijera", "brazo-articulado", "brazo-articulado-boom-lift", "brazo-telescopico", "oruga", "camion-plataforma"].includes(family)) keys.add(fold("Capacidad"));
    if (family === "fregadora" && attribute.name === "Ancho de trabajo") {
      keys.add(fold("Anchura limpieza"));
      keys.add(fold("Ancho de limpieza"));
    }
    if (family === "generador" && attribute.name === "Combustible") {
      const motor = String(record.specs?.Motor ?? "").trim();
      if (/^(?:Diésel|Diesel|Gasolina|Eléctrico|GLP)$/i.test(motor)) {
        candidates.push({ key: "Motor", value: motor });
      }
    }
  }
  if (record.providerId === "mercaeleva" && /\bcarretilla\b/i.test(record.title ?? "")) {
    if (attribute.name === "Altura de elevación") keys.add(fold("Altura máxima de elevación"));
    if (attribute.name === "Capacidad de carga") keys.add(fold("Capacidad máxima de elevación"));
  }
  if (record.providerId === "mercaeleva" && attribute.name === "Capacidad de carga") {
    const title = String(record.specs?.["Título adicional"] ?? record.title ?? "");
    if (/\bcarretilla\b/i.test(title)) {
      const load = title.match(/\b(\d{3,5}|\d{1,2}[.,]\d{3})\s*kg\b/i)?.[1];
      if (load) candidates.push({ key: "Capacidad de carga (kg)", value: `${load} kg` });
    }
  }
  for (const [rawKey, spec] of Object.entries(record.specs ?? {})) {
    const canonical = SPEC_KEY_NORMALIZATION[fold(rawKey)] ?? rawKey;
    if (!keys.has(fold(rawKey)) && !keys.has(fold(canonical))) continue;
    const value = scalar(spec);
    if (value !== null) candidates.push({ key: rawKey, value });
  }
  const extra: Readonly<Record<string, string | null>> = {
    "Marca": record.brand,
    "Modelo": record.model,
    "Año de fabricación": record.year,
    "Horas de uso": record.horometer,
    "Ubicación / Delegación": record.location
  };
  const direct = extra[attribute.name];
  if (direct?.trim()) candidates.push({ key: attribute.name, value: direct });
  if (candidates.length === 0) return null;
  const converted = candidates.map((candidate) => {
    if (record.providerId === "gomariz" && attribute.name === "Potencia" && attribute.type === "NUMBER" &&
      /\/venta\/energia-electrica-e-iluminacion\/generador\//.test(record.url) &&
      /kVA/i.test(attribute.unit_option) && typeof candidate.value === "string" &&
      /^\d+(?:[.,]\d+)?\s*kVA$/i.test(candidate.value.trim())) {
      return Number(candidate.value.trim().replace(/\s*kVA$/i, "").replace(",", "."));
    }
    return convert(candidate.value, candidate.key, attribute);
  });
  if (converted.some((value) => value === null)) return null;
  const first = converted[0];
  return converted.every((value) => value === first) ? first ?? null : null;
};
