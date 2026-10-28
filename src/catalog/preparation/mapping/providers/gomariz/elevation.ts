import type { ProductRecord } from "../../../../../contracts/catalog.js";
import type { Attribute, Candidate } from "../../attribute-types.js";
import { fold } from "../../attribute-utils.js";

const platformFamilies = new Set([
  "elevador-tijera", "brazo-articulado", "brazo-articulado-boom-lift", "brazo-telescopico",
  "oruga", "camion-plataforma", "elevador-mastil-vertical"
]);

const platformFamily = (record: ProductRecord): string | null => {
  if (record.providerId !== "gomariz") return null;
  try {
    const url = new URL(record.url);
    const path = url.pathname.split("/").filter(Boolean);
    const family = path[2];
    if (!["gomarizrent.com", "www.gomarizrent.com"].includes(url.hostname) ||
      path[0] !== "venta" || path[1] !== "elevacion-y-trabajos-en-altura" ||
      path.length !== 4 || !family || !platformFamilies.has(family)) return null;
    return family;
  } catch {
    return null;
  }
};

const electricMotor = (record: ProductRecord, family: string): string | null => {
  if (family === "camion-plataforma") return null;
  const motor = record.specs?.Motor;
  if (typeof motor !== "string" || fold(motor) !== "electrico") return null;
  const title = fold(record.title ?? "");
  if (/\b(?:diesel|gasolina|glp|hibrid[oa]|manual)\b/.test(title)) return null;
  for (const key of ["Tipo motor", "Tipo de motor", "Combustible"]) {
    const other = record.specs?.[key];
    if (other !== undefined && (typeof other !== "string" || fold(other) !== "electrico")) return null;
  }
  return "Eléctrico";
};

const traction = (record: ProductRecord, family: string): string | null => {
  const title = fold(record.title ?? "");
  const description = fold(record.longDescription ?? "");
  if (family === "oruga" && /\borugas\b/.test(description) && !/\b(?:ruedas|camion)\b/.test(`${title} ${description}`)) {
    return "Orugas";
  }
  if (family === "camion-plataforma" && /\bcamiones? cesta\b/.test(description) &&
    /\b(?:iveco|camion)\b/.test(title) && !/\borugas\b/.test(`${title} ${description}`)) {
    return "Sobre camión";
  }
  return null;
};

export const gomarizElevationCandidate = (record: ProductRecord, attribute: Attribute): Candidate | null => {
  const family = platformFamily(record);
  if (!family || attribute.type !== "SELECT") return null;
  let value: string | null = null;
  if (attribute.name === "Motorización / Energía" && fold(attribute.unit_option) === "electrico") {
    value = electricMotor(record, family);
  }
  if (attribute.name === "Tipo de tracción") {
    value = traction(record, family);
    if (value && !fold(attribute.unit_option).includes(fold(value))) return null;
  }
  return value === null ? null : { key: attribute.name, value };
};
