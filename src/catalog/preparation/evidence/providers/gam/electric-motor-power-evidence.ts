import type { ProductRecord, SpecsMap } from "../../../../../contracts/catalog.js";
import { identifiedGamMachineModel } from "./measured-machine-specs.js";

const tractionPower = /\bmotor\s+de\s+tracci[oó]n\s*(?:el[eé]ctrico\s+|AC\s+|CA\s+|de\s+CA\s+|de\s+corriente\s+alterna\s+)?(?:de\s+)?(\d{1,2}(?:[.,]\d{1,2})?)\s*kW\b/giu;
const liftingPower = /\bmotor\s+de\s+elevaci[oó]n\s*(?:el[eé]ctrico\s+|AC\s+|CA\s+|de\s+CA\s+|de\s+corriente\s+alterna\s+)?(?:de\s+)?(\d{1,2}(?:[.,]\d{1,2})?)\s*kW\b/giu;

const normalizedIdentity = (value: string): string => value.toLowerCase().normalize("NFD")
  .replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, "");

const correctIdentity = (record: ProductRecord): boolean => {
  if (record.providerId !== "gam" || record.condition !== "Nuevo" ||
    !["carretillas-nuevas", "apiladores-nuevos", "otros-nuevos"].includes(record.categoryKey) ||
    !identifiedGamMachineModel(record)) return false;
  const brand = record.brand?.trim();
  if (!brand || typeof record.specs?.["Marca"] !== "string" ||
    normalizedIdentity(record.specs["Marca"]) !== normalizedIdentity(brand) ||
    !normalizedIdentity(record.title ?? "").includes(normalizedIdentity(brand)) ||
    !normalizedIdentity(record.longDescription ?? "").includes(normalizedIdentity(brand))) return false;
  try {
    const url = new URL(record.url);
    const path = url.pathname.split("/").filter(Boolean);
    return url.hostname === "online.gamrentals.com" && path[0] === "es" &&
      path[2]?.startsWith(`${record.reference}-`) === true &&
      normalizedIdentity(path[2]).includes(normalizedIdentity(record.model ?? ""));
  } catch {
    return false;
  }
};

const measuredPower = (description: string, pattern: RegExp): string | null => {
  const values = [...description.matchAll(pattern)].map((match) => Number((match[1] ?? "").replace(",", ".")));
  const first = values[0];
  if (first === undefined || !Number.isFinite(first) || first < 0.3 || first > 100 ||
    values.some((value) => value !== first)) return null;
  return `${String(first).replace(".", ",")} kW`;
};

export const recoverGamElectricMotorPowerSpecs = (record: ProductRecord): SpecsMap => {
  const source = record.specs ?? {};
  if (!correctIdentity(record) ||
    Object.keys(source).some((key) => /\bpotencia\b|motor\s+de\s+(?:tracci[oó]n|elevaci[oó]n)/iu.test(key))) return source;
  const description = record.longDescription ?? "";
  const traction = measuredPower(description, tractionPower);
  const lifting = measuredPower(description, liftingPower);
  if (traction === null && lifting === null) return source;
  return {
    ...source,
    ...(traction === null ? {} : { "Potencia de tracción (kW)": traction }),
    ...(lifting === null ? {} : { "Potencia de elevación (kW)": lifting })
  };
};
