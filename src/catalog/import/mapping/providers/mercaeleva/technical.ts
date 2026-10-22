import type { ProductRecord } from "../../../../../contracts/catalog.js";
import type { Attribute, Candidate } from "../../attribute-types.js";
import { fold } from "../../attribute-utils.js";

const publishedText = (record: ProductRecord, name: string): string => {
  const value = record.specs?.[name];
  return typeof value === "string" ? fold(value) : "";
};

const validSource = (record: ProductRecord): boolean => {
  if (record.providerId !== "mercaeleva") return false;
  try {
    const url = new URL(record.url);
    return url.hostname === "sales.mercaeleva.com" && /^\/(?:es|en)\/for-sale\/machine\/[^/]+\/?$/i.test(url.pathname);
  } catch {
    return false;
  }
};

const hasConflictingEnergy = (title: string, engine: string): boolean =>
  /\b(?:diesel|glp|gasolina|hibrid[oa]|manual)\b/.test(title) ||
  Boolean(engine && engine !== "electrico");

const electricEnergy = (record: ProductRecord): string | null => {
  const title = fold(record.title ?? "");
  const additional = publishedText(record, "Título adicional");
  const motor = publishedText(record, "Tipo de motor");
  if (hasConflictingEnergy(title, motor) || hasConflictingEnergy(additional, motor)) return null;
  if (motor === "electrico") return "Eléctrico";
  const battery = publishedText(record, "Tipo de Batería");
  if (!/^(?:li-ion|plomo-acido|gel)$/.test(battery)) return null;
  if (!/\b(?:carretilla|apilador|transpalet(?:a)?|plataforma)\b/.test(`${title} ${additional}`)) return null;
  if (!/\belectric[oa]s?\b|\bbateria\b/.test(`${title} ${additional}`) && battery !== "li-ion") return null;
  return "Eléctrico";
};

const positiveQuantity = (value: unknown, unit: "V" | "Ah"): number | null => {
  if (typeof value !== "string") return null;
  const match = new RegExp(`^(\\d+(?:[.,]\\d+)?)\\s*${unit}$`, "i").exec(value.trim());
  if (!match?.[1]) return null;
  const parsed = Number(match[1].replace(",", "."));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
};

const battery = (record: ProductRecord): string | null => {
  const voltage = positiveQuantity(record.specs?.["Voltaje de la batería"], "V");
  const capacity = positiveQuantity(record.specs?.["Capacidad de la batería"], "Ah");
  return voltage !== null && capacity !== null ? `${voltage} V / ${capacity} Ah` : null;
};

const operator = (record: ProductRecord, attribute: Attribute): string | null => {
  const declared = publishedText(record, "Posición del conductor");
  const title = fold(record.title ?? "");
  const additional = publishedText(record, "Título adicional");
  if (declared === "peatonal" && !/\b(?:conductor montado|operador montado)\b/.test(`${title} ${additional}`) &&
    /\bacompanante\b/.test(fold(attribute.unit_option))) return "Acompañante";
  if (declared === "plataforma" && !/\b(?:peatonal|conductor a pie)\b/.test(`${title} ${additional}`) &&
    /\bplataforma\b/.test(fold(attribute.unit_option))) return "Plataforma";
  return null;
};

const traction = (record: ProductRecord, attribute: Attribute): string | null => {
  if (!/\borugas\b/.test(fold(attribute.unit_option))) return null;
  const title = fold(record.title ?? "");
  const additional = publishedText(record, "Título adicional");
  if (/\bminiexcavadora\b/.test(title) && /\borugas?\b/.test(title) &&
    /\bminiexcavadora\b/.test(additional) && /\borugas?\b/.test(additional) &&
    !/\b(?:ruedas|neumaticos)\b/.test(`${title} ${additional}`)) return "Orugas";
  return null;
};

const mastNames: Readonly<Record<string, string>> = {
  "triple": "Tríplex",
  "triplex": "Tríplex",
  "duplex/estandar": "Dúplex",
  "duplex": "Dúplex",
  "simplex": "Simple",
  "simple": "Simple",
  "cuadruplex": "Cuádruplex"
};

export const normalizeMercaelevaCandidate = (
  attribute: Attribute, candidate: Candidate, fallback: string | number | boolean | null
): string | number | boolean | null => {
  if (attribute.name !== "Tipo de mástil" || attribute.type !== "SELECT") return fallback;
  if (typeof candidate.value !== "string") return null;
  const normalized = mastNames[fold(candidate.value)];
  return normalized && fold(attribute.unit_option).includes(fold(normalized)) ? normalized : null;
};

export const mercaelevaTechnicalCandidate = (record: ProductRecord, attribute: Attribute): Candidate | null => {
  if (!validSource(record)) return null;
  let value: string | number | boolean | null = null;
  if (attribute.name === "Motorización / Energía" && attribute.type === "SELECT" &&
    fold(attribute.unit_option) === "electrico") value = electricEnergy(record);
  if (attribute.name === "Batería (V / Ah)" && attribute.type === "TEXT") value = battery(record);
  if (attribute.name === "Posición del operario" && attribute.type === "SELECT") value = operator(record, attribute);
  if (attribute.name === "Cabina" && attribute.type === "SELECT" &&
    /\btecho protector\b/.test(fold(attribute.unit_option)) &&
    publishedText(record, "Tipo de cabina") === "guardia superior") value = "Techo protector";
  if (attribute.name === "Certificación / Marcado CE" && attribute.type === "BOOLEAN") {
    const certificate = publishedText(record, "Certificación CE");
    if (certificate === "yes") value = true;
    if (certificate === "no") value = false;
  }
  if (attribute.name === "Tipo de tracción" && attribute.type === "SELECT") value = traction(record, attribute);
  return value === null ? null : { key: attribute.name, value };
};
