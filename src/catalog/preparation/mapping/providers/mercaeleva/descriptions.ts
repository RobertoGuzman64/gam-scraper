import type { ProductRecord } from "../../../../../contracts/catalog.js";
import { fold } from "../../category-utils.js";
import { verifiedMercaelevaA14jeWorkingHeight } from "../../../evidence/providers/mercaeleva/lgmg-a14je-work-height-evidence.js";
import { mercaelevaMissingDescriptions } from "./missing-descriptions.js";
import { verifiedMercaelevaPriorityShortDescription } from "../../../evidence/providers/mercaeleva/priority-short-descriptions.js";

const identity = (value: string): string => fold(value).replace(/[^a-z0-9]/g, "");

const machineFamily = (value: string): string | null => {
  const text = fold(value);
  const families: readonly [string, RegExp][] = [
    ["carretilla", /\bcarretilla\b/],
    ["transpaleta", /\btranspalet(?:a)?\b|\bpallet truck\b/],
    ["apilador", /\bapilador(?:a)?\b|\bstacker\b/],
    ["plataforma", /\bplataforma\b|\b(?:articulated boom|scissor lift)\b/],
    ["manipulador", /\bmanipulador\b|\btelehandler\b/],
    ["dumper", /\bdumper\b/],
    ["miniexcavadora", /\bminiexcavadora\b/],
    ["camion", /\bcamion\b/]
  ];
  const matches = families.filter(([, pattern]) => pattern.test(text));
  return matches.length === 1 ? matches[0]?.[0] ?? null : null;
};

const exactModelIn = (text: string, model: string): boolean => {
  const compact = identity(model);
  if (!compact) return false;
  const pattern = compact.split("").join("[^a-z0-9]*");
  return new RegExp(`(?:^|[^a-z0-9])${pattern}(?![a-z0-9]|[-/][a-z0-9])`).test(fold(text));
};

const brandInSource = (brand: string, source: string): boolean => {
  if (identity(source).includes(identity(brand))) return true;
  return fold(brand) === "manitou" && /\bmantiou\b/.test(fold(source));
};

const descriptionSource = (record: ProductRecord, general: string): string | null => {
  const withReference = /^ref\.\s*([\p{L}\d/-]+)\s+(.+)$/iu.exec(general);
  if (withReference?.[1] && withReference[2]) {
    const article = record.specs?.["Artículo No."];
    if (typeof article === "string" && identity(article) !== identity(withReference[1])) return null;
    return withReference[2].trim();
  }
  const structured = /^(marca:\s*([\p{L}\d]+)\s+modelo:\s*([\p{L}\d./_+-]+)\s+tipo:\s*.+?)(?=\s+(?:configuraci[oó]n|categor[ií]a|mma|motor)\s*:|$)/iu.exec(general);
  if (structured) {
    if (identity(structured[2] ?? "") !== identity(record.brand ?? "") ||
      identity(structured[3] ?? "") !== identity(record.model ?? "")) return null;
    return structured[1]?.trim() ?? null;
  }
  const state = fold(String(record.specs?.["Estado"] ?? ""));
  if (record.condition !== "Nuevo" || (state !== "nuevo" && state !== "nueva")) return null;
  return /^nuev[oa]\s*!{1,3}\s+(.+)$/iu.exec(general)?.[1]?.trim() ?? null;
};

const subtype = (value: string): string | null => {
  const types: readonly [string, RegExp][] = [
    ["tijera", /\btijera\b|\bscissor lift\b/],
    ["articulada", /\barticulada\b|\barticulated boom\b/],
    ["telescopica", /\btelescopica\b/],
    ["vertical", /\bvertical\b/],
    ["unipersonal", /\bunipersonal\b/]
  ];
  const found = types.filter(([, pattern]) => pattern.test(value));
  return found.length === 1 ? found[0]?.[0] ?? null : null;
};

type ShortDescriptionResolution = {
  readonly description: string | null;
  readonly heightConflict: boolean;
};

const notAvailable: ShortDescriptionResolution = { description: null, heightConflict: false };

const documentedElectricForklift = (record: ProductRecord): string | null => {
  if (record.providerId !== "mercaeleva" || record.categoryKey !== "venta" ||
    record.reference !== "M818-7811" || record.condition !== "Segunda mano" ||
    record.brand !== "Linde" || record.model !== "E25/600-336" ||
    record.title !== "Linde E25/600-336 CARRETILLA ELEVADORA ELECTRICA 2500 KG" ||
    record.url !== "https://sales.mercaeleva.com/es/for-sale/machine/Linde-E25-600-336-M818-7811" ||
    record.year !== "2008" || !["3404", "3404 h"].includes(record.horometer ?? "") ||
    record.longDescription !== "Ref. MER0670 CARRETILLA ELEVADORA ELECTRICA 2500 KG DUPLEX TRIPLEX LINDE E25/600-336 ALTURA DE TRABAJO 4.300mm HORAS 3404 AÑO DE FABRICACION 2008") return null;
  const specs = record.specs;
  if (specs?.Marca !== "Linde" || specs.Modelo !== "E25/600-336" ||
    specs["Título adicional"] !== "CARRETILLA ELEVADORA ELECTRICA 2500 KG" ||
    specs["Artículo No."] !== "MER0670" || specs["Año de fabricación"] !== "2008" ||
    specs["Horas laborales"] !== "3404 h" || specs.Estado !== "Usado" ||
    specs["Capacidad máxima de elevación"] !== "2500 kg" ||
    specs["Tipo de Batería"] !== "Plomo-ácido" ||
    specs["Altura máxima de elevación"] !== "4300 mm" ||
    specs["Tipo de mástil"] !== "Dúplex/estándar") return null;
  return "Carretilla elevadora eléctrica Linde E25/600-336, año 2008, con capacidad de 2.500 kg, elevación de 4.300 mm y 3.404 horas registradas.";
};

export const resolveMercaelevaShortDescription = (record: ProductRecord): ShortDescriptionResolution => {
  if (record.providerId !== "mercaeleva" || record.shortDescription?.trim()) return notAvailable;
  const documented = documentedElectricForklift(record) ?? verifiedMercaelevaPriorityShortDescription(record);
  if (documented) return { description: documented, heightConflict: false };
  const general = record.longDescription?.trim();
  if (!general || !record.brand?.trim() || !record.model?.trim()) {
    return { description: mercaelevaMissingDescriptions(record).short, heightConflict: false };
  }

  const sellerText = descriptionSource(record, general);
  if (!sellerText) return notAvailable;
  const source = sellerText.split(/\s+(?:horas?|hours?|houras)\s*:?\s*\d|\s+(?:a[nñ]o\s+de\s+fabricaci[oó]n|year\s+of\s+manufacture)\b/i)[0]?.trim();
  if (!source || source.length < 25 || !exactModelIn(source, record.model)) return notAvailable;

  const titleFamily = machineFamily(record.title ?? "");
  if (!titleFamily || machineFamily(source) !== titleFamily) return notAvailable;
  if (!brandInSource(record.brand, source)) return notAvailable;

  const title = fold(record.title ?? "");
  const description = fold(source);
  const electric = /\belectric[oa]s?\b|\belectric\b/;
  const diesel = /\bdiesel\b/;
  if ((electric.test(title) && diesel.test(description)) || (diesel.test(title) && electric.test(description))) return notAvailable;
  const titleSubtype = subtype(title);
  const sourceSubtype = subtype(description);
  if (titleSubtype && sourceSubtype && titleSubtype !== sourceSubtype) return notAvailable;

  const mastTypes = ["simplex", "duplex", "triplex"];
  if (mastTypes.filter((type) => new RegExp(`\\b${type}\\b`).test(description)).length > 1) return notAvailable;

  const titleHeight = title.match(/\b(\d{1,2}(?:[.,]\d+)?)\s*(?:mt|metros?)\b/)?.[1];
  const sourceHeight = description.match(/\b(?:altura\s+(?:de\s+)?(?:trabajo|elevacion)|working height)\s*:?\s*(\d{1,2}(?:[.,]\d+)?)\s*(?:mt|metros?)\b/)?.[1];
  if (titleHeight && sourceHeight && Number(titleHeight.replace(",", ".")) !== Number(sourceHeight.replace(",", "."))) {
    const publishedHeight = record.specs?.["Altura de trabajo"];
    const working = Number(sourceHeight.replace(",", "."));
    const titleValue = Number(titleHeight.replace(",", "."));
    const published = typeof publishedHeight === "string" ? publishedHeight.trim().match(/^(\d{1,2}(?:[.,]\d+)?)\s*(?:m|mt|metros?)$/i) : null;
    const confirmed = published?.[1] ? Number(published[1].replace(",", ".")) : null;
    const platformRange = titleFamily === "plataforma" && titleSubtype === "tijera" &&
      sourceSubtype === "tijera" && /\belectrica\b/.test(title) && /\belectrica\b/.test(description) &&
      !/\baltura\s+(?:de\s+)?trabajo\b/.test(title) &&
      working - titleValue === 2 && confirmed === working;
    if (!platformRange && !verifiedMercaelevaA14jeWorkingHeight(record, titleValue, working, confirmed)) {
      return { description: null, heightConflict: true };
    }
  }

  const titleCapacity = title.match(/\b(\d[\d.,]*)\s*kg\b/)?.[1];
  const sourceCapacity = description.match(/\b(?:capacidad(?:\s+de\s+carga)?\s*:?)?\s*(\d[\d.,]*)\s*kg\b/)?.[1];
  if (titleCapacity && sourceCapacity) {
    const kilograms = (value: string): number => Number(value.replace(/\./g, "").replace(",", "."));
    if (kilograms(titleCapacity) !== kilograms(sourceCapacity)) return notAvailable;
  }

  return { description: source, heightConflict: false };
};

export const mercaelevaShortDescription = (record: ProductRecord): string | null =>
  resolveMercaelevaShortDescription(record).description;
