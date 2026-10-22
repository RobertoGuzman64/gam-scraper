import type { ProductRecord } from "../../../../../contracts/catalog.js";
import type { Attribute, Candidate } from "../../attribute-types.js";
import { fold } from "../../attribute-utils.js";

const earthworksFamilies = new Set(["dumper", "rodillo", "retroexcavadora"]);

const industryFamily = (record: ProductRecord): string | null => {
  if (record.providerId !== "gomariz") return null;
  try {
    const url = new URL(record.url);
    const path = url.pathname.split("/").filter(Boolean);
    if (!["gomarizrent.com", "www.gomarizrent.com"].includes(url.hostname) ||
      path.length !== 4 || path[0] !== "venta") return null;
    const family = path[2];
    if (!family) return null;
    if (path[1] === "manipulacion-de-materiales" &&
      ["carretilla-industrial", "carretilla-retractil", "manipulador-telescopico"].includes(family)) return family;
    if (path[1] === "limpieza" && family === "fregadora") return family;
    if (path[1] === "movimiento-de-tierras-demolicion-y-compactacion" &&
      earthworksFamilies.has(family)) return family;
    return null;
  } catch {
    return null;
  }
};

const towerFamily = (record: ProductRecord): boolean => {
  if (record.providerId !== "gomariz") return false;
  try {
    const url = new URL(record.url);
    const path = url.pathname.split("/").filter(Boolean);
    return ["gomarizrent.com", "www.gomarizrent.com"].includes(url.hostname) &&
      path.length === 4 && path[0] === "venta" &&
      path[1] === "energia-electrica-e-iluminacion" && path[2] === "torre-de-luz";
  } catch {
    return false;
  }
};

const towerLamps = (record: ProductRecord): { count: number; watts: number } | null => {
  if (!towerFamily(record)) return null;
  const raw = record.specs?.Potencia;
  if (typeof raw !== "string") return null;
  const match = /^(\d+)\s*[x×]\s*(\d+(?:[.,]\d+)?)\s*W$/i.exec(raw.trim());
  if (!match?.[1] || !match[2]) return null;
  const count = Number(match[1]);
  const watts = Number(match[2].replace(",", "."));
  if (!Number.isSafeInteger(count) || count <= 0 || !Number.isFinite(watts) || watts <= 0) return null;
  return { count, watts };
};

export const gomarizIndustrialCandidate = (record: ProductRecord, attribute: Attribute): Candidate | null => {
  if (attribute.name === "Modelo" && attribute.type === "TEXT" && towerFamily(record) &&
    !record.model?.trim() && record.brand?.trim()) {
    const match = /^(\S+)\s+([A-Z0-9]+(?:[-/][A-Z0-9]+)+)$/i.exec(record.title?.trim() ?? "");
    if (match?.[1] && match[2] && fold(match[1]) === fold(record.brand)) {
      return { key: "Título", value: match[2] };
    }
  }
  if (attribute.name === "Motorización / Energía" && attribute.type === "SELECT" &&
    fold(attribute.unit_option) === "electrico" && industryFamily(record)) {
    const motor = record.specs?.Motor;
    if (typeof motor !== "string" || fold(motor) !== "electrico") return null;
    const title = fold(record.title ?? "");
    if (/\b(?:diesel|gasolina|glp|hibrid[oa]|manual)\b/.test(title)) return null;
    for (const key of ["Tipo motor", "Tipo de motor", "Combustible"]) {
      const other = record.specs?.[key];
      if (other !== undefined && (typeof other !== "string" || fold(other) !== "electrico")) return null;
    }
    return { key: attribute.name, value: "Eléctrico" };
  }
  const lamps = towerLamps(record);
  if (!lamps) return null;
  if (attribute.name === "Nº y tipo de focos" && attribute.type === "TEXT" &&
    record.specs?.["Nº y tipo de focos"] === undefined) {
    return { key: "Potencia", value: `${lamps.count} focos (tipo no publicado)` };
  }
  return null;
};

export const gomarizTowerPower = (
  record: ProductRecord, attribute: Attribute, candidate: Candidate
): number | null => {
  if (attribute.name !== "Potencia" || attribute.type !== "NUMBER" ||
    !fold(attribute.unit_option).includes("kw") || candidate.key !== "Potencia") return null;
  const lamps = towerLamps(record);
  if (!lamps || candidate.value !== record.specs?.Potencia) return null;
  return lamps.count * lamps.watts / 1000;
};
