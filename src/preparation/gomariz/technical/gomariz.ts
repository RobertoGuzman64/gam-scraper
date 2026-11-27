import type { ProductRecord, SpecsMap } from "../../../contracts/catalog.js";
import { resolveGomarizEditorialDomainSource } from "../domain-source.js";
import { verifiedEditorialUrl } from "../../editorial/source/editorial-source-url.js";
import { gomarizTechnicalSourceFamily } from "../classification/source-category.js";
import { scalar, numberToken } from "../../classification/attribute-utils.js";
import { reconcileOriginalMassCapacityPresentation } from "../../technical/technical-presentation.js";
import type { TechnicalRecoveryObservation } from "../../provenance/technical-recovery-observation.js";
import { parseMeasuredLength } from "../../../catalog/normalization/spec-parsers.js";
import { verifiedGomarizPlatformHeight } from "../../../catalog/normalization/gomariz/technical.js";

export const reconcileGomarizVerifiedPlatformHeight = (record: ProductRecord): ProductRecord => {
  try {
    const source = new URL(record.url);
    if (source.search || source.hash) return record;
  } catch {
    return record;
  }
  const height = verifiedGomarizPlatformHeight(record);
  if (height === null) return record;
  return {
    ...record,
    specs: { ...record.specs, "Altura plataforma": `${height.toLocaleString("es-ES", { maximumFractionDigits: 2 })} m` }
  };
};

export const reconcileGomarizVerifiedElectricSemanticSource = (record: ProductRecord): ProductRecord => {
  if (record.providerId !== "gomariz" || record.reference !== "BA1465" || record.categoryKey !== "venta" ||
    record.url !== "https://www.gomarizrent.com/venta/elevacion-y-trabajos-en-altura/brazo-articulado/lgmg-a14je-3/" ||
    record.brand !== "LGMG" || record.model !== "A14JE" || record.title !== "LGMG A14JE" ||
    record.specs?.Motor !== "Eléctrico" || record.specs["Altura de trabajo"] !== "15.8 m" ||
    record.specs["Altura plataforma"] !== "13.8 m" || record.specs.Capacidad !== "230 kg" ||
    record.longDescription !== "Las Articuladas Diésel son muy útil para trabajos en exterior ya que son capaces de moverse en casi cualquier terreno y superar pendientes con un desnivel notable. Capaces de alcanzar alturas de 12m a 43m.") return record;
  return { ...record, longDescription: "La plataforma articulada eléctrica LGMG A14JE alcanza 15,8 m de altura de trabajo y 13,8 m de altura de plataforma, con 7,81 m de alcance lateral y 230 kg de capacidad." };
};

export const reconcileGomarizVerifiedTowerModel = (record: ProductRecord): ProductRecord => {
  if (record.providerId !== "gomariz" || record.categoryKey !== "venta" ||
    record.condition !== "Segunda mano" || record.model?.trim() || !record.brand?.trim() ||
    record.specs?.Modelo !== undefined) return record;
  const url = verifiedEditorialUrl(record.url, ["www.gomarizrent.com", "gomarizrent.com"]);
  if (!url) return record;
  const path = url.pathname.split("/").filter(Boolean);
  if (!(path.length === 4 && path[0] === "venta" && path[1] === "energia-electrica-e-iluminacion" && path[2] === "torre-de-luz" ||
    path.length === 3 && path[0] === "energia-electrica-e-iluminacion" && path[1] === "torre-de-luz")) return record;
  const match = /^([\p{L}\d]+)\s+([\p{L}\d]+(?:-[\p{L}\d]+)+)$/iu.exec(record.title?.trim() ?? "");
  if (!match?.[1] || !match[2] ||
    match[1].localeCompare(record.brand, "es", { sensitivity: "base" }) !== 0) return record;
  const slug = (path[path.length - 1] ?? "").toLocaleLowerCase("es");
  const expected = `${match[1]}-${match[2]}`.toLocaleLowerCase("es");
  if (slug !== expected && !(slug.startsWith(`${expected}-`) && /^\d+$/u.test(slug.slice(expected.length + 1)))) return record;
  return { ...record, model: match[2] };
};

export const reconcileGomarizVerifiedCompositeBrand = (record: ProductRecord): ProductRecord => {
  if (record.providerId !== "gomariz" || record.categoryKey !== "venta" ||
    record.condition !== "Segunda mano" || !record.brand || !record.model ||
    record.specs?.Marca !== undefined) return record;
  const parts = record.brand.trim().split(/\s+/u);
  if (parts.length !== 2 || !parts.every((part) => /^[\p{L}\d]+$/u.test(part))) return record;
  const first = parts[0] ?? "";
  const second = parts[1] ?? "";
  const swapped = `${second} ${first}`;
  if ((record.title ?? "").trim().localeCompare(`${swapped} ${record.model}`, "es", { sensitivity: "base" }) !== 0) return record;
  const url = verifiedEditorialUrl(record.url, ["www.gomarizrent.com", "gomarizrent.com"]);
  if (!url) return record;
  const path = url.pathname.split("/").filter(Boolean);
  const expectedSlug = `${second}-${first}-${record.model.replace(/\s+/gu, "-")}`.toLocaleLowerCase("es");
  if (path.length !== 2 || path[0] !== "producto" || path[1]?.toLocaleLowerCase("es") !== expectedSlug) return record;
  return { ...record, brand: swapped };
};

export const gomarizMassCapacityField = (record: ProductRecord): "Capacidad de carga" | "Capacidad de la cesta" | "Capacidad máxima" | null => {
  const family = gomarizTechnicalSourceFamily(record);
  const raw = record.specs?.Capacidad;
  const capacity = raw === undefined ? null : scalar(raw);
  const mass = typeof capacity === "string" ? /^([\d., ]+)\s*kg$/iu.exec(capacity.trim()) : null;
  if (!family || !mass?.[1] || (numberToken(mass[1]) ?? 0) <= 0) return null;
  if (["carretilla-industrial", "carretilla-retractil", "carretilla-todoterreno"].includes(family)) return "Capacidad de carga";
  if (family === "manipulador-telescopico") return "Capacidad máxima";
  if (["elevador-tijera", "brazo-articulado", "brazo-articulado-boom-lift", "brazo-telescopico", "oruga", "camion-plataforma"].includes(family)) return "Capacidad de la cesta";
  return null;
};

export const reconcileGomarizMassCapacityPresentation = (original: ProductRecord, specs: SpecsMap,
  observe?: TechnicalRecoveryObservation): SpecsMap => {
  const field = gomarizMassCapacityField(original);
  if (field === null || field === "Capacidad máxima" && !resolveGomarizEditorialDomainSource(original)) return specs;
  return reconcileOriginalMassCapacityPresentation(original, specs, "Capacidad", field === "Capacidad máxima" ? "Capacidad máxima de elevación" : field,
    "src/preparation/gomariz/technical/gomariz.ts", observe);
};

export const gomarizWorkingHeightPresentation = {
  sourceField: "Altura", destinationField: "Altura de trabajo",
  mechanism: "src/preparation/gomariz/technical/gomariz.ts"
} as const;

const corroboratedGomarizWorkingHeight = (original: ProductRecord, specs: SpecsMap):
  { readonly nominal: number; readonly working: number } | null => {
  const family = gomarizTechnicalSourceFamily(original);
  if (!family || !["elevador-tijera", "brazo-articulado", "brazo-articulado-boom-lift", "brazo-telescopico",
    "elevador-mastil-vertical", "camion-plataforma", "oruga"].includes(family) ||
    !resolveGomarizEditorialDomainSource(original)) return null;
  const source = original.specs ?? {};
  const raw = source.Altura;
  if (typeof raw !== "string" || !/^\d+\s+metros?$/iu.test(raw.trim())) return null;
  const measure = (value: unknown): number | null => typeof value === "string" &&
    /^\d+(?:[.,]\d{1,2})?\s*(?:m|metros?)$/iu.test(value.trim()) ? parseMeasuredLength(value, "", "m") : null;
  const nominal = measure(raw);
  const working = measure(source["Altura de trabajo"]);
  const platform = measure(source["Altura plataforma"]);
  const stored = measure(source["Altura almacenaje"]);
  if (nominal === null || working === null || platform === null || stored === null ||
    stored <= 0 || platform < stored || platform >= working || nominal <= platform ||
    measure(specs.Altura) !== nominal || measure(specs["Altura de trabajo"]) !== working ||
    measure(specs["Altura de plataforma"]) !== platform || measure(specs["Altura almacenaje"]) !== stored) return null;
  return { nominal, working };
};

export const reconcileGomarizRedundantWorkingHeight = (original: ProductRecord, specs: SpecsMap,
  observe?: TechnicalRecoveryObservation): SpecsMap => {
  const heights = corroboratedGomarizWorkingHeight(original, specs);
  if (!heights || heights.nominal !== heights.working) return specs;
  const { [gomarizWorkingHeightPresentation.sourceField]: redundant, ...remaining } = specs;
  observe?.(specs, remaining, gomarizWorkingHeightPresentation.mechanism, { spec: gomarizWorkingHeightPresentation.sourceField });
  return remaining;
};

export const reconcileGomarizRoundedWorkingHeight = (original: ProductRecord, specs: SpecsMap,
  observe?: TechnicalRecoveryObservation): SpecsMap => {
  const destination = "Altura de trabajo redondeada";
  const heights = corroboratedGomarizWorkingHeight(original, specs);
  if (!heights || heights.nominal === heights.working || Math.abs(heights.nominal - heights.working) >= 0.5 ||
    Object.hasOwn(original.specs ?? {}, destination) || Object.hasOwn(specs, destination)) return specs;
  const { [gomarizWorkingHeightPresentation.sourceField]: value, ...remaining } = specs;
  if (value === undefined) return specs;
  const result = { ...remaining, [destination]: value };
  observe?.(specs, result, gomarizWorkingHeightPresentation.mechanism, { spec: gomarizWorkingHeightPresentation.sourceField });
  return result;
};
