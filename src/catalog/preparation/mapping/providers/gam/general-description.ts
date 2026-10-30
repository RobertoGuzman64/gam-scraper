import type { ProductRecord } from "../../../../../contracts/catalog.js";

const equalDescriptions = (record: ProductRecord): boolean =>
  Boolean(record.shortDescription?.trim() && record.shortDescription.trim() === record.longDescription?.trim());

const source = (record: ProductRecord, key: string): string | null => {
  const value = record.specs?.[key];
  return typeof value === "string" && value.trim() ? value.trim() : null;
};

const integerMeasurement = (record: ProductRecord, key: string, unit: "mm" | "KG"): number | null => {
  const value = source(record, key);
  if (!value) return null;
  const match = /^(\d+)\s*(mm|kg)$/i.exec(value);
  if (!match?.[1] || match[2]?.toLowerCase() !== unit.toLowerCase()) return null;
  const number = Number(match[1]);
  return Number.isSafeInteger(number) && number > 0 ? number : null;
};

const normalized = (value: string): string => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "")
  .toLowerCase().replace(/[^a-z0-9]/g, "");

const ownIdentity = (record: ProductRecord): boolean => {
  if (record.providerId !== "gam" || !record.reference || !record.title) return false;
  try {
    const url = new URL(record.url);
    return url.protocol === "https:" && url.hostname === "online.gamrentals.com" &&
      url.pathname.split("/").at(-1)?.startsWith(`${record.reference}-`) === true &&
      !url.search && !url.hash;
  } catch {
    return false;
  }
};

const sourceSlug = (record: ProductRecord): string =>
  normalized(new URL(record.url).pathname.split("/").at(-1) ?? "");

const loadCapacity = (record: ProductRecord): number | null => {
  const capacity = integerMeasurement(record, "Capacidad de carga (kg)", "KG");
  if (capacity === null || capacity < 100 || capacity > 100000 || !record.shortDescription) return null;
  const mentioned = [...record.shortDescription.matchAll(/(\d[\d.,\s]*)\s*kg\b/gi)]
    .map((match) => Number((match[1] ?? "").replace(/[^\d]/g, "")));
  return mentioned.length === 1 && mentioned[0] === capacity ? capacity : null;
};

const dimensions = (record: ProductRecord): { readonly length: number; readonly width: number } | null => {
  const length = integerMeasurement(record, "Longitud", "mm");
  const width = integerMeasurement(record, "Anchura", "mm");
  if (length === null || width === null || length < 300 || width < 300 ||
    length > 20000 || width > length) return null;
  return { length, width };
};

const handlingGeneral = (record: ProductRecord): string | null => {
  if (!equalDescriptions(record) || !record.model || !record.brand || !record.title ||
    !record.shortDescription?.startsWith("➨") || record.condition !== "Nuevo" ||
    !["apiladores-nuevos", "carretillas-nuevas"].includes(record.categoryKey)) return null;

  const brand = source(record, "Marca");
  const model = source(record, "Modelo");
  if (!brand || !model || normalized(brand) !== normalized(record.brand) ||
    normalized(model) !== normalized(record.model) ||
    !normalized(record.title).includes(normalized(record.brand)) ||
    !normalized(record.title).endsWith(normalized(record.model)) ||
    !sourceSlug(record).endsWith(normalized(record.model)) ||
    normalized(record.shortDescription.split("➨")[1] ?? "") !== normalized(`${record.brand} ${record.model}`)) return null;

  const capacity = loadCapacity(record);
  const titledCapacity = [...record.title.matchAll(/(\d[\d.,\s]*)\s*kg\b/gi)]
    .map((match) => Number((match[1] ?? "").replace(/[^\d]/g, "")));
  if (titledCapacity.some((value) => value !== capacity)) return null;
  const size = dimensions(record);
  if (capacity === null || !size) return null;
  const engine = source(record, "Motorización");
  if (engine && ((normalized(engine) === "electrico") !== /el[eé]ctric[oa]/i.test(record.title))) return null;
  if (engine && !["Eléctrico", "Diésel", "GLP"].includes(engine)) return null;

  const height = integerMeasurement(record, "Altura", "mm");
  if (record.specs?.Altura !== undefined && height === null) return null;
  const weight = integerMeasurement(record, "Peso", "KG");
  if (record.specs?.Peso !== undefined && weight === null) return null;

  return `La ficha técnica de ${record.title} identifica el modelo ${record.model} de ${record.brand}. ` +
    `Su capacidad de carga publicada es de ${capacity} kg. ` +
    `El equipo mide ${size.length} mm de largo y ${size.width} mm de ancho` +
    `${height !== null ? `, con ${height} mm de altura` : ""}.` +
    `${weight !== null ? ` Su peso publicado es de ${weight} kg.` : ""}`;
};

const funeralGeneral = (record: ProductRecord): string | null => {
  if (record.categoryKey !== "portaferetros" || record.condition !== "Nuevo" ||
    record.longDescription?.trim() !== "Equipamiento Estándar:" ||
    !record.model || !record.title || !record.shortDescription ||
    !/^Portaf[eé]retros? /i.test(record.title) ||
    !normalized(record.title).endsWith(normalized(record.model)) ||
    !sourceSlug(record).endsWith(normalized(record.model)) ||
    normalized(source(record, "Modelo") ?? "") !== normalized(record.model) ||
    !/portaf[eé]retros?/i.test(record.shortDescription)) return null;

  const capacity = integerMeasurement(record, "Capacidad de carga (kg)", "KG");
  const size = dimensions(record);
  const givenHeight = source(record, "Altura de trabajo (m)");
  const measured = givenHeight ? /^(\d+(?:[.,]\d{1,2})?)\s*metros?$/i.exec(givenHeight) : null;
  const said = /\b(\d+(?:[.,]\d{1,2})?)\s*metros?\b/i.exec(record.shortDescription);
  if (capacity === null || capacity > 1000 || !size || !measured?.[1] || !said?.[1] ||
    Number(measured[1].replace(",", ".")) !== Number(said[1].replace(",", "."))) return null;

  const statedLoads = [...record.shortDescription.matchAll(/(\d[\d.,\s]*)\s*kg\b/gi)]
    .map((match) => Number((match[1] ?? "").replace(/[^\d]/g, "")));
  if (statedLoads.some((value) => value !== capacity)) return null;
  const traction = source(record, "Tracción");
  if (traction && !((/^manual/i.test(traction) && /manual/i.test(record.shortDescription)) ||
    (/^el[eé]ctric/i.test(traction) && /el[eé]ctric/i.test(record.shortDescription)))) return null;

  return `${record.shortDescription.trim()} ` +
    `La ficha técnica del modelo ${record.model} indica una capacidad de carga de ${capacity} kg, ` +
    `una longitud de ${size.length} mm y una anchura de ${size.width} mm.`;
};

const modularGeneral = (record: ProductRecord): string | null => {
  if (!equalDescriptions(record) || record.categoryKey !== "otros" ||
    !record.title || record.title.trim() !== record.shortDescription?.trim() ||
    !/^m[oó]dulo ba[nñ]o /i.test(record.title) ||
    record.model || record.brand || !record.reference ||
    !sourceSlug(record).endsWith(normalized(record.title))) return null;
  const size = dimensions(record);
  const height = integerMeasurement(record, "Altura", "mm");
  const weight = integerMeasurement(record, "Peso", "KG");
  if (!size || height === null || weight === null) return null;
  const kind = record.title.toLocaleLowerCase("es").replace(/^m[oó]dulo ba[nñ]o /i, "").replace(/\bwc\b/g, "WC");
  return `El módulo de baño ${kind} figura en la ficha del proveedor con ` +
    `${size.length} mm de longitud, ${size.width} mm de anchura y ${height} mm de altura. ` +
    `El peso publicado es de ${weight} kg.`;
};

const usedSweeperGeneral = (record: ProductRecord): string | null => {
  if (!equalDescriptions(record) || record.categoryKey !== "manutencion" ||
    !record.title || !/^Barredora /i.test(record.title) ||
    !record.brand || !record.model ||
    normalized(source(record, "Marca") ?? "") !== normalized(record.brand) ||
    normalized(source(record, "Modelo") ?? "") !== normalized(record.model) ||
    !normalized(record.title).endsWith(normalized(`${record.brand} ${record.model}`)) ||
    !sourceSlug(record).endsWith(normalized(record.model)) ||
    !normalized(record.shortDescription ?? "").includes(normalized(`${record.brand} ${record.model}`))) return null;

  const hours = source(record, "Horómetro");
  const match = hours ? /^(\d{1,6})\s*horas$/i.exec(hours) : null;
  const size = dimensions(record);
  const height = integerMeasurement(record, "Altura", "mm");
  const weight = integerMeasurement(record, "Peso", "KG");
  if (!match?.[1] || Number(match[1]) > 100000 || !size || height === null || weight === null) return null;
  if (record.horometer && record.horometer.trim() !== hours) return null;

  return `La barredora ${record.brand} ${record.model} registra ${match[1]} horas de uso en su ficha. ` +
    `Sus dimensiones publicadas son ${size.length} mm de longitud, ${size.width} mm de anchura ` +
    `y ${height} mm de altura. El peso indicado es de ${weight} kg.`;
};

const electricPlatformGeneral = (record: ProductRecord): string | null => {
  if (!equalDescriptions(record) || record.categoryKey !== "elevacion-nueva" ||
    record.condition !== "Nuevo" || !record.brand || !record.model || !record.title ||
    normalized(source(record, "Marca") ?? "") !== normalized(record.brand) ||
    normalized(source(record, "Modelo") ?? "") !== normalized(record.model) ||
    !normalized(record.title).endsWith(normalized(`${record.brand} ${record.model}`)) ||
    !sourceSlug(record).endsWith(normalized(record.model))) return null;

  const titleHeight = /^Plataforma articulada el[eé]ctrica\s+(\d{1,2})M\b/i.exec(record.title);
  const sourceHeight = source(record, "Altura de elevación (m)");
  const heightMatch = sourceHeight ? /^(\d{1,2}(?:[.,]\d{1,2})?)\s*metros?$/i.exec(sourceHeight) : null;
  const short = record.shortDescription ?? "";
  const heightShort = /el[eé]ctrica de (\d{1,2}(?:[.,]\d{1,2})?) metros? de altura/i.exec(short);
  const capacity = loadCapacity(record);
  const size = dimensions(record);
  const weight = integerMeasurement(record, "Peso", "KG");
  const battery = source(record, "Tipo de batería");
  if (!titleHeight?.[1] || !heightMatch?.[1] || !heightShort?.[1] || capacity === null ||
    Number(titleHeight[1]) !== Number(heightMatch[1].replace(",", ".")) ||
    Number(titleHeight[1]) !== Number(heightShort[1].replace(",", ".")) ||
    /\bdi[eé]sel\b/i.test(`${record.title} ${short}`) ||
    !normalized(short).includes(normalized(record.model)) || !size || weight === null ||
    battery !== "Batería de litio") return null;

  return `La plataforma articulada eléctrica ${record.brand} ${record.model} tiene una altura de elevación ` +
    `publicada de ${titleHeight[1]} m y una capacidad de cesta de ${capacity} kg. ` +
    `Su ficha indica batería de litio, ${size.length} mm de longitud, ${size.width} mm de anchura ` +
    `y un peso de ${weight} kg.`;
};

const orderPickerGeneral = (record: ProductRecord): string | null => {
  if (!equalDescriptions(record) || record.categoryKey !== "carretillas-nuevas" ||
    record.condition !== "Nuevo" || !record.brand || !record.model || !record.title ||
    !/^Recogepedidos contrapesada/i.test(record.title) ||
    normalized(source(record, "Marca") ?? "") !== normalized(record.brand) ||
    normalized(source(record, "Modelo") ?? "") !== normalized(record.model) ||
    !normalized(record.title).endsWith(normalized(`${record.brand} ${record.model}`)) ||
    !sourceSlug(record).endsWith(normalized(record.model)) ||
    !normalized(record.shortDescription ?? "").includes(normalized(record.model))) return null;

  const capacity = loadCapacity(record);
  const titledCapacity = /(\d+)\s*kg\b/i.exec(record.title);
  const height = integerMeasurement(record, "Altura de elevación (mm)", "mm");
  const weight = integerMeasurement(record, "Peso", "KG");
  if (capacity === null || titledCapacity?.[1] !== String(capacity) || height === null ||
    height < 500 || height > 30000 || weight === null) return null;

  return `El recogepedidos contrapesado ${record.brand} ${record.model} tiene una capacidad de carga ` +
    `publicada de ${capacity} kg. Su ficha técnica indica una altura de elevación de ${height} mm ` +
    `y un peso de ${weight} kg.`;
};

export const resolveGamGeneralDescription = (record: ProductRecord): string | null =>
  ownIdentity(record) ? funeralGeneral(record) ?? modularGeneral(record) ?? handlingGeneral(record) ??
    usedSweeperGeneral(record) ?? electricPlatformGeneral(record) ?? orderPickerGeneral(record) : null;
