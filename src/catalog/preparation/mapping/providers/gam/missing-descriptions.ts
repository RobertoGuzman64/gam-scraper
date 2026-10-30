import type { ProductRecord } from "../../../../../contracts/catalog.js";
import { fold, numberToken } from "../../attribute-utils.js";

type MissingGamDescriptions = {
  readonly short: string | null;
  readonly long: string | null;
};

const unavailable: MissingGamDescriptions = { short: null, long: null };

const sourceValue = (record: ProductRecord, key: string): string | null => {
  const value = record.specs?.[key];
  return typeof value === "string" && value.trim() ? value.trim() : null;
};

export const gamMissingDescriptions = (record: ProductRecord): MissingGamDescriptions => {
  if (record.providerId !== "gam" || record.categoryKey !== "carretillas-nuevas" ||
    record.condition !== "Nuevo" || record.shortDescription?.trim() || record.longDescription?.trim() ||
    fold(record.brand ?? "") !== "heli" || !record.model || !record.reference ||
    record.externalReference?.trim() !== record.model ||
    !/^CPQYD\d{2}-RC1H$/.test(record.model)) return unavailable;

  const title = fold(record.title ?? "");
  const titleMatch = /^grua horquilla glp(?: (\d[\d.,]*)\s*kg)? heli (cpqyd\d{2}-rc1h)$/.exec(title);
  if (!titleMatch || fold(record.model) !== titleMatch[2]) return unavailable;

  try {
    const url = new URL(record.url);
    const path = `/es/carretillas-elevadoras-glp-nuevas/${record.reference}-grua-horquilla-glp-heli-${record.model.toLowerCase()}`;
    if (url.protocol !== "https:" || url.hostname !== "online.gamrentals.com" ||
      url.pathname !== path || url.search || url.hash) return unavailable;
  } catch {
    return unavailable;
  }

  const expectedSpecs = ["Marca", "Modelo", "Tipo motor", "Capacidad de carga (kg)"];
  const specs = record.specs;
  if (!specs || Object.keys(specs).length !== expectedSpecs.length ||
    expectedSpecs.some((key) => !Object.hasOwn(specs, key)) ||
    fold(sourceValue(record, "Marca") ?? "") !== "heli" ||
    sourceValue(record, "Modelo") !== record.model ||
    fold(sourceValue(record, "Tipo motor") ?? "") !== "glp") return unavailable;

  const capacityMatch = /^(\d[\d., ]*)\s*kg$/i.exec(sourceValue(record, "Capacidad de carga (kg)") ?? "");
  const capacity = capacityMatch?.[1] ? numberToken(capacityMatch[1]) : null;
  if (capacity === null || !Number.isInteger(capacity) || capacity <= 0) return unavailable;
  if (titleMatch[1] && numberToken(titleMatch[1]) !== capacity) return unavailable;

  const load = String(capacity).replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  const machine = `grúa horquilla HELI ${record.model}`;
  return {
    short: `Nueva ${machine} con motor GLP y capacidad de carga de ${load} kg.`,
    long: `La ${machine} se ofrece como maquinaria nueva. Su ficha técnica especifica un motor GLP y una capacidad de carga de ${load} kg.`
  };
};
