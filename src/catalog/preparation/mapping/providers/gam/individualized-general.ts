import type { ProductRecord } from "../../../../../contracts/catalog.js";

const normalize = (value: string): string => value.normalize("NFD")
  .replace(/[\u0300-\u036f]/gu, "").toLowerCase().replace(/[^a-z0-9]/gu, "");

const specification = (record: ProductRecord, key: string): string | null => {
  const value = record.specs?.[key];
  return typeof value === "string" && value.trim() ? value.trim() : null;
};

const ownUrl = (record: ProductRecord, families: readonly string[], identity: string): boolean => {
  try {
    const url = new URL(record.url);
    const path = url.pathname.split("/").filter(Boolean);
    const slug = path[2] ?? "";
    return url.protocol === "https:" && url.hostname === "online.gamrentals.com" &&
      path.length === 3 && path[0] === "es" && families.includes(path[1] ?? "") &&
      slug.startsWith(`${record.reference}-`) && normalize(slug).includes(normalize(identity)) &&
      !url.search && !url.hash;
  } catch {
    return false;
  }
};

const integerUnit = (value: string | null, unit: "mm" | "KG", minimum: number, maximum: number): string | null => {
  const match = value ? /^(\d+)\s*(mm|kg)$/iu.exec(value) : null;
  const amount = match?.[1] ? Number(match[1]) : null;
  return amount !== null && Number.isSafeInteger(amount) && amount >= minimum && amount <= maximum &&
    match?.[2]?.toLowerCase() === unit.toLowerCase() ? String(amount) : null;
};

const generator = (record: ProductRecord): string | null => {
  const model = record.model?.trim();
  const title = record.title?.trim();
  const short = record.shortDescription?.trim();
  const general = record.longDescription?.trim();
  if (record.condition !== "Nuevo" || record.categoryKey !== "otros-nuevos" ||
    record.brand !== "PRAMAC" || !model || !title || !short || !general ||
    specification(record, "Marca") !== "PRAMAC" ||
    normalize(specification(record, "Modelo") ?? "") !== normalize(model) ||
    (record.externalReference && normalize(record.externalReference) !== normalize(model)) ||
    !/^GSW\d{2,4}[PMV]$/u.test(model) ||
    !normalize(title).includes(normalize(`PRAMAC ${model}`)) ||
    (!normalize(short).includes(normalize("PRAMAC")) || !normalize(short).includes(normalize(model))) ||
    !/^La bancada se realiza en perfil de acero completo con soportes antivibración adecuadamente dimensionados/u.test(general) ||
    general.includes(model) || !ownUrl(record, ["grupos-electrogenos-nuevos", "grupos-electrogenos-menores-815kvs-pramac",
      "grupos-electrogenos-mayores-815kvs-pramac", "pramac"], model)) return null;

  const engine = specification(record, "Marca motor");
  const maker = engine?.split(/\s+/u)[0] ?? "";
  const length = integerUnit(specification(record, "Longitud"), "mm", 1500, 10000);
  const width = integerUnit(specification(record, "Anchura"), "mm", 700, 4000);
  const height = integerUnit(specification(record, "Altura"), "mm", 900, 5000);
  const weight = integerUnit(specification(record, "Peso"), "KG", 500, 30000);
  const power = specification(record, "Potencia Motor (KW)");
  if (!maker || !/^(?:Perkins|Volvo|MTU)$/iu.test(maker) ||
    !normalize(short).includes(normalize(maker)) ||
    !engine || !/^[\p{L}\p{N}\s.\-/]+$/u.test(engine) ||
    !length || !width || !height || !weight || Number(width) > Number(length) ||
    !power || !/^\d+(?:\.\d+)?\s*\/\s*\d+(?:\.\d+)?$/u.test(power)) return null;

  return `El grupo electrógeno PRAMAC ${model} tiene como motor declarado ${engine}, ` +
    `con potencias de motor indicadas de ${power} kW. La ficha de este modelo recoge ` +
    `${length} mm de longitud, ${width} mm de anchura, ${height} mm de altura y ${weight} kg de peso.\n\n${general}`;
};

const usedCar = (record: ProductRecord): string | null => {
  const title = record.title?.trim();
  const general = record.longDescription?.trim();
  const short = record.shortDescription?.trim();
  if (record.condition !== "Segunda mano" || record.categoryKey !== "movilidad" ||
    !title || !general || short !== title ||
    !general.startsWith("? Vehículo en Perfecto Estado – Recién Revisado y Listo para Rodar ?") ||
    !ownUrl(record, ["vehiculos-segunda-mano"], title)) return null;
  const year = specification(record, "Año de fabricación");
  const kilometers = specification(record, "Kilómetros");
  const location = specification(record, "Ubicación");
  const date = year && /^(?:19|20)\d{2}$/u.test(year) ? Number(year) : null;
  const distance = kilometers ? /^(\d{1,7})\s*KM$/iu.exec(kilometers) : null;
  if (date === null || date > 2026 || !distance?.[1] ||
    Number(distance[1]) > 999999 || !location || !/^[\p{L}\s-]{3,40}$/u.test(location)) return null;
  return `El vehículo ${title} figura con año de fabricación ${year}, ` +
    `${Number(distance[1])} km registrados y ubicación ${location}, según su ficha de origen.\n\n${general}`;
};

export const resolveGamIndividualizedGeneral = (record: ProductRecord): string | null =>
  record.providerId === "gam" && record.reference ? generator(record) ?? usedCar(record) : null;
