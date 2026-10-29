import type { ProductRecord } from "../../../../../contracts/catalog.js";
import type { Attribute, Candidate } from "../../attribute-types.js";
import { fold, numberToken } from "../../attribute-utils.js";
import { manainSourceFamily } from "../../../evidence/providers/manain/source.js";

export const applyManainAliases = (record: ProductRecord, attribute: Attribute, keys: Set<string>, candidates: Candidate[]): void => {
  const family = manainSourceFamily(record);
  if (!family) return;
  if (attribute.name === "Elevación libre") keys.add(fold("Elevación libre (mm)"));
  if (attribute.name === "Altura de trabajo") keys.add(fold("Altura trabajo"));
  if (attribute.name === "Ancho de la máquina" && family === "movimiento-tierra-miniexcavadora") keys.add(fold("Ancho"));
  if (attribute.name === "Peso operativo" && family === "movimiento-tierra-miniexcavadora") keys.add(fold("Peso"));
  if (attribute.name === "Capacidad de la cesta" && family.startsWith("elevacion-")) keys.add(fold("Capacidad carga"));
  if (attribute.name === "Capacidad de carga" && !family.startsWith("elevacion-")) keys.add(fold("Capacidad carga"));
  if (attribute.name === "Capacidad del depósito" && family === "energia-grupo-electrogeno") keys.add(fold("Capacidad depósito"));
  const rawMotor = record.specs?.Motor;
  if (typeof rawMotor !== "string") return;
  const motor = fold(rawMotor);
  if (attribute.name === "Motorización / Energía" && motor === "electrico" && attribute.unit_option === "Eléctrico") {
    candidates.push({ key: "Motor", value: "Eléctrico" });
  }
  if (attribute.name === "Combustible" && family === "energia-grupo-electrogeno" &&
    ["diesel", "gasolina", "electrico", "glp"].includes(motor)) {
    const allowed = motor === "diesel" ? "Diésel" : motor === "electrico" ? "Eléctrico" : motor === "glp" ? "GLP" : "Gasolina";
    candidates.push({ key: "Motor", value: allowed });
  }
};

export const isManainUnmeasuredNumeric = (record: ProductRecord, attribute: Attribute, value: string | number | boolean): boolean => {
  if (record.providerId !== "manain" || typeof value !== "string" ||
    (attribute.type !== "NUMBER" && attribute.type !== "DECIMAL")) return false;
  const normalized = fold(value);
  if (attribute.name === "Elevación libre" && attribute.unit_option === "mm") {
    return normalized === "si";
  }
  return (attribute.name === "Peso" || attribute.name === "Peso operativo") && attribute.unit_option === "kg" &&
    normalized === "kg";
};

export const convertManainCandidate = (
  record: ProductRecord, attribute: Attribute, candidate: Candidate, fallback: string | number | boolean | null
): string | number | boolean | null => {
  if (record.providerId !== "manain" || typeof candidate.value !== "string") return fallback;
  if ((attribute.name === "Peso" || attribute.name === "Peso operativo") && attribute.unit_option === "kg" &&
    candidate.key === "Peso") {
    const found = /^(\d+)\.(\d{2})00\s*kg$/i.exec(candidate.value.trim());
    if (found?.[1] && found[2]) return numberToken(`${found[1]}.${found[2]}`);
  }
  if (!manainSourceFamily(record)) return fallback;
  if (attribute.name === "Horas de uso" && (candidate.key === "Horas" || candidate.key === "Horas de uso")) {
    const found = /^(\d+)\.0{4}$/.exec(candidate.value.trim());
    if (found?.[1]) return numberToken(found[1]);
  }
  if (manainSourceFamily(record) !== "energia-grupo-electrogeno") return fallback;
  if (attribute.name === "Potencia" && /kVA/.test(attribute.unit_option) && candidate.key === "Potencia") {
    const found = /^([\d., ]+)\s*kva(?:\s+kva)?$/i.exec(candidate.value.trim());
    return found?.[1] ? numberToken(found[1]) : fallback;
  }
  if (attribute.name === "Capacidad del depósito" && ["Capacidad depósito", "Capacidad del depósito"].includes(candidate.key)) {
    const found = /^([\d., ]+)\s*(?:l|litros?)$/i.exec(candidate.value.trim());
    return found?.[1] ? numberToken(found[1]) : fallback;
  }
  return fallback;
};
