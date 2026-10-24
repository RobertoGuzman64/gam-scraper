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

const documentedForkliftFamily = (record: ProductRecord, title: string, short: string): boolean => {
  const model = recordedSpec(record, "Modelo");
  const engine = recordedSpec(record, "Tipo motor");
  const drive = recordedSpec(record, "Motorización");
  const long = normalize(record.longDescription);
  const sourceBrand = recordedSpec(record, "Marca");
  const confirmedBrand = normalize(record.brand) === "hyster" && sourceBrand === "hyster" ||
    !record.brand && !sourceBrand && /\bhyster\b/.test(title) && /\bhyster\b/.test(long) &&
    recordedSpec(record, "Tipo máquina") === "carretillas elevadoras diesel";
  return record.categoryKey === "carretillas-nuevas" && confirmedBrand && model.length >= 4 &&
    (!record.model?.trim() || normalize(record.model) === model) &&
    /\bcarretilla elevadora\b/.test(title) && title.includes(model) &&
    /\bcarretilla elevadora\b/.test(short) && short.includes(model) &&
    /\bcarretillas?\b/.test(long) && long.includes(model) &&
    /\bdiesel\b/.test(engine) && /\b(?:glp|lpg|dual fuel)\b/.test(engine) &&
    !/\b(?:electrica|electrico|hibrida|hibrido)\b/.test(`${title} ${short} ${long} ${engine} ${drive}`) &&
    (drive === "" || drive === "diesel");
};

const documentedMixedFuelForklift = (record: ProductRecord, title: string, short: string): boolean => {
  if (record.categoryKey !== "carretillas-nuevas" || record.condition !== "Nuevo" ||
    normalize(record.brand) !== "hyster" || recordedSpec(record, "Marca") !== "hyster") return false;
  const model = recordedSpec(record, "Modelo");
  const long = normalize(record.longDescription);
  const engine = recordedSpec(record, "Tipo motor");
  return model.length >= 4 && normalize(record.model) === model &&
    title === `carretilla elevadora hyster ${model}` &&
    /^la carretilla hyster\b/.test(short) && short.includes(model) &&
    long.startsWith(`la hyster ${model} es una carretilla elevadora contrapesada`) &&
    /\bdisponible en versiones glp o diesel\b/.test(long) &&
    /\bdiesel\b/.test(engine) && /\bglp\b/.test(engine) &&
    recordedSpec(record, "Motorización") === "diesel" &&
    recordedSpec(record, "Tipo máquina") === "carretillas elevadoras diesel";
};

const documentedGasForklift = (record: ProductRecord, title: string, short: string): boolean => {
  if (record.providerId !== "gam" || record.categoryKey !== "carretillas-nuevas" ||
    record.condition !== "Nuevo" || normalize(record.brand) !== "hyster" ||
    recordedSpec(record, "Marca") !== "hyster") return false;
  const model = recordedSpec(record, "Modelo");
  const long = normalize(record.longDescription);
  const engine = recordedSpec(record, "Tipo motor");
  const drive = recordedSpec(record, "Motorización");
  const slug = new URL(record.url).pathname.split("/").filter(Boolean)[2] ?? "";
  const suffix = normalize(record.model).replace(/[^a-z0-9]/g, "");
  return /^\d+$/.test(record.reference ?? "") &&
    slug === `${record.reference}-carretilla-elevadora-glp-hyster-${suffix}` &&
    model.length >= 4 && normalize(record.model) === model && engine === "glp" &&
    (drive === "" || drive === "glp") &&
    title === `carretilla elevadora glp hyster ${model}` &&
    short.startsWith(`➨ hyster ${model} nueva ➨ venta de carretilla elevadora glp `) &&
    long.startsWith(`la carretilla elevadora glp hyster ${model} es`) &&
    long.includes("motor de glp") && !long.includes("diesel");
};

const documentedUsedCar = (record: ProductRecord, title: string): boolean => {
  const long = normalize(record.longDescription);
  const plate = recordedSpec(record, "Matrícula");
  const kilometers = recordedSpec(record, "Kilómetros");
  return record.condition === "Segunda mano" && record.categoryKey === "movilidad" &&
    /\bvehiculo\b/.test(long) && /\bcoche\b/.test(long) &&
    /^[a-z0-9-]{5,14}$/.test(plate) && /^\d[\d.,]*\s*km$/.test(kilometers) &&
    /^\d{4}$/.test(recordedSpec(record, "Año de fabricación")) &&
    title.length >= 10 && title === normalize(record.shortDescription) &&
    recordedSpec(record, "Modelo").length >= 5;
};

const documentedElectricQuadricycle = (record: ProductRecord, title: string, short: string): boolean => {
  const long = normalize(record.longDescription);
  const model = recordedSpec(record, "Modelo");
  return record.categoryKey === "maquinaria" && record.condition === "Segunda mano" &&
    normalize(record.brand).length > 2 && recordedSpec(record, "Marca") === normalize(record.brand) &&
    model.length >= 3 && title.includes(model) && short.includes(model) && long.includes(model) &&
    /\bcuatriciclo electrico\b/.test(short) && /\bcuatriciclo electrico\b/.test(long) &&
    /^[a-z0-9-]{5,14}$/.test(recordedSpec(record, "Matrícula"));
};

const documentedEquipmentCart = (record: ProductRecord, title: string, short: string): boolean => {
  const model = recordedSpec(record, "Modelo");
  const brand = recordedSpec(record, "Marca");
  const long = normalize(record.longDescription);
  return record.categoryKey === "otros" && normalize(record.brand) === "knott" && brand === "knott" &&
    model.length >= 4 && normalize(record.model) === model &&
    /^carro de arrastre\b/.test(title) && /^carro de arrastre\b/.test(short) &&
    title.includes(model) && short.includes(model) && long.includes(model) &&
    /\b2000\s*kg\b/.test(title) && /\b2000\s*kg\b/.test(short) &&
    /\bano de fabricacion 2019\b/.test(short) &&
    record.year === "2019";
};

const documentedStructure = (record: ProductRecord, title: string, short: string): boolean =>
  record.categoryKey === "otros" &&
  /^modulo bano (?:unitario|doble wc)$/.test(title) &&
  title === short && title === normalize(record.longDescription) &&
  ["Longitud", "Anchura", "Altura"].every((key) => {
    const reading = record.specs?.[key];
    return typeof reading === "string" && /^\d{3,5}\s*mm$/i.test(reading);
  }) && typeof record.specs?.["Peso"] === "string" &&
  /^\d{2,5}\s*kg$/i.test(record.specs["Peso"]);

const documentedLot = (record: ProductRecord, title: string, short: string): boolean => {
  if (record.categoryKey !== "maquinaria" || !/^\d{1,10}$/.test(record.reference ?? "") ||
    Object.keys(record.specs ?? {}).length !== 0 ||
    !/^lote \d{1,3}$/.test(title)) return false;
  const description = normalize(record.longDescription);
  const identity = title.match(/^lote (\d{1,3})$/)?.[1];
  return identity !== undefined && short === description &&
    /\beste lote completo\b/.test(description) &&
    /\bcompra individual de los equipos\b/.test(description) &&
    new RegExp(`(?:^|/)${record.reference}-lote-${identity}$`).test(new URL(record.url).pathname);
};

const documentedRegisteredTransportPlatform = (record: ProductRecord, title: string, short: string): boolean => {
  if (record.categoryKey !== "otros" || record.condition !== "Segunda mano" ||
    normalize(record.brand) !== "nooteboom" || recordedSpec(record, "Marca") !== "nooteboom") return false;
  const normalizedTitle = title.replace(/\bplatafora\b/g, "plataforma").replace(/\bnoteboom\b/g, "nooteboom");
  const normalizedShort = short.replace(/\bplatafora\b/g, "plataforma").replace(/\bnoteboom\b/g, "nooteboom");
  const model = recordedSpec(record, "Modelo");
  if (model.length < 3 || normalize(record.model) !== model ||
    normalizedTitle !== normalizedShort ||
    !/^plataforma 4 ejes nooteboom\b/.test(normalizedTitle) ||
    !normalizedTitle.endsWith(` ${model}`)) return false;
  const serial = recordedSpec(record, "Nº de serie").toUpperCase();
  const plate = recordedSpec(record, "Matrícula").toUpperCase();
  const description = normalize(record.longDescription);
  return /^[A-Z0-9]{17}$/.test(serial) && /^[A-Z]{1,2}-\d{4,5}-[A-Z]{1,2}$/.test(plate) &&
    /\bequipo matriculado\b/.test(description) && /\bitv vigente\b/.test(description) &&
    /^\d{4}$/.test(recordedSpec(record, "Año de fabricación")) &&
    recordedSpec(record, "Año de fabricación") === record.year;
};

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
    case "carro-de-equipaje":
      return documentedEquipmentCart(record, title, short);
    case "estructuras":
      return documentedStructure(record, title, short);
    case "lotes":
      return documentedLot(record, title, short);
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
    case "trenes-logisticos-tecnacar": {
      const model = recordedSpec(record, "Modelo");
      const long = normalize(record.longDescription);
      return /\btren logistico\b/.test(title) && /\bremolque\b/.test(short) &&
        /\b(?:plataformas?|cargas)\b/.test(short) && /\btecnacar\b/.test(long) &&
        /\btrenes logisticos\b/.test(long) && /\btecna/.test(normalize(record.brand)) &&
        model.length >= 4 && title.includes(model) && short.includes(model);
    }
    case "carretillas-elevadoras-diesel-hyster":
      return documentedForkliftFamily(record, title, short) || documentedMixedFuelForklift(record, title, short) ||
        documentedGasForklift(record, title, short) ? true : undefined;
    case "furgonetas-electricas-de-ocasion":
      return documentedElectricQuadricycle(record, title, short);
    case "tennant": {
      const model = recordedSpec(record, "Modelo");
      const long = normalize(record.longDescription);
      if (record.categoryKey !== "limpieza-barredoras" || !/\bbarredora fregadora\b/.test(title)) return undefined;
      return normalize(record.brand) === "tennant" && recordedSpec(record, "Marca") === "tennant" &&
        model.length >= 4 && title.includes(model) && short.includes(model) && long.includes(model) &&
        /\bbarredora fregadora\b/.test(short) && /\bbarredora fregadora\b/.test(long) &&
        /\bbarrido\b/.test(long) && /\bfregado\b/.test(long);
    }
    case "plataformas-elevadoras-bravi": {
      const model = recordedSpec(record, "Modelo");
      const long = normalize(record.longDescription);
      if (!/\bkit de elevacion\b/.test(title)) return undefined;
      return normalize(record.brand) === "bravi" && recordedSpec(record, "Marca") === "bravi" &&
        model.length >= 4 && title.includes(model) && short.includes(model) && long.includes(model) &&
        /\baccesorio de elevacion\b/.test(short) && /\baccesorio\b/.test(long) &&
        /\bleonardo hd\b/.test(short) && /\bleonardo hd\b/.test(long);
    }
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
      if (documentedUsedCar(record, title)) return true;
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
      return documentedRegisteredTransportPlatform(record, title, short) ||
        (/\bsemiremolque\b/.test(title) && /\bsemiremolque\b/.test(short) &&
          /\bnooteboom\b/.test(title) && normalize(record.brand) === "nooteboom");
    default:
      return undefined;
  }
};
