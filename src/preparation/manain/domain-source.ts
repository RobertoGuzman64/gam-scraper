import type { ProductRecord, SpecValue } from "../../contracts/catalog.js";
import { manainConditionEvidence } from "./condition.js";
import { manainSourceFamily } from "./source.js";
import type { ManainFamily } from "./source.js";
import { editorialFamilyName, editorialFamilyOf } from "../editorial/core/editorial-families.js";
import { editorialQuantity, editorialQuantityOf, formatEditorialQuantity } from "../editorial/measurements/editorial-measurements.js";
import type { EditorialFamily } from "../editorial/core/editorial-families.js";
import type { EditorialSource } from "../editorial/core/editorial-source-contract.js";
import { verifiedEditorialUrl } from "../editorial/source/editorial-source-url.js";

const editorialFamilies: Partial<Record<ManainFamily, EditorialFamily>> = {
  "elevacion-tijera": "plataforma-tijera",
  "elevacion-brazo-articulado": "plataforma-articulada",
  "elevacion-brazo-telescopico": "plataforma-telescopica",
  "elevacion-camion-cesta": "camion-cesta",
  "elevacion-mastil": "plataforma-mastil",
  "elevacion-unipersonal": "plataforma-unipersonal",
  "movimiento-tierra-miniexcavadora": "miniexcavadora",
  "movimiento-tierra-minicargadora": "cargadora",
  "movimiento-tierra-dumper": "dumper",
  "movimiento-tierra-rodillo-compactador": "compactadora",
  "energia-grupo-electrogeno": "grupo-electrogeno",
  "manipulacion-carretilla": "carretilla-elevadora",
  "manipulacion-carretilla-4x4": "carretilla-elevadora",
  "manipulacion-manipulador": "manipulador-telescopico",
  "manipulacion-transpaletas": "transpaleta",
  "manipulacion-retractil": "carretilla-retractil",
  "manipulacion-apilador": "apilador",
  "pequena-maquinaria-radiales-electricas": "radial-electrica",
  "pequena-maquinaria-martillos-electricos": "martillo-electrico",
  "pequena-maquinaria-hidrolimpiadora": "hidrolimpiadora",
  "pequena-maquinaria-bomba-sumergible": "bomba-sumergible"
};

const slugOf = (value: string): string => value.normalize("NFD")
  .replace(/[\u0300-\u036f]/gu, "").toLocaleLowerCase("es")
  .replace(/[^a-z0-9]+/gu, "-").replace(/^-|-$/gu, "");

export const resolveManainEditorialDomainSource = (record: ProductRecord): EditorialSource | null => {
  if (record.providerId !== "manain" || record.categoryKey !== "venta" || !record.reference?.trim()) return null;
  const condition = manainConditionEvidence(record);
  if (!(record.condition === "Segunda mano" && condition.isUsed && !condition.isNew ||
    record.condition === "Nuevo" && condition.isNew && !condition.isUsed)) return null;
  const brand = record.brand?.trim();
  const recordedModel = record.model?.trim();
  const title = record.title?.trim();
  const repeatedModel = title && recordedModel === `${title}, ${title}`;
  const model = repeatedModel ? title : recordedModel;
  if (!brand || !model || !title || slugOf(title) !== slugOf(model) ||
    record.specs?.Marca !== brand || record.specs?.Modelo !== recordedModel) return null;
  const url = verifiedEditorialUrl(record.url, ["manain.com"]);
  if (!url) return null;
  const path = url.pathname.split("/").filter(Boolean);
  if (path.length !== 2 || path[0] !== "producto" || !/^(?:venta|venda)-/u.test(path[1] ?? "")) return null;
  const slug = path[1] ?? "";
  const brandSlugs = [slugOf(brand), ...(brand.includes("&") ? [slugOf(brand.replace(/&/gu, ""))] : [])];
  const modelSlug = slugOf(model);
  if (!modelSlug || brandSlugs.some((item) => !item)) return null;
  const matched = brandSlugs.some((brandSlug) =>
    new RegExp(`-${brandSlug}-${modelSlug}(?:-\\d+)?$`, "u").test(slug));
  if (!matched) return null;
  const family = manainSourceFamily(record);
  if ((family === "pequena-maquinaria-radiales-electricas" ||
    family === "pequena-maquinaria-martillos-electricos") && record.specs?.Motor !== "Eléctrico") return null;
  const compactingPlate = family === "pequena-maquinaria-compactacion" &&
    typeof record.specs?.["Ancho bandeja"] === "string" &&
    /^\d{2,4}\s*mm$/iu.test(record.specs["Ancho bandeja"].trim());
  const vibratingScreed = family === "pequena-maquinaria-compactacion" &&
    /^REGLA VIBRANTE\b/iu.test(title) &&
    typeof record.specs?.Peso === "string" && editorialQuantity(record.specs.Peso, "kg") !== null;
  const discDiameter = editorialQuantity(record.specs?.["Diametro max. disco"], "mm");
  const discWeight = editorialQuantity(record.specs?.Peso, "kg");
  const discCutter = family === "pequena-maquinaria-demolicion" &&
    record.specs?.Motor === "Eléctrico" && editorialFamilyOf(title) === null &&
    discDiameter !== null && discDiameter >= 150 && discDiameter <= 500 &&
    discWeight !== null && discWeight >= 20 && discWeight <= 300;
  const miniExcavatorHammer = family === "movimiento-tierra-martillo-miniex" &&
    typeof record.specs?.Maquina === "string" && /mini\s*excavadora/iu.test(record.specs.Maquina.trim()) &&
    typeof record.specs?.Enganche === "string" && !!record.specs.Enganche.trim();
  const editorialFamily = miniExcavatorHammer ? "martillo-miniexcavadora" :
    compactingPlate ? "compactadora" : vibratingScreed ? "regla-vibrante" :
      discCutter ? "equipo-corte-disco" :
      family ? editorialFamilies[family] : undefined;
  const telehandler = editorialFamily === "manipulador-telescopico";
  const height = record.specs?.["Altura de elevacion max"];
  const reach = record.specs?.["Alcance maximo"];
  const verifiedFamily = telehandler && (typeof height !== "string" || !height.trim() ||
    typeof reach !== "string" || !reach.trim()) ? undefined : editorialFamily;
  const familyClue = verifiedFamily === "plataforma-unipersonal" ? "elevacion unipersonal" :
    verifiedFamily === "martillo-electrico" ? "martillo electrico" :
    verifiedFamily ? editorialFamilyName(verifiedFamily) : null;
  return {
    brand, model,
    familyClues: familyClue ? `${familyClue} ${record.title}` :
      `${record.title} ${slug.replace(/-/gu, " ")}`,
    workingHeight: record.specs?.["Altura trabajo"],
    lateralReach: undefined,
    liftingHeight: undefined,
    liftingHeightUnit: "m",
    loadCapacity: undefined,
    equipmentHeight: undefined,
    motor: miniExcavatorHammer ? undefined : record.specs?.Motor
  };
};

export const manainHorizontalReach = (record: ProductRecord): number | null => {
  const family = manainSourceFamily(record);
  const telehandler = family === "manipulacion-manipulador";
  const boom = family === "elevacion-brazo-articulado" || family === "elevacion-brazo-telescopico" ||
    family === "elevacion-camion-cesta";
  if (!boom && !telehandler) return null;
  const reach = editorialQuantityOf(record.specs, telehandler ? ["Alcance maximo"] :
    ["Alcance horizontal max.", "Alcance horizontal"], "m");
  return reach !== null && reach >= 0.5 && reach <= 60 ? reach : null;
};

export const manainPublishedLoadAliases = (record: ProductRecord): readonly string[] =>
  record.providerId === "manain" ? ["Capacidad carga"] : [];

export const reconcileManainEditorialSourceSpecs = (record: ProductRecord): ProductRecord => {
  if (!resolveManainEditorialDomainSource(record)) return record;
  const family = manainSourceFamily(record);
  const additions: Record<string, SpecValue> = {};
  const absent = (keys: readonly string[]): boolean => keys.every((key) => record.specs?.[key] === undefined);
  if (family?.startsWith("elevacion-") || family?.startsWith("manipulacion-")) {
    const capacity = record.specs?.["Capacidad carga"];
    if (typeof capacity === "string" && editorialQuantity(capacity, "kg") !== null &&
      absent(["Capacidad de carga (kg)", "Capacidad de carga", "Capacidad"])) {
      additions["Capacidad de carga"] = capacity;
    }
  }
  const telehandler = family === "manipulacion-manipulador";
  if (absent(["Alcance lateral", "Alcance Lateral"])) {
    const reach = manainHorizontalReach(record);
    if (reach !== null) additions["Alcance Lateral"] = `${formatEditorialQuantity(reach)} m`;
  }
  const forklift = family === "manipulacion-carretilla" || family === "manipulacion-carretilla-4x4" ||
    family === "manipulacion-retractil";
  if ((forklift || telehandler) && absent(["Altura máxima de elevación", "Altura de elevación (mm)", "Altura de elevación (m)"])) {
    const height = editorialQuantity(record.specs?.[telehandler ? "Altura de elevacion max" : "Altura elevacion"],
      telehandler ? "m" : "mm");
    const metres = height === null ? null : telehandler ? height : height / 1000;
    if (metres !== null && metres >= 0.5 && metres <= 60) {
      additions["Altura de elevación (m)"] = `${formatEditorialQuantity(metres)} m`;
    }
  }
  if (forklift && absent(["Tipo Mástil", "Tipo de mástil"])) {
    const mast = record.specs?.["Tipo mastil"];
    if (typeof mast === "string" && /^(?:simplex?|d[uú]plex|tr[ií]plex)$/iu.test(mast.trim())) {
      additions["Tipo Mástil"] = mast;
    }
  }
  if (Object.keys(additions).length) return { ...record, specs: { ...record.specs, ...additions } };
  const smallElectricTool = family === "pequena-maquinaria-radiales-electricas" ||
    family === "pequena-maquinaria-martillos-electricos";
  if (!smallElectricTool || record.specs?.Motor !== "Eléctrico") return record;
  const weight = record.specs?.Peso;
  if (typeof weight !== "string") return record;
  const exact = /^(\d{1,3})\.(\d{4})\s*kg$/iu.exec(weight.trim());
  if (!exact?.[1] || !exact[2]) return record;
  const kilograms = Number(`${exact[1]}.${exact[2]}`);
  if (!Number.isFinite(kilograms) || kilograms < 2 || kilograms > 100) return record;
  return { ...record, specs: { ...record.specs, Peso: `${String(kilograms).replace(".", ",")} kg` } };
};
