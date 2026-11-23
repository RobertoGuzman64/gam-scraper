import type { ProductRecord } from "../../../../contracts/catalog.js";
import { editorialFamilyOf } from "./editorial-families.js";
import { resolveSourcedEquipmentDetails } from "./editorial-sourced-equipment-details.js";
import { editorialMetricOf, editorialQuantityOf, formatEditorialQuantity } from "./editorial-measurements.js";
import { sameEditorialUnit, verifiedEditorialIdentity } from "./editorial-source-contract.js";

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

export const resolveSourcedOperationalSpecs = (
  source: ProductRecord, prepared: ProductRecord, general: string | null, authenticatedOrigin: boolean
): string | null => {
  if (!authenticatedOrigin || !general?.trim() || general.trim().split(/\s+/u).length >= 60 ||
    !sameEditorialUnit(source, prepared)) return null;
  const addition = batteryContext(source, prepared, general) ?? towerContext(source, prepared, general) ?? transportContext(source, prepared, general) ??
    resolveSourcedEquipmentDetails(source, prepared, general, authenticatedOrigin);
  return addition ? `${general.trim()} ${addition}` : null;
};
