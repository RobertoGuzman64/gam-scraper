import type { ProductRecord } from "../../../contracts/catalog.js";
import type { Attribute, Candidate } from "../../classification/attribute-types.js";
import { fold, scalar, numberToken } from "../../classification/attribute-utils.js";
import { invalidGomarizPlatformHeight, verifiedGomarizPlatformHeight } from "../../../catalog/normalization/gomariz/technical.js";
import { editorialFamilyFromSourceGeneral } from "../../editorial/core/editorial-families.js";
import { verifiedEditorialUrl } from "../../editorial/source/editorial-source-url.js";
import { gomarizElevationCandidate } from "../technical/elevation.js";
import { gomarizIndustrialCandidate, gomarizTowerPower } from "../technical/industrial.js";

export const applyGomarizAliases = (record: ProductRecord, attribute: Attribute, keys: Set<string>, candidates: Candidate[]): boolean => {
  const elevation = gomarizElevationCandidate(record, attribute);
  if (elevation) candidates.push(elevation);
  const industrial = gomarizIndustrialCandidate(record, attribute);
  if (industrial) candidates.push(industrial);
  let family = "";
  try { family = new URL(record.url).pathname.split("/").filter(Boolean)[2] ?? ""; } catch { family = ""; }
  if (attribute.name === "Capacidad de carga" && ["carretilla-industrial", "carretilla-retractil"].includes(family)) keys.add(fold("Capacidad"));
  if (family === "manipulador-telescopico" && attribute.name === "Capacidad máxima") {
    const raw = record.specs?.Capacidad;
    const capacity = raw === undefined ? null : scalar(raw);
    if (typeof capacity === "string" && /^\d[\d., ]*\s*kg$/i.test(capacity.trim())) {
      keys.add(fold("Capacidad"));
    }
  }
  if (attribute.name === "Capacidad de la cesta" && ["elevador-tijera", "brazo-articulado", "brazo-articulado-boom-lift", "brazo-telescopico", "oruga", "camion-plataforma"].includes(family)) keys.add(fold("Capacidad"));
  if (["Alcance horizontal", "Alcance máximo horizontal"].includes(attribute.name)) {
    const reach = record.specs?.["Alcance lateral"];
    if (typeof reach === "string" && /^\d+(?:[.,]\d{1,2})?\s*m$/i.test(reach.trim()) &&
      (numberToken(reach.trim().replace(/\s*m$/i, "")) ?? 0) > 0) {
      keys.add(fold("Alcance lateral"));
    }
  }
  if (family === "fregadora" && attribute.name === "Ancho de trabajo") {
    keys.add(fold("Anchura limpieza"));
    keys.add(fold("Ancho de limpieza"));
  }
  if (family === "generador" && attribute.name === "Capacidad del depósito") {
    try {
      const source = new URL(record.url);
      const path = source.pathname.split("/").filter(Boolean);
      if (source.protocol === "https:" && ["gomarizrent.com", "www.gomarizrent.com"].includes(source.hostname) &&
        path.length === 4 && path[0] === "venta" && path[1] === "energia-electrica-e-iluminacion") {
        keys.add(fold("Capacidad"));
      }
    } catch {
      family = "";
    }
  }
  if (["generador", "torre-de-luz"].includes(family) && attribute.name === "Combustible") {
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
