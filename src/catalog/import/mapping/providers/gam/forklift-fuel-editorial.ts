import type { ProductRecord } from "../../../../../contracts/catalog.js";
import { fold } from "../../attribute-utils.js";

const sourceIdentity = (record: ProductRecord): string | null => {
  if (record.providerId !== "gam" || record.categoryKey !== "carretillas-nuevas" ||
    record.condition !== "Nuevo" || fold(record.brand ?? "") !== "hyster" ||
    fold(String(record.specs?.["Marca"] ?? "")) !== "hyster" || !record.model ||
    fold(String(record.specs?.["Modelo"] ?? "")) !== fold(record.model) ||
    !record.title || !record.shortDescription || !record.longDescription) return null;
  try {
    const url = new URL(record.url);
    const segments = url.pathname.split("/").filter(Boolean);
    const slug = segments[2] ?? "";
    const suffix = fold(record.model).replace(/[^a-z0-9]/g, "");
    if (url.hostname !== "online.gamrentals.com" || segments[0] !== "es" ||
      segments[1] !== "carretillas-elevadoras-diesel-hyster" || segments.length !== 3 ||
      !slug.startsWith(`${record.reference}-carretilla-elevadora-`) ||
      !slug.endsWith(`-hyster-${suffix}`)) return null;
  } catch {
    return null;
  }
  return fold(record.model);
};

export const reconcileGamForkliftFuelEditorial = (record: ProductRecord): ProductRecord => {
  const model = sourceIdentity(record);
  if (!model) return record;
  const title = fold(record.title ?? "");
  const short = fold(record.shortDescription ?? "");
  const long = fold(record.longDescription ?? "");
  const fuel = fold(String(record.specs?.["Tipo motor"] ?? ""));
  const drive = fold(String(record.specs?.["Motorización"] ?? ""));
  const summaryIdentity = short.startsWith(`➨ hyster ${model} nueva ➨ venta de carretilla elevadora `);
  if (!summaryIdentity) return record;
  if (fuel === "diesel" && (drive === "" || drive === "diesel") &&
    title === `carretilla elevadora glp hyster ${model}` &&
    short.includes("venta de carretilla elevadora diesel") && !short.includes("glp") &&
    long.startsWith(`la carretilla elevadora diesel hyster ${model} es`) &&
    long.includes("motor diesel") && !long.includes("glp")) {
    return { ...record, title: record.title?.replace(/\bGLP\b/i, "diésel") ?? record.title };
  }
  if (fuel === "glp" && (drive === "" || drive === "glp") &&
    title === `carretilla elevadora glp hyster ${model}` &&
    short.includes("venta de carretilla elevadora diesel") && !short.includes("glp") &&
    long.startsWith(`la carretilla elevadora glp hyster ${model} es`) &&
    long.includes("motor de glp") && !long.includes("diesel")) {
    return { ...record, shortDescription: record.shortDescription?.replace(/Carretilla Elevadora Diésel/i, "Carretilla Elevadora GLP") ?? record.shortDescription };
  }
  return record;
};
