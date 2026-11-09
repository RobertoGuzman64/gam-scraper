import type { ProductRecord } from "../../../../contracts/catalog.js";
import { fold } from "../../../shared/classification/mapping/attribute-utils.js";

const sourceSection = (record: ProductRecord): string | null => {
  try {
    const url = new URL(record.url);
    const segments = url.pathname.split("/").filter(Boolean);
    return url.hostname === "online.gamrentals.com" && segments[0] === "es" && segments.length === 3
      ? segments[1] ?? null : null;
  } catch {
    return null;
  }
};

const hasPublishedModel = (record: ProductRecord): boolean =>
  !!record.model && typeof record.specs?.["Modelo"] === "string" &&
  fold(record.model) === fold(record.specs["Modelo"]);

const outdatedHeading = (record: ProductRecord): boolean =>
  /^plataformas? (?:elevadoras?|articuladas?)\b.*\bsegunda mano$/.test(fold(record.title ?? "")) &&
  !fold(record.title ?? "").includes(fold(record.model ?? ""));

const fromScrubber = (record: ProductRecord, section: string): string | null => {
  if (section !== "fregadoras-operario-sentado-tennant" || record.categoryKey !== "limpieza-fregadoras" ||
    record.brand || !record.shortDescription || !record.longDescription || !record.model) return null;
  const summary = record.shortDescription.match(/^➨\s*(Tennant)\s+([a-z0-9.-]+)\s+Nueva\s+➨\s+Venta fregadora conductor sentado\s*$/i);
  if (!summary?.[1] || !summary[2] || fold(summary[2]) !== fold(record.model) ||
    !new RegExp(`\\b${record.model.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i").test(record.longDescription) ||
    !/\bfregadora\b/i.test(record.longDescription) ||
    !record.url.toLowerCase().endsWith(`-tennant-${record.model.toLowerCase()}`)) return null;
  return `Fregadora conductor sentado ${summary[1]} ${summary[2]}`;
};

const fromForklift = (record: ProductRecord, section: string): string | null => {
  if (section !== "carretillas-elevadoras-diesel-hyster" || record.categoryKey !== "carretillas-nuevas" ||
    fold(record.brand ?? "") !== "hyster" || fold(String(record.specs?.["Marca"] ?? "")) !== "hyster" ||
    !record.model || !record.shortDescription || !record.longDescription) return null;
  const model = fold(record.model);
  const summary = fold(record.shortDescription);
  const description = fold(record.longDescription);
  const engine = fold(String(record.specs?.["Tipo motor"] ?? ""));
  return /^la carretilla hyster\b/.test(summary) && summary.includes(model) &&
    description.startsWith(`la hyster ${model} es una carretilla elevadora contrapesada`) &&
    /\bdisponible en versiones glp o diesel\b/.test(description) &&
    /\bdiesel\b/.test(engine) && /\bglp\b/.test(engine) &&
    fold(String(record.specs?.["Motorización"] ?? "")) === "diesel" &&
    fold(String(record.specs?.["Tipo máquina"] ?? "")) === "carretillas elevadoras diesel" &&
    record.url.toLowerCase().endsWith(`-hyster-${model.replace(/[^a-z0-9]/g, "")}`)
    ? `Carretilla elevadora ${record.brand} ${record.model}` : null;
};

export const reconcileGamOutdatedSourceTitle = (record: ProductRecord): ProductRecord => {
  if (record.providerId !== "gam" || record.condition !== "Nuevo" || !outdatedHeading(record) ||
    !hasPublishedModel(record)) return record;
  const section = sourceSection(record);
  if (!section) return record;
  const corrected = fromScrubber(record, section) ?? fromForklift(record, section);
  return corrected ? { ...record, title: corrected } : record;
};


export const reconcileGamVerifiedCapacityTitle = (
  source: ProductRecord, preparedTitle: string | null
): string | null => {
  if (source.providerId !== "gam" || !source.reference || !source.brand || !source.model ||
    !source.title || preparedTitle !== source.title ||
    source.specs?.Marca !== source.brand || source.specs?.Modelo !== source.model) return preparedTitle;

  if (source.reference === "1145" && source.categoryKey === "marcas-nuevas" &&
    source.condition === "Nuevo" && source.brand === "YALE" && source.model === "MPC14" &&
    source.url === "https://online.gamrentals.com/es/transpaletas-yale/1145-transporte-facil-de-cargas-de-hasta-14-toneladas-yale-mpc14" &&
    source.title === "Transpaleta YALE MPC14 2000Kg" &&
    source.shortDescription?.includes("Transporte fácil de cargas de hasta 1,4 toneladas") &&
    source.specs?.["Capacidad de carga (kg)"] === "1400 KG") {
    return "Transpaleta YALE MPC14 1400Kg";
  }

  if (source.reference === "6514" && source.categoryKey === "manutencion" &&
    source.condition === "Segunda mano" && source.brand === "HYSTER" && source.model === "H1.8FT" &&
    source.url === "https://online.gamrentals.com/es/carretillas-elevadoras-glp-segunda-mano/6514-2018-hyster-h18ft" &&
    source.title === "Carretilla elevadora GLP 1600 Kg HYSTER H1.8FT" &&
    source.specs?.["Nº de serie"] === "G001B03076S" &&
    source.specs?.["Capacidad de carga (kg)"] === "1800 KG" &&
    source.shortDescription?.includes("carretilla frontal GLP de 1800 kg") &&
    source.longDescription?.includes("capacidad de carga de 1800 kg")) {
    return "Carretilla elevadora GLP 1800 Kg HYSTER H1.8FT";
  }

  return preparedTitle;
};
