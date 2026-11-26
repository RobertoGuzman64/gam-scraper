import type { ProductRecord } from "../../../contracts/catalog.js";
import type { Attribute, Candidate } from "../../classification/attribute-types.js";
import { fold, numberToken } from "../../classification/attribute-utils.js";
import { invalidGomarizPlatformHeight, verifiedGomarizPlatformHeight } from "../../../catalog/normalization/gomariz/technical.js";
import { editorialFamilyFromSourceGeneral } from "../../editorial/core/editorial-families.js";
import { verifiedEditorialUrl } from "../../editorial/source/editorial-source-url.js";
import { gomarizTechnicalSourceFamily } from "./source-category.js";
import { gomarizMassCapacityField } from "../technical/gomariz.js";
import { gomarizElevationCandidate } from "../technical/elevation.js";
import { gomarizIndustrialCandidate, gomarizTowerPower } from "../technical/industrial.js";

export const applyGomarizAliases = (record: ProductRecord, attribute: Attribute, keys: Set<string>, candidates: Candidate[]): boolean => {
  const elevation = gomarizElevationCandidate(record, attribute);
  if (elevation) candidates.push(elevation);
  const industrial = gomarizIndustrialCandidate(record, attribute);
  if (industrial) candidates.push(industrial);
  const family = gomarizTechnicalSourceFamily(record);
  if (attribute.type === "NUMBER" && attribute.unit_option === "kg" &&
    attribute.name === gomarizMassCapacityField(record)) keys.add(fold("Capacidad"));
  if (["Alcance horizontal", "Alcance máximo horizontal"].includes(attribute.name)) {
    const reach = record.specs?.["Alcance lateral"];
    if (typeof reach === "string" && /^\d+(?:[.,]\d{1,2})?\s*m$/i.test(reach.trim()) &&
      (numberToken(reach.trim().replace(/\s*m$/i, "")) ?? 0) > 0) {
      keys.add(fold("Alcance lateral"));
    }
  }
  if (family === "generador" && attribute.name === "Capacidad del depósito") keys.add(fold("Capacidad"));
  if (family && ["generador", "torre-de-luz"].includes(family) && attribute.name === "Combustible") {
    const motor = String(record.specs?.Motor ?? "").trim();
    if (/^(?:Diésel|Diesel|Gasolina|Eléctrico|GLP)$/i.test(motor)) {
      candidates.push({ key: "Motor", value: motor });
    }
  }
  return true;
};

const generatorPowerSource = (record: ProductRecord): boolean => {
  if (record.providerId !== "gomariz" || record.categoryKey !== "venta") return false;
  const url = verifiedEditorialUrl(record.url, ["www.gomarizrent.com", "gomarizrent.com"]);
  if (!url) return false;
  const path = url.pathname.split("/").filter(Boolean);
  return path.length === 4 && path[0] === "venta" &&
    path[1] === "energia-electrica-e-iluminacion" && path[2] === "generador" ||
    path.length === 3 && path[0] === "energia-electrica-e-iluminacion" && path[1] === "generador" ||
    path.length === 2 && path[0] === "producto" &&
    editorialFamilyFromSourceGeneral(record.longDescription) === "grupo-electrogeno";
};

export const excludeGomarizSpec = (record: ProductRecord, attribute: Attribute, rawKey: string): boolean =>
  attribute.name === "Ancho de trabajo" && ["anchura limpieza", "ancho de limpieza"].includes(fold(rawKey)) &&
  gomarizTechnicalSourceFamily(record) !== "fregadora";

export const convertGomarizCandidate = (
  record: ProductRecord, attribute: Attribute, candidate: Candidate, fallback: string | number | boolean | null
): string | number | boolean | null => {
  if (attribute.name === "Altura de plataforma" && candidate.key === "Altura plataforma" &&
    invalidGomarizPlatformHeight(record.url, record.specs ?? {})) return verifiedGomarizPlatformHeight(record);
  if (attribute.name === "Capacidad del depósito" &&
    ["Capacidad", "Capacidad del depósito"].includes(candidate.key) &&
    attribute.type === "NUMBER" && typeof candidate.value === "string") {
    const match = /^(\d[\d., ]*)\s*(?:l|litros?)$/i.exec(candidate.value.trim());
    if (!match?.[1]) return null;
    const value = numberToken(match[1]);
    return value !== null && value > 0 ? value : null;
  }
  if (attribute.name === "Potencia" && attribute.type === "NUMBER" &&
    /kVA/i.test(attribute.unit_option) && candidate.key === "Potencia" &&
    candidate.value === record.specs?.Potencia && typeof candidate.value === "string" && generatorPowerSource(record)) {
    const match = /^(\d+(?:[.,]\d+)?)\s*kVA$/iu.exec(candidate.value.trim());
    if (match?.[1]) {
      const value = Number(match[1].replace(",", "."));
      if (Number.isFinite(value) && value > 0) return value;
    }
  }
  return gomarizTowerPower(record, attribute, candidate) ?? fallback;
};
