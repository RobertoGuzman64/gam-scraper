import type { ProductRecord } from "../../../../../contracts/catalog.js";
import type { Attribute, Candidate } from "../../attribute-types.js";
import { fold, scalar, numberToken } from "../../attribute-utils.js";
import { gomarizElevationCandidate } from "./elevation.js";
import { gomarizIndustrialCandidate, gomarizTowerPower } from "./industrial.js";

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
  if (["generador", "torre-de-luz"].includes(family) && attribute.name === "Combustible") {
    const motor = String(record.specs?.Motor ?? "").trim();
    if (/^(?:Diésel|Diesel|Gasolina|Eléctrico|GLP)$/i.test(motor)) {
      candidates.push({ key: "Motor", value: motor });
    }
  }
  return true;
};

export const convertGomarizCandidate = (
  record: ProductRecord, attribute: Attribute, candidate: Candidate, fallback: string | number | boolean | null
): string | number | boolean | null => {
  if (attribute.name === "Potencia" && attribute.type === "NUMBER" &&
    /\/venta\/energia-electrica-e-iluminacion\/generador\//.test(record.url) &&
    /kVA/i.test(attribute.unit_option) && typeof candidate.value === "string" &&
    /^\d+(?:[.,]\d+)?\s*kVA$/i.test(candidate.value.trim())) {
    return Number(candidate.value.trim().replace(/\s*kVA$/i, "").replace(",", "."));
  }
  return gomarizTowerPower(record, attribute, candidate) ?? fallback;
};
