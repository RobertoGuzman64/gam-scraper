import type { ProductRecord } from "../../../../../contracts/catalog.js";

const normalize = (value: string): string => value.normalize("NFD")
  .replace(/[\u0300-\u036f]/gu, "").toLowerCase().replace(/[^a-z0-9]/gu, "");

const millimeters = (record: ProductRecord, key: string, minimum: number, maximum: number): string | null => {
  const raw = record.specs?.[key];
  if (typeof raw !== "string") return null;
  const match = /^([1-9]\d{2,4}) mm$/u.exec(raw.trim());
  const number = match?.[1] ? Number(match[1]) : null;
  return number !== null && number >= minimum && number <= maximum ? match?.[1] ?? null : null;
};

const kilograms = (record: ProductRecord): string | null => {
  const raw = record.specs?.Peso;
  if (typeof raw !== "string") return null;
  const match = /^([1-9]\d{3,4}) KG$/u.exec(raw.trim());
  const number = match?.[1] ? Number(match[1]) : null;
  return number !== null && number >= 2000 && number <= 90000 ? match?.[1] ?? null : null;
};

export const resolveGamYaleDieselDimensions = (record: ProductRecord, general: string | null): string | null => {
  const reference = record.reference;
  const model = record.model?.trim();
  const title = record.title?.trim();
  const short = record.shortDescription?.trim();
  const source = record.longDescription?.trim();
  if (record.providerId !== "gam" || record.categoryKey !== "carretillas-nuevas" ||
    record.condition !== "Nuevo" || record.brand !== "YALE" || !reference || !model ||
    !title || !short || !source || !general || general !== source ||
    record.specs?.Marca !== "YALE" || record.specs?.Modelo !== model ||
    (record.specs?.Motorización !== "Diésel" && record.specs?.["Tipo motor"] !== "Diésel") ||
    (record.externalReference && normalize(record.externalReference) !== normalize(model)) ||
    !normalize(title).includes(normalize(`YALE ${model}`)) ||
    !normalize(short).includes(normalize(`YALE ${model}`)) ||
    (!normalize(source).includes(normalize("YALE")) || !normalize(source).includes(normalize(model))) ||
    !/di[eé]sel/iu.test(source)) return null;

  try {
    const url = new URL(record.url);
    const path = url.pathname.split("/").filter(Boolean);
    if (url.protocol !== "https:" || url.hostname !== "online.gamrentals.com" ||
      path.length !== 3 || path[0] !== "es" || path[1] !== "carretillas-elevadora-diesel-yale" ||
      !path[2]?.startsWith(`${reference}-`) || !normalize(path[2]).includes(normalize(model)) ||
      url.search || url.hash) return null;
  } catch {
    return null;
  }

  const length = millimeters(record, "Longitud", 2000, 15000);
  const width = millimeters(record, "Anchura", 600, 3500);
  const height = millimeters(record, "Altura", 1000, 6000);
  const weight = kilograms(record);
  if (!length || !width || !height || !weight || Number(length) <= Number(width) ||
    [length, width, height, weight].some((value) =>
      new RegExp(`(^|\\D)${value}(\\D|$)`, "u").test(source))) return null;

  return `Según la ficha técnica del modelo YALE ${model}, sus dimensiones declaradas son ` +
    `${length} mm de longitud, ${width} mm de anchura y ${height} mm de altura, ` +
    `con un peso indicado de ${weight} kg.\n\n${general}`;
};
