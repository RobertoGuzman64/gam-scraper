import type { ProductRecord } from "../../../../../contracts/catalog.js";
import type { Attribute, Candidate } from "../../attribute-types.js";
import { fold, numberToken, scalar } from "../../attribute-utils.js";

type RatedPower = {
  readonly value: number;
  readonly unit: "kva" | "kwa";
  readonly regime: "emergencia" | "continuo" | null;
};

const ratedPowers = (text: string): RatedPower[] | null => {
  const values: RatedPower[] = [];
  for (const match of text.matchAll(/\b(\d[\d.,]*)\s*(kvas?|kwa)\b/gi)) {
    if (!match[1] || !match[2] || match.index === undefined) return null;
    const value = numberToken(match[1]);
    if (value === null || value <= 0) return null;
    const regime = text.slice(0, match.index).match(/\bpotencia\s+(emergencia|continuo)\s*:\s*$/i)?.[1]?.toLowerCase();
    values.push({
      value,
      unit: /^kvas?$/i.test(match[2]) ? "kva" : "kwa",
      regime: regime === "emergencia" || regime === "continuo" ? regime : null
    });
  }
  return values;
};

const compatibleRatedPowers = (powers: readonly RatedPower[], nominal: number): boolean => {
  const inconsistent = powers.filter((power) => power.value !== nominal);
  if (inconsistent.length === 0) return true;
  if (inconsistent.length !== 2 || inconsistent.some((power) => power.unit !== "kva")) return false;
  const emergency = inconsistent.find((power) => power.regime === "emergencia");
  const continuous = inconsistent.find((power) => power.regime === "continuo");
  return emergency !== undefined && continuous !== undefined && emergency.value > nominal && continuous.value < nominal;
};

export const isGamGenerator = (record: ProductRecord): boolean => {
  if (record.providerId !== "gam" || !["otros-nuevos", "energia"].includes(record.categoryKey) ||
    !/^Grupo electr[oó]geno\s/i.test(record.title ?? "")) return false;
  let section = "";
  try {
    const url = new URL(record.url);
    const path = url.pathname.split("/").filter(Boolean);
    if (url.hostname !== "online.gamrentals.com" || path[0] !== "es") return false;
    section = path[1] ?? "";
  } catch {
    return false;
  }
  if (/^grupos-electrogenos-|^generadores-electricos-segunda-mano$/.test(section)) return true;
  if (section !== "pramac" || record.categoryKey !== "otros-nuevos" || fold(record.brand ?? "") !== "pramac") return false;
  const title = record.title?.match(/^Grupo electr[oó]geno\s+(PRAMAC)\s+([a-z0-9-]+)\s+\d[\d.,]*\s*kVA\s*$/i);
  return !!title?.[2] && fold(title[2]) === fold(record.model ?? "") &&
    typeof record.specs?.["Marca"] === "string" && fold(record.specs["Marca"]) === "pramac" &&
    typeof record.specs?.["Modelo"] === "string" && fold(record.specs["Modelo"]) === fold(title[2]);
};

const unsupportedCommercialPowerTeaser = (record: ProductRecord): boolean => {
  if (record.condition !== "Nuevo" || fold(record.brand ?? "") !== "pramac" ||
    fold(String(record.specs?.["Marca"] ?? "")) !== "pramac" ||
    fold(String(record.specs?.["Modelo"] ?? "")) !== fold(record.model ?? "")) return false;
  const short = record.shortDescription?.trim() ?? "";
  const match = short.match(/^➨\s*PRAMAC\s+([A-Z0-9-]+)\s*➨\s*Venta de grupo electr[oó]geno nuevo\s+\d[\d.,]*\s+kWA\s+⭐Motor\s+[A-Z0-9-]+\s*➨\s*3 Fases$/i);
  return !!match?.[1] && fold(match[1]) === fold(record.model ?? "");
};

export const gamGeneratorCandidate = (record: ProductRecord, attribute: Attribute): Candidate | null => {
  if (!isGamGenerator(record) || attribute.name !== "Potencia" || attribute.type !== "NUMBER" ||
    attribute.unit_option !== "kVA (grupos) / kW") return null;
  const title = record.title?.match(/^Grupo electr[oó]geno\s+([a-z0-9-]+)\s+([a-z0-9.-]+)\s+(\d[\d.,]*)\s*kVA\s*$/i);
  if (!title?.[1] || !title[2] || !title[3] ||
    fold(title[1]) !== fold(record.brand ?? "") || fold(title[2]) !== fold(record.model ?? "")) return null;
  const power = numberToken(title[3]);
  if (power === null || power <= 0) return null;
  const short = unsupportedCommercialPowerTeaser(record) ? "" : record.shortDescription ?? "";
  const mentions = ratedPowers(`${short} ${record.longDescription ?? ""}`);
  if (mentions === null || !compatibleRatedPowers(mentions, power)) return null;
  for (const [key, value] of Object.entries(record.specs ?? {})) {
    if (!/\bpotencia\b/i.test(fold(key)) || /\bmotor\b/i.test(fold(key))) continue;
    const source = scalar(value);
    if (source === null || typeof source === "boolean") return null;
    const found = String(source).trim().match(/^(\d[\d.,]*)\s*(?:kvas?)?$/i);
    const parsed = found?.[1] ? numberToken(found[1]) : null;
    if (parsed !== power) return null;
  }
  return { key: attribute.name, value: power };
};
