import type { ProductRecord, SpecsMap } from "../../../../../../contracts/catalog.js";
import { identifiedGamMachineModel } from "../measurements-and-capacities/measured-machine-specs.js";
import { verifiedGamElectricalIdentity } from "../identity/electrical-identity-evidence.js";

const normalize = (value: string): string => value.toLowerCase().normalize("NFD")
  .replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, "");

const lithiumBattery = /\bbater[ií]as?\s+(?:(?:integrada|extra[ií]ble)s?\s+de\s+)?(?:de\s+)?(?:ion(?:es)?\s+de\s+)?litio\b/iu;
const alternativeChemistry = /\b(?:plomo[\s-]?[aá]cido|bater[ií]as?\s+de\s+(?:gel|n[ií]quel|sodio)|ni-?mh|agm)\b/iu;
const optionalLithium = /\b(?:opci[oó]n\s+de|opcionalmente\s+con|puede\s+equiparse\s+con|posibilidad\s+de\s+elegir\s+entre|disponible\s+con)\s+(?:\w+\s+){0,4}bater[ií]as?\s+(?:de\s+)?(?:de\s+)?(?:ion(?:es)?\s+de\s+)?litio\b/iu;
const deniedLithium = /\b(?:no\s+(?:incorpora|lleva|incluye|utiliza)|sin)\s+(?:una\s+)?bater[ií]a\s+(?:de\s+)?(?:ion(?:es)?\s+de\s+)?litio\b/iu;
const batteryKey = /^(?:bater[ií]as?|acumuladores?|tipo\s+de\s+bater[ií]a|qu[ií]mica\s+de\s+bater[ií]a)$/iu;

const identifiedExtendedBatteryProduct = (record: ProductRecord): boolean =>
  record.condition === "Nuevo" && verifiedGamElectricalIdentity(record) && (
    record.categoryKey === "carretillas-nuevas" && normalize(record.brand ?? "") === "yale" &&
      /\sL$/iu.test(record.model ?? "") ||
    record.categoryKey === "otros-nuevos" && normalize(record.brand ?? "") === "blyyd" ||
    record.categoryKey === "marcas-nuevas" && ["firstgreen", "yale"].includes(normalize(record.brand ?? ""))
  );

const identifiedBatteryProduct = (record: ProductRecord): boolean => {
  if (record.providerId !== "gam" || !identifiedGamMachineModel(record)) return false;
  const allowed = record.categoryKey === "maquinaria" && record.condition === "Segunda mano" &&
      ["lvneng", "urban"].includes(normalize(record.brand ?? "")) ||
    record.condition === "Nuevo" && (
      ["carretillas-nuevas", "apiladores-nuevos"].includes(record.categoryKey) && normalize(record.brand ?? "") === "hyster" ||
      record.categoryKey === "elevacion-nueva" && normalize(record.brand ?? "") === "xcmg" ||
    identifiedExtendedBatteryProduct(record)
    );
  if (!allowed || !record.brand || normalize(String(record.specs?.["Marca"] ?? "")) !== normalize(record.brand)) return false;
  if (![record.title, record.longDescription].every((part) =>
    normalize(part ?? "").includes(normalize(record.brand ?? "")))) return false;
  try {
    const url = new URL(record.url);
    const parts = url.pathname.split("/").filter(Boolean);
    return url.hostname === "online.gamrentals.com" && !url.search && !url.hash &&
      parts.length === 3 && parts[0] === "es" && parts[2]?.startsWith(`${record.reference}-`) === true &&
      normalize(parts[2]).includes(normalize(record.model ?? ""));
  } catch {
    return false;
  }
};

export const recoverGamLithiumBatteryType = (record: ProductRecord): SpecsMap => {
  const source = record.specs ?? {};
  const description = record.longDescription ?? "";
  if (!identifiedBatteryProduct(record) || Object.keys(source).some((key) => batteryKey.test(key)) ||
    !lithiumBattery.test(description) ||
    alternativeChemistry.test(description) || optionalLithium.test(description) ||
    deniedLithium.test(description) || /\bbater[ií]a\s+de\s+litio\s+(?:opcional|como\s+opci[oó]n)\b/iu.test(description)) return source;
  return { ...source, "Tipo de batería": "Litio" };
};


const isVerifiedUsedElectricMobility = (record: ProductRecord): boolean => {
  if (record.providerId !== "gam" || record.categoryKey !== "maquinaria" ||
    record.condition !== "Segunda mano" || !record.reference) return false;
  if (record.reference === "6805") {
    return record.title === "LVNENG LX05" && record.brand === null && record.model === null &&
      record.url === "https://online.gamrentals.com/es/ciclomotores-electricos-segunda-mano/6805-lvneng-lx05" &&
      normalize(record.shortDescription ?? "").includes("lvnenglx05") &&
      normalize(record.longDescription ?? "").includes("lvnenglx05");
  }
  if (!identifiedGamMachineModel(record) || !record.brand || !record.model ||
    !["littium", "silence", "paxster"].includes(normalize(record.brand)) ||
    normalize(String(record.specs?.["Marca"] ?? "")) !== normalize(record.brand) ||
    normalize(String(record.specs?.["Modelo"] ?? "")) !== normalize(record.model) ||
    ![record.title, record.shortDescription, record.longDescription].every((text) =>
      normalize(text ?? "").includes(normalize(record.brand ?? "")) &&
      normalize(text ?? "").includes(normalize(record.model ?? "")))) return false;
  try {
    const url = new URL(record.url);
    const parts = url.pathname.split("/").filter(Boolean);
    return url.hostname === "online.gamrentals.com" && !url.search && !url.hash &&
      parts.length === 3 && parts[0] === "es" && parts[2]?.startsWith(`${record.reference}-`) === true &&
      normalize(parts[2]).includes(normalize(record.model));
  } catch {
    return false;
  }
};

const verifiedLithiumWithoutAlternative = (record: ProductRecord): boolean => {
  const text = record.longDescription ?? "";
  if (!lithiumBattery.test(text) || optionalLithium.test(text) || deniedLithium.test(text)) return false;
  if (isVerifiedUsedElectricMobility(record)) return !alternativeChemistry.test(text);
  if (record.providerId === "gam" && record.categoryKey === "marcas-nuevas" &&
    record.condition === "Nuevo" && record.reference === "915" && record.brand === "YALE" &&
    record.model === "MPC15" && record.specs?.["Marca"] === "YALE" && record.specs?.["Modelo"] === "MPC15" &&
    record.url === "https://online.gamrentals.com/es/transpaletas-yale/915-transpaleta-propulsada-con-ion-de-litio" &&
    [record.title, record.shortDescription, text].every((part) => normalize(part ?? "").includes("yale") &&
      normalize(part ?? "").includes("mpc15"))) return !alternativeChemistry.test(text);
  if (record.providerId === "gam" && record.reference === "2037" &&
    verifiedGamElectricalIdentity(record) && record.categoryKey === "carretillas-nuevas" &&
    record.brand === "HYSTER" && record.model === "J2.5XNL" &&
    /\bbater[ií]a de iones de litio integrada\b/iu.test(text) &&
    /\bmayor vida [uú]til que las de plomo-[aá]cido\b/iu.test(text)) {
    return !alternativeChemistry.test(text.replace(/\bmayor vida [uú]til que las de plomo-[aá]cido\b/giu, ""));
  }
  return false;
};

export const recoverGamVerifiedMobilityBatteryType = (record: ProductRecord): SpecsMap => {
  const source = record.specs ?? {};
  if (Object.keys(source).some((key) => batteryKey.test(key)) || !verifiedLithiumWithoutAlternative(record)) return source;
  return { ...source, "Tipo de batería": "Litio" };
};
