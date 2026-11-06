import type { ProductRecord, SpecsMap } from "../../../../../contracts/catalog.js";
import { gamExplicitHorizontalReach } from "../../mapping/elevation.js";
import { identifiedGamMachineModel } from "./measured-machine-specs.js";

const lateralReach = /\balcance\s+lateral\s*(?:(?:m[aá]ximo\s*)?(?:de\s+)?(?:hasta\s+)?(\d{1,2}(?:[.,]\d{1,2})?)\s*(m|metros?)\b|\(\s*(?:hasta\s+)?(\d{1,2}(?:[.,]\d{1,2})?)\s*(m|metros?)\s*\))/giu;
const basketCapacity = /\bcapacidad\s+de\s+la\s+cesta\s+(\d{2,4})\s*kg\b/iu;
const normalize = (value: string): string => value.toLowerCase().normalize("NFD")
  .replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, "");

const identifiedCteVariant = (record: ProductRecord): boolean => {
  if (record.providerId !== "gam" || record.condition !== "Nuevo" ||
    record.categoryKey !== "elevacion-nueva" || record.brand !== "CTE" ||
    record.specs?.["Marca"] !== "CTE" || !identifiedGamMachineModel(record)) return false;
  const model = normalize(record.model ?? "");
  if (!model || ![record.title, record.shortDescription, record.longDescription]
    .every((text) => normalize(text ?? "").includes(model))) return false;
  const originalCapacity = record.specs?.["Capacidad de carga (kg)"];
  const shortCapacity = (record.shortDescription ?? "").match(basketCapacity)?.[1];
  if (typeof originalCapacity !== "string" || !shortCapacity ||
    Number(originalCapacity.replace(/\s*kg\s*$/iu, "").trim()) !== Number(shortCapacity)) return false;
  try {
    const url = new URL(record.url);
    const parts = url.pathname.split("/").filter(Boolean);
    return url.hostname === "online.gamrentals.com" && !url.search && !url.hash &&
      parts.length === 3 && parts[0] === "es" &&
      parts[2]?.startsWith(`${record.reference}-`) === true &&
      normalize(parts[2]).includes(model);
  } catch {
    return false;
  }
};

const verifiedLateralReach = (record: ProductRecord): number | null => {
  if (!identifiedCteVariant(record)) return null;
  const text = record.longDescription ?? "";
  const matches = [...text.matchAll(lateralReach)];
  if (matches.length === 0 || matches.some((match) =>
    /^(?:\s*[,/]\s*|\s+(?:o|u|y|hasta)\s+)\d/iu.test(text.slice(match.index + match[0].length)))) return null;
  const values = matches.map((match) => Number((match[1] ?? match[3] ?? "").replace(",", ".")));
  const value = values[0];
  return value !== undefined && Number.isFinite(value) && value >= 2 && value <= 40 &&
    values.every((other) => other === value) ? value : null;
};

export const recoverGamExplicitHorizontalReachSpec = (record: ProductRecord): SpecsMap => {
  const source = record.specs ?? {};
  if (record.providerId !== "gam" || record.categoryKey !== "elevacion-nueva" ||
    Object.keys(source).some((key) => /\balcance\b/iu.test(key))) return source;

  const horizontal = gamExplicitHorizontalReach(record);
  const lateral = verifiedLateralReach(record);
  if (horizontal !== null && lateral !== null && horizontal !== lateral) return source;
  const reach = horizontal ?? lateral;
  if (reach === null) return source;

  return { ...source, "Alcance horizontal (m)": `${reach.toString().replace(".", ",")} m` };
};
