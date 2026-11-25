import { sameProductProvider } from "../../../../catalog/identity.js";
import type { ProductRecord } from "../../../../contracts/catalog.js";
import { resolveEditorialFacts } from "../../core/editorial-facts.js";
import { editorialFamilyOf } from "../../core/editorial-families.js";
import { resolveSourcedEquipmentDetails } from "./editorial-sourced-equipment-details.js";
import { editorialMetricOf, editorialQuantity, editorialQuantityOf, formatEditorialQuantity } from "../../measurements/editorial-measurements.js";
import { resolveMissingEditorialUnitName, sameEditorialUnit, verifiedEditorialIdentity } from "../../core/editorial-source-contract.js";
import { containsEditorialBrandModel, containsEditorialIdentity } from "../../identity/editorial-identity-match.js";
import { verifiedEditorialUnitPair } from "../../identity/editorial-unit-provenance.js";
import { hasUnconditionalEditorialClaim } from "../../claims/editorial-claim-evidence.js";
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

const batteryRange = (value: unknown): readonly [number, number, number] | null => {
  const match = typeof value === "string" ? /^(\d{2,3})\s*V\s*\/\s*(\d{2,4})\s*[-–]\s*(\d{2,4})\s*Ah(?:\s*\(V\/Ah\))?$/iu.exec(value.trim()) : null;
  if (!match?.[1] || !match[2] || !match[3]) return null;
  const [voltage, minimum, maximum] = [Number(match[1]), Number(match[2]), Number(match[3])];
  return voltage >= 12 && voltage <= 120 && minimum >= 50 && maximum <= 2000 && minimum < maximum ?
    [voltage, minimum, maximum] : null;
};

const batteryRangeContext = (source: ProductRecord, prepared: ProductRecord, general: string): string | null => {
  if (source.condition !== "Nuevo" || prepared.condition !== "Nuevo" ||
    /\bbater[ií]as?\b|\bacumuladores?\b|\b\d+\s*(?:V|Ah)\b/iu.test(general)) return null;
  const original = batteryRange(source.specs?.["Capacidad de la batería"]);
  const reconciled = batteryRange(prepared.specs?.["Capacidad de la batería"]);
  if (!original || !reconciled || original.some((value, index) => value !== reconciled[index])) return null;
  const [voltage, minimum, maximum] = original;
  const texts = [source.title, source.shortDescription, source.longDescription, prepared.title, prepared.shortDescription, prepared.longDescription];
  if (texts.some((text) => /\b(?:MWB|LWB|batalla\s+(?:media|larga)|sin\s+bater[ií]as?|di[eé]sel|gasoil|gasolina|GLP|h[ií]brid[ao]s?)\b/iu.test(text ?? "") ||
    [...(text ?? "").matchAll(/\b(\d+)\s*(V|Ah)\b/giu)].some((entry) =>
      entry[2]?.toLowerCase() === "v" ? Number(entry[1]) !== voltage : ![minimum, maximum].includes(Number(entry[1]))))) return null;
  if ([source, prepared].some((record) => ["Voltaje de la batería", "Voltaje batería (V)", "Voltaje"].some((key) =>
    record.specs?.[key] !== undefined && editorialQuantity(record.specs[key], "V") !== voltage) ||
    ["Tipo de Batería", "Tipo de batería", "Capacidad de la batería (Ah)"].some((key) => record.specs?.[key] !== undefined))) return null;
  return `${general.trim()} La tabla técnica declara un intervalo de capacidad de batería de ${formatEditorialQuantity(minimum)} a ${formatEditorialQuantity(maximum)} Ah a ${voltage} V. No identifica cuál de esas capacidades corresponde a la configuración ofertada.`;
};

const batteryVoltageContext = (source: ProductRecord, prepared: ProductRecord, general: string): string | null => {
  if (source.condition !== "Nuevo" || prepared.condition !== "Nuevo" ||
    /\bbater[ií]as?\b|\bacumuladores?\b|\b\d+\s*(?:V|Ah)\b/iu.test(general)) return null;
  const declared = source.specs?.["Capacidad de la batería"];
  const match = typeof declared === "string" ? /^(\d{2,3})\s*V\s*\/\s*\d{2,4}\s*h\s*\(V\/Ah\)$/iu.exec(declared.trim()) : null;
  if (!match?.[1] || declared !== prepared.specs?.["Capacidad de la batería"]) return null;
  const voltage = Number(match[1]);
  if (voltage < 12 || voltage > 120) return null;
  const texts = [source.title, source.shortDescription, source.longDescription, prepared.title, prepared.shortDescription, prepared.longDescription];
  if (texts.some((text) => /\b(?:MWB|LWB|sin\s+bater[ií]as?|di[eé]sel|gasoil|gasolina|GLP|h[ií]brid[ao]s?)\b/iu.test(text ?? "") ||
    [...(text ?? "").matchAll(/\b(\d+)\s*V\b/giu)].some((entry) => Number(entry[1]) !== voltage))) return null;
  if ([source, prepared].some((record) => ["Voltaje de la batería", "Voltaje batería (V)", "Voltaje"].some((key) =>
    record.specs?.[key] !== undefined && editorialQuantity(record.specs[key], "V") !== voltage))) return null;
  return `${general.trim()} La tabla técnica indica un voltaje de batería de ${voltage} V; el dato de capacidad presenta una unidad incompleta y no permite confirmar los amperios-hora.`;
};

const catalogBatteryContext = (source: ProductRecord, prepared: ProductRecord, general: string): string | null => {
  if (source.condition !== "Nuevo" || prepared.condition !== "Nuevo" ||
    /\bbater[ií]as?\b|\bacumuladores?\b|\b\d+\s*(?:V|Ah)\b/iu.test(general)) return null;
  if (!source.model || (source.longDescription?.trim() && !containsEditorialIdentity(source.longDescription, source.model))) return null;
  const raw = source.specs?.["Capacidad de la batería"];
  const current = prepared.specs?.["Capacidad de la batería"];
  const normalized = (value: string): string => value.trim().replace(/\s*\(V\/Ah\)$/iu, "").replace(/\s+/gu, "").toLowerCase();
  if (typeof raw !== "string" || typeof current !== "string" || !/\(V\/Ah\)$/iu.test(raw.trim()) ||
    normalized(raw) !== normalized(current)) return null;
  const single = /^(Li-ion\s+)?(\d{2,3})\s*V\s*\/\s*(\d{2,4})\s*Ah\s*\(V\/Ah\)$/iu.exec(raw.trim());
  const options = /^(\d{2,3})\s*V\s*\/\s*(\d{2,4})(?:\s*[-–]\s*(\d{2,4}))?\s*Ah\s*\|\s*Li-ion\s+(\d{2,3})\s*V\s*\/\s*(\d{2,4})(?:\s*[-–]\s*(\d{2,4}))?\s*Ah\s*\(V\/Ah\)$/iu.exec(raw.trim());
  if (!single && !options) return null;
  const voltage = Number(single ? single[2] : options?.[1]);
  const minimum = Number(single ? single[3] : options?.[2]);
  const maximum = options?.[3] ? Number(options[3]) : minimum;
  const lithiumMin = options ? Number(options[5]) : minimum;
  const lithiumMax = options?.[6] ? Number(options[6]) : lithiumMin;
  if (voltage < 12 || voltage > 120 || minimum < 50 || maximum > 2000 || lithiumMin < 50 || lithiumMax > 2000 ||
    (options && (Number(options[4]) !== voltage || maximum < minimum || lithiumMax < lithiumMin ||
      (options[3] && maximum === minimum) || (options[6] && lithiumMax === lithiumMin)))) return null;
  const texts = [source.title, source.shortDescription, source.longDescription, prepared.title, prepared.shortDescription, prepared.longDescription];
  const capacities = new Set([minimum, maximum, lithiumMin, lithiumMax]);
  if (texts.some((text) => /\b(?:MWB|LWB|batalla\s+(?:media|larga)|sin\s+bater[ií]as?|di[eé]sel|gasoil|gasolina|GLP|h[ií]brid[ao]s?|hasta\s+\d+\s*Ah)\b/iu.test(text ?? "") ||
    [...(text ?? "").matchAll(/\b(\d+(?:[.,]\d+)?)\s*(V|Ah)\b/giu)].some((entry) => {
      const value = Number(entry[1]?.replace(",", "."));
      return entry[2]?.toLowerCase() === "v" ? value !== voltage : !capacities.has(value);
    }))) return null;
  if ([source, prepared].some((record) => ["Voltaje de la batería", "Voltaje batería (V)", "Voltaje", "Voltios"].some((key) =>
    record.specs?.[key] !== undefined && editorialQuantity(record.specs[key], "V") !== voltage) ||
    ["Tipo de Batería", "Tipo de batería", "Capacidad de la batería (Ah)"].some((key) => record.specs?.[key] !== undefined))) return null;
  if (single && texts.some((text) => /\b(?:opcional(?:mente)?|alternativas?|opciones?|puede\s+incorporar)\b[^.!?;]{0,65}\bbater[ií]as?\b|\bbater[ií]as?\b[^.!?;]{0,65}\b(?:opcional(?:mente)?|alternativas?|opciones?)\b/iu.test(text ?? ""))) return null;
  const capacityText = (from: number, to: number): string => from === to ?
    `${formatEditorialQuantity(from)} Ah` : `entre ${formatEditorialQuantity(from)} y ${formatEditorialQuantity(to)} Ah`;
  const stated = options ? `dos alternativas de batería a ${voltage} V: ${capacityText(minimum, maximum)} y ${capacityText(lithiumMin, lithiumMax)} en ion-litio` :
    `batería${single?.[1] ? " de ion-litio" : ""} a ${voltage} V con ${capacityText(minimum, maximum)}`;
  return `${general.trim()} La tabla técnica de esta referencia declara ${stated}. La configuración suministrada debe confirmarse para la unidad ofertada.`;
};

const platformBatteryChemistryContext = (source: ProductRecord, prepared: ProductRecord, general: string): string | null => {
  if (/\b(?:bater[ií]as?|acumuladores?|plomo|litio|li-ion)\b/iu.test(general)) return null;
  const parse = (value: string | null): "plomo" | "litio" | null => {
    const normalized = value?.normalize("NFD").replace(/[\u0300-\u036f]/gu, "").toLowerCase() ?? "";
    if (/^(?:bateria de )?plomo(?:[ -]acido)?$/u.test(normalized)) return "plomo";
    if (/^(?:bateria de )?(?:litio|ion[ -]litio|li-ion)$/u.test(normalized)) return "litio";
    return null;
  };
  const keys = ["Tipo de batería", "Tipo de Batería", "Tecnología de batería"];
  const values = keys.flatMap((key) => source.specs?.[key] === undefined && prepared.specs?.[key] === undefined ? [] :
    [parse(matchingSpecs(source, prepared, key))]);
  const battery = values[0];
  if (!battery || !values.every((value) => value === battery)) return null;
  const texts = [source.title, source.shortDescription, source.longDescription, prepared.title, prepared.shortDescription, prepared.longDescription];
  if (!texts.some((text) => /\bel[eé]ctric[oa]s?\b/iu.test(text ?? ""))) return null;
  const chemistry = battery === "plomo" ? /\bplomo(?:[ -][aá]cido)?\b/giu : /\b(?:litio|li-ion)\b/giu;
  const competing = battery === "plomo" ? /\b(?:litio|li-ion|gel|agm)\b/iu : /\b(?:plomo|gel|agm)\b/iu;
  if (texts.some((text) => {
    const value = text ?? "";
    return competing.test(value) || /\b(?:di[eé]sel|gasoil|gasolina|GLP|h[ií]brid[oa]s?|sin\s+bater[ií]as?)\b/iu.test(value) ||
      /\b(?:opcional(?:mente)?|alternativas?|opciones?|puede\s+incorporar)\b[^.!?;]{0,65}\bbater[ií]as?\b|\bbater[ií]as?\b[^.!?;]{0,65}\b(?:opcional(?:mente)?|alternativas?|opciones?|no\s+incluid[oa]s?|pendientes?\s+de\s+confirmar)\b/iu.test(value) ||
      Boolean(value.match(chemistry) && !hasUnconditionalEditorialClaim(value, chemistry));
  })) return null;
  return `${general.trim()} La tabla técnica de esta referencia declara batería de ${battery}.`;
};

export const resolveSourcedCombinedBatteryGeneral = (source: ProductRecord, prepared: ProductRecord, general: string | null): string | null => {
  if (!general || !sameProductProvider(source, prepared)) return null;
  if (!source.brand || !source.model || !verifiedEditorialUnitPair(source, prepared) ||
    !verifiedEditorialIdentity(source) || !verifiedEditorialIdentity(prepared) ||
    !/^La ficha técnica de\b/u.test(general) || !containsEditorialBrandModel(general, source.brand, source.model) ||
    general.trim().split(/\s+/u).length > 180) return null;
  const original = resolveEditorialFacts(source);
  const reconciled = resolveEditorialFacts(prepared);
  if (!original || !reconciled || original.family !== reconciled.family || editorialFamilyOf(general) !== original.family) return null;
  if (["plataforma-tijera", "plataforma-articulada", "plataforma-telescopica", "plataforma-mastil", "plataforma-unipersonal", "plataforma-oruga"].includes(original.family)) {
    return [original.energy, reconciled.energy].every((energy) => energy === null || energy === "eléctrica") ?
      platformBatteryChemistryContext(source, prepared, general) : null;
  }
  if (!["carretilla-elevadora", "carretilla-retractil", "apilador", "transpaleta", "recogepedidos"].includes(original.family)) return null;
  const compatibleRangeEnergy = [original.energy, reconciled.energy].every((energy) => energy === null || energy === "eléctrica");
  const range = compatibleRangeEnergy ? batteryRangeContext(source, prepared, general) : null;
  if (range !== null) return range;
  const catalog = compatibleRangeEnergy ? catalogBatteryContext(source, prepared, general) : null;
  if (original.energy !== "eléctrica" || reconciled.energy !== "eléctrica") return catalog;
  const voltageContext = batteryVoltageContext(source, prepared, general);
  if (voltageContext !== null) return voltageContext;
  const value = matchingSpecs(source, prepared, "Capacidad de la batería");
  const match = value && /^(\d{2,3})\s*V\s*\/\s*(\d{2,4})\s*Ah\s*\(V\/Ah\)$/iu.exec(value);
  if (!match?.[1] || !match[2]) return catalog;
  const voltage = Number(match[1]);
  const capacity = Number(match[2]);
  if (voltage < 12 || voltage > 120 || capacity < 50 || capacity > 2000) return catalog;
  if (/\bbater[ií]as?\b|\bacumuladores?\b|\b\d+\s*(?:V|Ah)\b/iu.test(general)) return catalog;
  const originalLong = source.longDescription ?? "";
  if (!containsEditorialBrandModel(originalLong, source.brand, source.model)) return catalog;
  const texts = [source.shortDescription, originalLong, prepared.shortDescription, prepared.longDescription];
  const pair = new RegExp(`\\b${voltage}\\s*V\\s*(?:/|y)\\s*${capacity}\\s*Ah\\b`, "giu");
  if (!hasUnconditionalEditorialClaim(originalLong, pair)) return catalog;
  if (texts.some((text) => /\b(?:MWB|LWB|batalla\s+(?:media|larga)|hasta\s+\d+\s*Ah|sin\s+bater[ií]as?)\b/iu.test(text ?? "") ||
    [...(text ?? "").matchAll(/\b(\d+)\s*(V|Ah)\b/giu)].some((entry) =>
      Number(entry[1]) !== (entry[2]?.toLocaleLowerCase("es") === "v" ? voltage : capacity)))) return catalog;
  const electricalKeys = ["Voltaje de la batería", "Voltaje batería (V)", "Voltaje"];
  if ([source, prepared].some((record) => electricalKeys.some((key) =>
    record.specs?.[key] !== undefined && editorialQuantity(record.specs[key], "V") !== voltage))) return catalog;
  return `${general.trim()} El campo de batería de esta referencia consigna ${voltage} V y ${formatEditorialQuantity(capacity)} Ah. Es un dato del catálogo técnico, no una comprobación del estado ni de la configuración de la batería de la unidad entregada.`;
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

const transportContext = (source: ProductRecord, prepared: ProductRecord, general: string, authenticatedOrigin: boolean): string | null => {
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
  const axleDescription = /\bplatafor(?:ma|a)\s+4\s+ejes\b/iu.test(source.title ?? "") &&
    !/\b(?:4|cuatro)\s+ejes\b/iu.test(general) ? "El título del vendedor identifica una plataforma de cuatro ejes. " : "";
  const technical = measured.length ? `La tabla técnica de la misma unidad indica ${measured.join(", ")}. ` : "";
  const identity = resolveMissingEditorialUnitName(source, prepared, general, authenticatedOrigin);
  const registration = `El anuncio${identity ? ` de ${identity}` : ""} registra matrícula ${source.specs.Matrícula}${year !== null ? ` y fabricación en ${year}` : ""}. `;
  const inspection = /\bITV\b/iu.test(source.longDescription) ?
    "La referencia del vendedor a la ITV requiere comprobar su vigencia con la documentación actual del vehículo." :
    "Los trabajos indicados en el anuncio corresponden al historial declarado por el vendedor, pendiente de comprobación documental.";
  return `${axleDescription}${technical}${registration}${inspection}`;
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

const conflictingPalletTruckGeneral = (source: ProductRecord, prepared: ProductRecord, general: string): string | null => {
  const brand = source.brand?.trim();
  const model = source.model?.trim();
  const original = source.longDescription?.trim();
  const summary = source.shortDescription?.trim();
  if (!brand || !model || !original || !summary || general.trim() !== original ||
    !sameProductProvider(source, prepared) || !verifiedEditorialUnitPair(source, prepared) ||
    !verifiedEditorialIdentity(source) || !verifiedEditorialIdentity(prepared) ||
    source.specs?.Marca !== brand || source.specs?.Modelo !== model ||
    prepared.specs?.Marca !== brand || prepared.specs?.Modelo !== model ||
    source.shortDescription !== prepared.shortDescription || source.longDescription !== prepared.longDescription ||
    !containsEditorialBrandModel(summary, brand, model) ||
    [source.title, prepared.title, summary].some((text) => editorialFamilyOf(text ?? "") !== "transpaleta") ||
    !containsEditorialSourceSlugModel(new URL(source.url).pathname.split("/").filter(Boolean).at(-1) ?? "", model, undefined)) return null;
  const escapedBrand = brand.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
  const otherModel = new RegExp(`^Transpaleta\\s+${escapedBrand}\\s+([\\p{L}\\d./-]*\\d[\\p{L}\\d./-]*):`, "iu").exec(original)?.[1];
  if (!otherModel || containsEditorialIdentity(otherModel, model) || containsEditorialIdentity(model, otherModel) ||
    containsEditorialIdentity(original, model) || [source.title, prepared.title, summary].some((text) => containsEditorialIdentity(text ?? "", otherModel))) return null;
  const capacity = editorialQuantity(matchingSpecs(source, prepared, "Capacidad de carga (kg)") ?? undefined, "kg");
  const capacityDeclared = (text: string): boolean => {
    const values = [...text.matchAll(/\b(\d{3,5})\s*kg\b/giu)];
    return values.length === 1 && Number(values[0]?.[1]) === capacity;
  };
  if (capacity === null || capacity < 100 || capacity > 10000 ||
    ![source.title ?? "", prepared.title ?? "", summary].every(capacityDeclared)) return null;
  const weight = editorialQuantity(matchingSpecs(source, prepared, "Peso") ?? undefined, "kg");
  const lift = editorialMetricOf(source.specs, ["Altura de elevación (m)"]);
  if (weight === null || weight < 50 || weight > 10000 || lift === null || lift < 0.05 || lift > 0.5 ||
    lift !== editorialMetricOf(prepared.specs, ["Altura de elevación (m)"])) return null;
  return `El título, el resumen y la tabla técnica identifican la transpaleta ${brand} ${model}, con capacidad de carga declarada de ${formatEditorialQuantity(capacity)} kg. La tabla de esta referencia indica peso de ${formatEditorialQuantity(weight)} kg y altura de elevación de ${formatEditorialQuantity(lift)} m. La descripción extensa del vendedor menciona otro modelo, ${brand} ${otherModel}; sus prestaciones y equipamiento no se trasladan a esta referencia. La configuración efectiva debe contrastarse con la documentación de la unidad.`;
};

export const resolveSourcedOperationalSpecs = (
  source: ProductRecord, prepared: ProductRecord, general: string | null, authenticatedOrigin: boolean
): string | null => {
  if (!authenticatedOrigin || !general?.trim() || !sameEditorialUnit(source, prepared)) return null;
  const conflictingPalletTruck = conflictingPalletTruckGeneral(source, prepared, general);
  if (conflictingPalletTruck !== null) return conflictingPalletTruck;
  const containerHandler = reachStackerContext(source, prepared, general);
  if (containerHandler !== null) return containerHandler;
  const addition = general.trim().split(/\s+/u).length < 60 ?
    batteryContext(source, prepared, general) ?? towerContext(source, prepared, general) ?? transportContext(source, prepared, general, authenticatedOrigin) ??
      resolveSourcedEquipmentDetails(source, prepared, general, authenticatedOrigin) : null;
  return addition ? `${general.trim()} ${addition}` : null;
};
