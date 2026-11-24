import { containsEditorialBrandModel, containsEditorialIdentity } from "./editorial-identity-match.js";
import type { ProductRecord } from "../../../contracts/catalog.js";
import type { EditorialFamily } from "../core/editorial-families.js";
import { editorialFamilyName, editorialFamilyOf, resolveConsistentEditorialFamily } from "../core/editorial-families.js";
import { resolveEditorialSource } from "../core/editorial-source.js";
import { sameEditorialUnit, verifiedEditorialIdentity } from "../core/editorial-source-contract.js";
import { resolveVerifiedEditorialCondition } from "./editorial-condition.js";
import { containsEditorialSourceSlugModel } from "../source/editorial-source-url.js";
import { editorialQuantity, editorialQuantityOf, formatEditorialQuantity } from "../measurements/editorial-measurements.js";

export const resolveEditorialIdentitySummary = (
  record: ProductRecord,
  familyOverride: EditorialFamily | null
): string | null => {
  if (!verifiedEditorialIdentity(record)) return null;
  const source = resolveEditorialSource(record);
  if (!source) return null;
  const family = resolveConsistentEditorialFamily(source.familyClues, record.title,
    typeof record.specs?.["Título adicional"] === "string" ? record.specs["Título adicional"] : null,
    `${record.subcategory ?? ""} | ${record.categoryName}`, familyOverride);
  if (!family) return null;
  const noun = editorialFamilyName(family);
  const verifiedCondition = resolveVerifiedEditorialCondition(record);
  const condition = verifiedCondition === "Segunda mano" ? " de ocasión" : verifiedCondition === "Nuevo" ? " nueva" : "";
  return `${noun[0]?.toLocaleUpperCase("es") ?? ""}${noun.slice(1)} ${source.brand} ${source.model}${condition}.`;
};

export const conciseVerifiedUnitGeneral = (record: ProductRecord, general: string): string | null => {
  const first = general.trim().split(/(?<=[.!?])\s+(?=[A-ZÁÉÍÓÚÑ])/u)[0] ?? "";
  if (!record.brand || !record.model || first.length < 35 || first.length > 180 ||
    !containsEditorialBrandModel(first, record.brand, record.model)) return null;
  return first;
};

export const conciseSignedUnitGeneral = (general: string): string | null => {
  const first = general.trim().split(/(?<=[.!?])\s+(?=[A-ZÁÉÍÓÚÑ])/u)[0] ?? "";
  if (first.length < 45 || first.length > 220 || !/[.!?]$/u.test(first) ||
    /^(?:contamos|tenemos|ofrecemos|disponemos)\b/iu.test(first)) return null;
  return first;
};

export const unresolvedEditorialModelVariantShort =
  "La variante de esta unidad no coincide entre el anuncio y la ficha técnica; su identidad está pendiente de verificar.";

export const unresolvedEditorialModelVariantGeneral =
  "El título y la URL del anuncio identifican una variante diferente del modelo registrado en la ficha técnica. La identidad de esta unidad debe comprobarse antes de atribuir prestaciones a cualquiera de las variantes.";

const corroboratedLithiumVariantGeneral = (
  source: ProductRecord, prepared: ProductRecord, current: string
): string | null => {
  const brand = source.brand?.trim();
  const model = source.model?.trim();
  const base = /^([\p{L}\d./-]+)-LI$/iu.exec(model ?? "")?.[1];
  const summary = source.shortDescription?.trim() ?? "";
  const original = source.longDescription?.trim() ?? "";
  if (!brand || !model || !base || !/\d/u.test(base) ||
    source.specs?.Marca !== brand || prepared.specs?.Marca !== brand ||
    source.specs?.Modelo !== model || prepared.specs?.Modelo !== model ||
    source.shortDescription !== prepared.shortDescription || source.longDescription !== prepared.longDescription ||
    containsEditorialIdentity(current, model)) return null;
  const battery = source.specs?.["Tipo de batería"];
  if (typeof battery !== "string" || !/^bater[ií]a de litio$/iu.test(battery.trim()) ||
    battery !== prepared.specs?.["Tipo de batería"]) return null;
  const family = editorialFamilyOf(source.title ?? "");
  if (family !== "plataforma-tijera" && family !== "plataforma-articulada" && family !== "plataforma-telescopica") return null;
  const texts = [source.title ?? "", prepared.title ?? "", original, current];
  if (texts.some((text) => !containsEditorialBrandModel(text, brand, base) || editorialFamilyOf(text) !== family) ||
    !containsEditorialBrandModel(summary, brand, model) || editorialFamilyOf(summary) !== family ||
    [original, current].some((text) => !/\bcon bater[ií]a de litio\b/iu.test(text))) return null;
  const baseIdentity = (record: ProductRecord): ProductRecord => ({ ...record, model: base, specs: { ...record.specs, Modelo: base } });
  if (!resolveEditorialSource(baseIdentity(source)) || !resolveEditorialSource(baseIdentity(prepared))) return null;
  const slug = new URL(source.url).pathname.split("/").filter(Boolean).at(-1) ?? "";
  const compact = (value: string): string => value.normalize("NFKD").replace(/[^a-z0-9]/giu, "").toLowerCase();
  if (!containsEditorialSourceSlugModel(slug, model, undefined) || !containsEditorialIdentity(slug, brand) ||
    !compact(slug).endsWith(compact(model))) return null;
  const escapedBrand = brand.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
  const brandModels = new RegExp(`\\b${escapedBrand}\\s+([\\p{L}\\d./-]*\\d[\\p{L}\\d./-]*)`, "giu");
  if ([...texts, summary].some((text) => [...text.matchAll(brandModels)].some((match) =>
    !match[1] || ![compact(base), compact(model)].includes(compact(match[1]))))) return null;
  const capacityKeys = ["Capacidad de carga (kg)", "Capacidad de carga", "Capacidad"];
  const capacity = editorialQuantityOf(source.specs, capacityKeys, "kg");
  const announced = [...summary.matchAll(/\bcapacidad\s+de\s+(?:la\s+cesta|carga)(?:\s+de)?\s+(\d[\d., ]*)\s*kg\b/giu)];
  if (capacity === null || capacity < 50 || capacity > 20000 || capacity !== editorialQuantityOf(prepared.specs, capacityKeys, "kg") ||
    announced.length !== 1 || editorialQuantity(`${announced[0]?.[1] ?? ""} kg`, "kg") !== capacity ||
    [original, current].some((text) => /\b\d+\s*(?:V|Ah)\b/iu.test(text) ||
      /\b(?:equipad[ao]|provist[ao]|dotad[ao])\s+con\s+bater[ií]a\s+de\s+plomo\b/iu.test(text))) return null;
  const capacities = [original, current].flatMap((text) => [...text.matchAll(/\bcapacidad\s+de\s+(?:la\s+cesta|carga)(?:\s+m[aá]xima)?(?:\s+es)?(?:\s+de)?(?:\s+hasta)?\s+(\d[\d., ]*)\s*kg\b/giu)]);
  if (capacities.some((match) => editorialQuantity(`${match[1] ?? ""} kg`, "kg") !== capacity) ||
    [original, current].some((text) => /\b(?:sin bater[ií]a de litio|no (?:lleva|incorpora|dispone de|cuenta con) bater[ií]a de litio|bater[ií]a de litio opcional)\b/iu.test(text))) return null;
  return `La tabla técnica identifica esta referencia como ${brand} ${model}, con batería de litio declarada.\n\n${current}`;
};

export const resolveCorroboratedEditorialVariantGeneral = (
  source: ProductRecord, prepared: ProductRecord, general: string | null, authenticatedOrigin: boolean
): string | null => {
  const brand = source.brand?.trim();
  const model = source.model?.trim();
  const summary = source.shortDescription?.trim();
  const original = source.longDescription?.trim();
  const current = general?.trim();
  if (authenticatedOrigin && sameEditorialUnit(source, prepared) && current && /-LI$/iu.test(model ?? "")) {
    return corroboratedLithiumVariantGeneral(source, prepared, current);
  }
  const variant = /^([\p{L}\d./-]+)\s+\((MWB|LWB|pedestrian)\)$/iu.exec(model ?? "");
  const base = variant?.[1];
  const descriptor = variant?.[2]?.toLocaleLowerCase("es");
  if (!authenticatedOrigin || !sameEditorialUnit(source, prepared) ||
    !brand || !model || !base || !descriptor || !/\d/u.test(base) || !summary || !original || !current ||
    source.specs?.Marca !== brand || prepared.specs?.Marca !== brand ||
    source.specs?.Modelo !== model || prepared.specs?.Modelo !== model ||
    source.shortDescription !== prepared.shortDescription || source.longDescription !== prepared.longDescription ||
    containsEditorialIdentity(current, model)) return null;
  const family = descriptor === "pedestrian" ? "apilador" : "carretilla-elevadora";
  const texts = [source.title ?? "", prepared.title ?? "", summary, original, current];
  if (texts.some((text) => !containsEditorialBrandModel(text, brand, base) ||
    editorialFamilyOf(text.slice(0, 300)) !== family)) return null;
  const baseIdentity = (record: ProductRecord): ProductRecord => ({
    ...record, model: base, specs: { ...record.specs, Modelo: base }
  });
  if (!resolveEditorialSource(baseIdentity(source)) || !resolveEditorialSource(baseIdentity(prepared))) return null;
  const slug = new URL(source.url).pathname.split("/").filter(Boolean).at(-1) ?? "";
  const compactIdentity = (value: string): string => value.normalize("NFKD").replace(/[^a-z0-9]/giu, "").toLowerCase();
  if (!containsEditorialSourceSlugModel(slug, base, source.specs?.Motor) || !containsEditorialIdentity(slug, brand) ||
    !compactIdentity(slug).endsWith(compactIdentity(base))) return null;
  const escapedBrand = brand.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
  const brandModels = new RegExp(`\\b${escapedBrand}\\s+([\\p{L}\\d./-]*\\d[\\p{L}\\d./-]*)`, "giu");
  if (texts.some((text) => {
    const matches = [...text.matchAll(brandModels)];
    return !matches.length || matches.some((match) => !match[1] || compactIdentity(match[1]) !== compactIdentity(base));
  })) return null;
  const declarations = texts.join(" ");
  const otherDescriptor = descriptor === "mwb" ? /\b(?:LWB|batalla larga|pedestrian)\b/iu : descriptor === "lwb" ?
    /\b(?:MWB|batalla media|pedestrian)\b/iu : /\b(?:MWB|LWB|conductor sentado)\b/iu;
  if (otherDescriptor.test(declarations) || /\b(?:MWB|LWB|pedestrian)\b/iu.test(declarations) || descriptor === "pedestrian" &&
    !/\ba pie\b/iu.test(source.title ?? "")) return null;
  const capacityKeys = ["Capacidad de carga (kg)", "Capacidad de carga", "Capacidad"];
  const capacity = editorialQuantityOf(source.specs, capacityKeys, "kg");
  const announced = [...summary.matchAll(/\bcapacidad\s+de\s+carga\s+de\s+(\d[\d., ]*)\s*kg\b/giu)];
  if (capacity === null || capacity !== editorialQuantityOf(prepared.specs, capacityKeys, "kg") ||
    capacity < 100 || capacity > 100000 || announced.length !== 1 ||
    editorialQuantity(`${announced[0]?.[1] ?? ""} kg`, "kg") !== capacity) return null;
  const capacityMentions = [source.title ?? "", prepared.title ?? "", original, current].flatMap((text) =>
    [...text.matchAll(/\b(?:capacidad(?:\s+de\s+carga)?(?:\s+m[aá]xima)?(?:\s+de)?(?:\s+hasta)?\s+)?(\d[\d., ]*)\s*kg\b/giu)]);
  if (capacityMentions.some((match) => {
    const value = match[1]?.trim() ?? "";
    const normal = editorialQuantity(`${value} kg`, "kg");
    return normal !== capacity && !(/^\d{1,3}(?:,\d{3})+$/u.test(value) && Number(value.replace(/,/gu, "")) === capacity);
  })) return null;
  const batteryMentions = [original, current].flatMap((text) => [...text.matchAll(/\b(\d+)\s*(V|Ah)\b/giu)]);
  if (batteryMentions.length) {
    const battery = source.specs?.["Capacidad de la batería"];
    const declared = typeof battery === "string" ? /^(\d+)\s*V\s*\/\s*(\d+)\s*Ah(?:\s*\(V\/Ah\))?$/iu.exec(battery.trim()) : null;
    if (!declared || battery !== prepared.specs?.["Capacidad de la batería"] || batteryMentions.some((match) =>
      Number(match[1]) !== Number(match[2]?.toLowerCase() === "v" ? declared[1] : declared[2]))) return null;
  }
  return `La tabla técnica identifica esta referencia como ${brand} ${model}, con capacidad de carga declarada de ${formatEditorialQuantity(capacity)} kg. ` +
    `El texto del proveedor utiliza la denominación base ${brand} ${base}; las prestaciones dependientes de la configuración deben contrastarse con la ficha de la variante.\n\n${current}`;
};
