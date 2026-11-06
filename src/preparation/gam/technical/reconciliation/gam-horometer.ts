import type { ProductRecord } from "../../../../contracts/catalog.js";

const unavailable = /^na(?:\s+[a-z]\d{8,20})?\s+horas$/iu;
const replaced = /^hor[oó]metro\s+sustituido\s+horas$/iu;

export const reconcileGamHorometer = (record: ProductRecord): ProductRecord => {
  if (record.providerId !== "gam") return record;
  const reading = record.horometer?.trim();
  if (!reading || (!unavailable.test(reading) && !replaced.test(reading))) return record;
  const current = record.specs?.["Horómetro"];
  if (current !== undefined && (typeof current !== "string" || current.trim() !== reading)) return record;
  const specs = { ...record.specs };
  if (unavailable.test(reading)) delete specs["Horómetro"];
  else specs["Horómetro"] = "Horómetro sustituido";
  return { ...record, horometer: null, specs };
};
