import type { ProductRecord } from "../../../../../contracts/catalog.js";
import { fold } from "../../category-utils.js";

const normalize = (value: string | null | undefined): string => fold(value ?? "");

const recordedSpec = (record: ProductRecord, key: string): string => {
  const value = record.specs?.[key];
  return typeof value === "string" ? fold(value) : "";
};

const documentedBrand = (record: ProductRecord, brand: string): boolean =>
  normalize(record.brand) === brand && normalize(record.shortDescription).includes(brand);

const matchingDescription = (record: ProductRecord, titlePattern: RegExp, descriptionPattern: RegExp): boolean =>
  titlePattern.test(normalize(record.title)) && descriptionPattern.test(normalize(record.shortDescription));

const packmatSubtype = (text: string): string | null =>
  /\bsobre camion\b/.test(text) ? "sobre camion" :
    /\bportacontenedores\b/.test(text) ? "portacontenedores" :
      /\bmovil\b/.test(text) ? "movil" : null;

const agreedEngine = (record: ProductRecord): boolean => {
  const title = normalize(record.title);
  const specified = record.specs?.["Tipo motor"];
  if (typeof specified !== "string") return true;
  const engine = fold(specified);
  if (/\bdiesel\b/.test(title)) return /\bdiesel\b/.test(engine) && !/\b(?:glp|lpg|electrico)\b/.test(engine);
  if (/\belectric[oa]\b/.test(title)) return /\belectric[oa]\b/.test(engine) && !/\b(?:diesel|glp|lpg)\b/.test(engine);
  return true;
};

export const gamDocumentedSourceType = (record: ProductRecord, route: string): boolean | undefined => {
  const title = normalize(record.title);
  const short = normalize(record.shortDescription);
  switch (route) {
    case "modula":
      return documentedBrand(record, "modula") &&
        matchingDescription(record, /\balmacen automatico\b/, /\balmacen automatico\b/);
    case "ormig":
      return documentedBrand(record, "ormig") &&
        matchingDescription(record, /\bgrua electrica\b/, /\bgrua electrica\b/);
    case "packmat":
      return documentedBrand(record, "packmat") &&
        matchingDescription(record, /\bcompactador(?:a)?\b/, /\bcompactador(?:a)?\b/) &&
        agreedEngine(record) && packmatSubtype(title) !== null &&
        packmatSubtype(title) === packmatSubtype(short);
    case "cte":
      return documentedBrand(record, "cte") &&
        matchingDescription(record, /\bplataforma sobre furgon\b/, /\bplataforma sobre furgon\b/);
    case "trenes-logisticos-tecnacar":
      return /\btren logistico\b/.test(title) && /\bremolque\b/.test(short) &&
        /\b(?:plataformas?|cargas)\b/.test(short) && /\btecnacar\b/.test(short) &&
        /\btecna/.test(normalize(record.brand));
    case "bts":
      return matchingDescription(record, /\barrastrador a pie\b/, /\barrastrador a pie\b/) &&
        /\btrailercaddy\b/.test(title) && /\btrailercaddy\b/.test(short) &&
        !(record.condition === "Nuevo" && /\bsegunda mano\b/.test(short)) &&
        recordedSpec(record, "Modelo").length > 0 &&
        short.includes(recordedSpec(record, "Modelo"));
    case "bravi":
      return documentedBrand(record, "bravi") &&
        matchingDescription(record, /\bplataforma elevadora\b/, /\bplataforma elevadora\b/);
    case "vehiculos-segunda-mano": {
      const brand = normalize(record.brand);
      return brand.length > 2 && title.includes(brand) &&
        recordedSpec(record, "Marca") === brand &&
        (recordedSpec(record, "Modelo") === "" || title.includes(recordedSpec(record, "Modelo"))) &&
        (["Matrícula", "Kilómetros"].some((key) => typeof record.specs?.[key] === "string" &&
          String(record.specs[key]).trim().length > 0) ||
          (/^[a-z0-9-]{6,}$/.test(recordedSpec(record, "Nº de serie")) &&
            recordedSpec(record, "Modelo").length > 0 &&
            /\bvehiculo\b/.test(normalize(record.longDescription)) &&
            /\bcoche\b/.test(normalize(record.longDescription))));
    }
    case "resto-maquinaria-segunda-mano":
      return /\bsemiremolque\b/.test(title) && /\bsemiremolque\b/.test(short) &&
        /\bnooteboom\b/.test(title) && normalize(record.brand) === "nooteboom";
    default:
      return undefined;
  }
};
