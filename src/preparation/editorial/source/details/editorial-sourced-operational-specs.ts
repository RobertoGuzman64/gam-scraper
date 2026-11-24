import type { ProductRecord } from "../../../../contracts/catalog.js";
import { editorialFamilyOf } from "../../core/editorial-families.js";
import { resolveSourcedEquipmentDetails } from "./editorial-sourced-equipment-details.js";
import { editorialMetricOf, editorialQuantity, editorialQuantityOf, formatEditorialQuantity } from "../../measurements/editorial-measurements.js";
import { sameEditorialUnit, verifiedEditorialIdentity } from "../../core/editorial-source-contract.js";
import { containsEditorialBrandModel, containsEditorialIdentity } from "../../identity/editorial-identity-match.js";
import { verifiedEditorialUnitPair } from "../../identity/editorial-unit-provenance.js";
import { containsEditorialSourceSlugModel } from "../editorial-source-url.js";

const matchingSpecs = (source: ProductRecord, prepared: ProductRecord, key: string): string | null => {
  const value = source.specs?.[key];
  return typeof value === "string" && value.trim() && value === prepared.specs?.[key] ? value.trim() : null;
};

const batteryContext = (source: ProductRecord, prepared: ProductRecord, general: string): string | null => {
  if (!verifiedEditorialIdentity(source) || !verifiedEditorialIdentity(prepared) ||
    !source.model || !source.title?.toLocaleLowerCase("es").includes(source.model.toLocaleLowerCase("es")) ||
    !["transpaleta", "apilador"].includes(editorialFamilyOf(general) ?? "") ||
    /\bbater[ií]as?\b/iu.test(general)) return null;
  const value = matchingSpecs(source, prepared, "Capacidad de la batería");
  if (!value) return null;
  const alternatives = /^24\s*V\s*\/\s*(\d{2,3})\s*-\s*(\d{2,3})\s*Ah\s*\|\s*Li-ion\s*24\s*V\s*\/\s*(\d{2,3})\s*Ah\s*\(V\/Ah\)$/iu.exec(value);
  if (alternatives?.[1] && alternatives[2] && alternatives[3]) {
    const [from, to, lithium] = [Number(alternatives[1]), Number(alternatives[2]), Number(alternatives[3])];
    if (from < 100 || from > to || to > 800 || lithium < 100 || lithium > 800) return null;
    return `La tabla técnica de la misma referencia enumera configuraciones de batería de 24 V con capacidades entre ${from} y ${to} Ah y alternativa de ion-litio de ${lithium} Ah. Son opciones declaradas por el fabricante; la batería instalada debe comprobarse para la unidad ofertada.`;
  }
  const standard = /^24\s*V\s*\/\s*(\d{2,3})\s*Ah\s*\(V\/Ah\)$/iu.exec(value);
  if (standard?.[1]) {
    const capacity = Number(standard[1]);
    if (capacity < 100 || capacity > 800) return null;
    return `El campo de batería de esta referencia consigna 24 V y ${capacity} Ah. Es un dato del catálogo técnico, no una comprobación del estado ni de la configuración de la batería de la unidad entregada.`;
  }
  return null;
};

const towerContext = (source: ProductRecord, prepared: ProductRecord, general: string): string | null => {
  if (editorialFamilyOf(general) !== "torre-iluminacion" ||
    !source.brand || !source.title || !prepared.title ||
    !source.title.toLocaleLowerCase("es").includes(source.brand.toLocaleLowerCase("es")) ||
    !general.toLocaleLowerCase("es").includes(source.brand.toLocaleLowerCase("es")) ||
    source.specs?.Motor !== prepared.specs?.Motor ||
    /\b(?:potencia\s+de\s+las\s+luminarias|altura\s+de\s+trabajo\s+de)\b/iu.test(general)) return null;
  const rawHeight = matchingSpecs(source, prepared, "Altura de trabajo");
  const rawPower = matchingSpecs(source, prepared, "Potencia");
  if (!rawHeight || !rawPower) return null;
  const height = editorialMetricOf(source.specs, ["Altura de trabajo"]);
  const heightPrepared = editorialMetricOf(prepared.specs, ["Altura de trabajo"]);
  const power = /^([1-9]|1[0-2])\s*[x×]\s*(\d{2,3})\s*W$/iu.exec(rawPower);
  if (height === null || height !== heightPrepared || height < 3 || height > 30 || !power?.[1] || !power[2] ||
    Number(power[2]) < 50 || Number(power[2]) > 999) return null;
  return `En la tabla técnica de esta misma referencia figuran altura de trabajo de ${formatEditorialQuantity(height)} m y potencia de las luminarias indicada como ${Number(power[1])} × ${Number(power[2])} W. Son magnitudes declaradas, no una estimación del área iluminada ni una certificación de los accesorios entregados.`;
};

const transportContext = (source: ProductRecord, prepared: ProductRecord, general: string): string | null => {
  if (!/\b(?:semir?remolque|platafora\s+4\s+ejes|plataforma\s+4\s+ejes)\b/iu.test(source.title ?? "") ||
    !source.longDescription?.trim().startsWith("·") || !general.includes(source.longDescription.trim()) ||
    source.shortDescription?.trim() !== source.title?.trim() ||
    !/\b(?:ITV|matriculad[oa])\b/iu.test(source.longDescription) ||
    source.specs?.Matrícula !== prepared.specs?.Matrícula ||
    source.year !== prepared.year ||
    ["Longitud", "Anchura", "Altura", "Peso", "Año de fabricación"].some((key) =>
      source.specs?.[key] !== prepared.specs?.[key]) ||
    typeof source.specs?.Matrícula !== "string" || !/^[A-Z0-9-]{5,20}$/iu.test(source.specs.Matrícula)) return null;
  const dimensions = ["Longitud", "Anchura", "Altura"].flatMap((key) => {
    if (source.specs?.[key] !== prepared.specs?.[key]) return [];
    const value = editorialMetricOf(source.specs, [key]);
    return value !== null && value > 0.5 && value < 30 ?
      [`${key.toLocaleLowerCase("es")} de ${formatEditorialQuantity(value)} m`] : [];
  });
  const mass = source.specs?.Peso === prepared.specs?.Peso ?
    editorialQuantityOf(source.specs, ["Peso"], "kg") : null;
  const year = source.year === prepared.year && typeof source.year === "string" &&
    /^(?:19[5-9]\d|20[0-2]\d|2030)$/u.test(source.year) ? source.year : null;
  if (dimensions.length < 2 && year === null) return null;
  const measured = [...dimensions, ...(mass !== null ? [`peso declarado de ${formatEditorialQuantity(mass)} kg`] : [])];
  const technical = measured.length ? `La tabla técnica de la misma unidad indica ${measured.join(", ")}. ` : "";
  const registration = `El anuncio registra matrícula ${source.specs.Matrícula}${year !== null ? ` y fabricación en ${year}` : ""}. `;
  const inspection = /\bITV\b/iu.test(source.longDescription) ?
    "La referencia del vendedor a la ITV requiere comprobar su vigencia con la documentación actual del vehículo." :
    "Los trabajos indicados en el anuncio corresponden al historial declarado por el vendedor, pendiente de comprobación documental.";
  return `${technical}${registration}${inspection}`;
};

const reachStackerContext = (source: ProductRecord, prepared: ProductRecord, general: string): string | null => {
  const brand = source.brand?.trim();
  const model = source.model?.trim();
  const summary = source.shortDescription?.trim();
  const original = source.longDescription?.trim();
  const family = /\breach\s*stacker\b/iu;
  const normalizeSpace = (value: string): string => value.trim().replace(/\s+/gu, " ");
  if (!brand || !model || !summary || !original || !verifiedEditorialUnitPair(source, prepared) ||
    source.shortDescription !== prepared.shortDescription ||
    source.longDescription !== prepared.longDescription ||
    !family.test(source.title ?? "") || !family.test(prepared.title ?? "") || !family.test(summary) ||
    !containsEditorialBrandModel(summary, brand, model) || containsEditorialIdentity(general, model) ||
    !containsEditorialIdentity(original, brand) ||
    !/\b(?:reach\s*stackers?|apilador(?:es)?\s+telesc[oó]pic[oa]s?|manipulaci[oó]n\s+de\s+contenedores)\b/iu.test(original) ||
    normalizeSpace(general) !== normalizeSpace(original) ||
    !containsEditorialSourceSlugModel(new URL(source.url).pathname.split("/").filter(Boolean).at(-1) ?? "", model, source.specs?.Motor)) return null;
  const escapedBrand = brand.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
  const modelMention = new RegExp(`\\b${escapedBrand}\\s+[\\p{L}\\d./-]*\\d[\\p{L}\\d./-]*`, "iu");
  if (modelMention.test(original) || /\b(?:modelo|variante)\s+[\p{L}\d./-]*\d[\p{L}\d./-]*/iu.test(original) ||
    /\b(?:capacidad\s+(?:nominal|de\s+carga)|altura\s+de\s+elevaci[oó]n|centro\s+de\s+carga|radio\s+de\s+giro|peso)\s+(?:de\s+)?\d/iu.test(original)) return null;
  const capacityKeys = ["Capacidad de carga (kg)", "Capacidad de carga", "Capacidad"];
  const capacity = editorialQuantityOf(source.specs, capacityKeys, "kg");
  const preparedCapacity = editorialQuantityOf(prepared.specs, capacityKeys, "kg");
  const announced = [...summary.matchAll(/\bcapacidad\s+de\s+carga\s+de\s+(\d[\d., ]*)\s*kg\b/giu)];
  if (capacity === null || capacity !== preparedCapacity || capacity < 1000 || capacity > 100000 ||
    announced.length !== 1 || editorialQuantity(`${announced[0]?.[1] ?? ""} kg`, "kg") !== capacity) return null;
  const measures = [`capacidad de carga declarada de ${formatEditorialQuantity(capacity)} kg`];
  const add = (label: string, value: number | null, minimum: number, maximum: number, unit: string): void => {
    if (value !== null && value >= minimum && value <= maximum) measures.push(`${label} de ${formatEditorialQuantity(value)} ${unit}`);
  };
  const matchedMetric = (keys: readonly string[]): number | null => {
    const value = editorialMetricOf(source.specs, keys);
    return value === editorialMetricOf(prepared.specs, keys) ? value : null;
  };
  add("altura de elevación indicada", matchedMetric(["Altura de elevación (m)", "Altura de elevación (mm)", "Altura de elevación"]), 1, 30, "m");
  add("peso declarado", editorialQuantity(matchingSpecs(source, prepared, "Peso") ?? undefined, "kg"), 1000, 200000, "kg");
  add("centro de carga indicado", editorialQuantity(matchingSpecs(source, prepared, "Centro de carga") ?? undefined, "mm"), 100, 5000, "mm");
  add("radio de giro indicado", matchedMetric(["Radio de giro", "Radio de giro (mm)"]), 1, 30, "m");
  if (measures.length < 3) return null;
  return `El manipulador de contenedores (reach stacker) ${brand} ${model} figura con ${measures.slice(0, -1).join(", ")} y ${measures.at(-1)}. ` +
    "La capacidad efectiva depende del alcance y de la configuración; debe contrastarse con el diagrama de cargas.\n\n" +
    `Descripción de gama aportada por el proveedor, sin acreditar el equipamiento específico de esta referencia: ${general.trim()}`;
};

export const resolveSourcedOperationalSpecs = (
  source: ProductRecord, prepared: ProductRecord, general: string | null, authenticatedOrigin: boolean
): string | null => {
  if (!authenticatedOrigin || !general?.trim() || !sameEditorialUnit(source, prepared)) return null;
  const containerHandler = reachStackerContext(source, prepared, general);
  if (containerHandler !== null) return containerHandler;
  if (general.trim().split(/\s+/u).length >= 60) return null;
  const addition = batteryContext(source, prepared, general) ?? towerContext(source, prepared, general) ?? transportContext(source, prepared, general) ??
    resolveSourcedEquipmentDetails(source, prepared, general, authenticatedOrigin);
  return addition ? `${general.trim()} ${addition}` : null;
};
