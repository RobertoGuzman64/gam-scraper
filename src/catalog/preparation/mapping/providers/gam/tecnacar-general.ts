import type { ProductRecord } from "../../../../../contracts/catalog.js";

const normalized = (value: string): string => value.normalize("NFD")
  .replace(/[\u0300-\u036f]/gu, "").toLowerCase().replace(/[^a-z0-9]/gu, "");

const source = (record: ProductRecord, key: string): string | null => {
  const value = record.specs?.[key];
  return typeof value === "string" && value.trim() ? value.trim() : null;
};

const measurement = (record: ProductRecord, key: string, unit: "mm" | "kg" | "N"): number | null => {
  const value = source(record, key);
  const match = value ? /^(\d+)\s*(mm|kg|N)$/iu.exec(value) : null;
  if (!match?.[1] || match[2]?.toLowerCase() !== unit.toLowerCase()) return null;
  const number = Number(match[1]);
  return Number.isSafeInteger(number) && number > 0 ? number : null;
};

const ownIdentity = (record: ProductRecord, family: string, requiresLongModel = true): boolean => {
  if (record.providerId !== "gam" || record.condition !== "Nuevo" || !record.reference ||
    !record.model || !record.title || !record.shortDescription || !record.longDescription ||
    record.brand !== "TECNA" || source(record, "Marca") !== "TECNA" ||
    normalized(source(record, "Modelo") ?? "") !== normalized(record.model) ||
    (record.externalReference && normalized(record.externalReference) !== normalized(record.model)) ||
    !normalized(record.title).includes(normalized(record.model)) ||
    !normalized(record.shortDescription).includes(normalized(record.model)) ||
    (requiresLongModel && !normalized(record.longDescription).includes(normalized(record.model)))) return false;
  try {
    const url = new URL(record.url);
    const parts = url.pathname.split("/").filter(Boolean);
    return url.protocol === "https:" && url.hostname === "online.gamrentals.com" &&
      parts[0] === "es" && parts[1] === family &&
      parts[2]?.startsWith(`${record.reference}-`) === true &&
      normalized(parts[2] ?? "").includes(normalized(record.model)) &&
      !url.search && !url.hash;
  } catch {
    return false;
  }
};

const tractorGeneral = (record: ProductRecord): string | null => {
  if (record.categoryKey !== "otros-nuevos" ||
    !ownIdentity(record, "tractores-electricos-de-arrastre-tecnacar") ||
    !/^Tractor eléctrico de arrastre Tecnacar VTA\s?\d{3}(?: \d+kg)?$/iu.test(record.title ?? "") ||
    !/^VTA\s?\d{3}$/iu.test(record.model ?? "") ||
    !/tractor eléctrico de arrastre/iu.test(record.shortDescription ?? "") ||
    source(record, "Motorización") !== "Eléctrico") return null;

  const model = normalized(record.model ?? "");
  const series = `${model.charAt(3)}00`;
  const general = record.longDescription?.trim() ?? "";
  if (!general.startsWith("Tecnacar ha desarrollado el Sistema de Control de Tracción TCS") ||
    !general.endsWith(`se encuentra dentro de la VTA ${series} Series de Tecnacar.`) ||
    general.split(/\s+/u).length !== 61) return null;

  const capacity = measurement(record, "Capacidad de carga (kg)", "kg");
  const shortLoads = [...(record.shortDescription ?? "").matchAll(/(\d+)\s*kg\b/giu)]
    .map((match) => Number(match[1]));
  const titleLoads = [...(record.title ?? "").matchAll(/(\d+)\s*kg\b/giu)]
    .map((match) => Number(match[1]));
  if (capacity === null || capacity < 1000 || capacity > 50000 ||
    shortLoads.length !== 2 || shortLoads.some((value) => value !== capacity) ||
    titleLoads.some((value) => value !== capacity)) return null;

  const length = measurement(record, "Longitud", "mm");
  const width = measurement(record, "Anchura", "mm");
  const height = measurement(record, "Altura", "mm");
  const weight = measurement(record, "Peso", "kg");
  const nominal = measurement(record, "Tiro a la barra nominal", "N");
  const maximum = measurement(record, "Máximo tiro a la barra", "N");
  const velocity = source(record, "Velocidad de desplazamiento con/sin carga");
  const speeds = velocity ? /^(\d{1,2})\s*\/\s*(\d{1,2})\s*km\/h$/iu.exec(velocity) : null;
  if (["Longitud", "Altura", "Peso", "Tiro a la barra nominal", "Máximo tiro a la barra"].some((key) =>
    source(record, key) !== null && (key === "Peso" ? weight === null :
      key === "Longitud" ? length === null : key === "Altura" ? height === null :
        key === "Tiro a la barra nominal" ? nominal === null : maximum === null))) return null;
  if (width === null || width < 500 || width > 4000 ||
    (length !== null && (length < width || length > 8000)) ||
    (height !== null && (height < 700 || height > 4000)) ||
    (weight !== null && (weight < 500 || weight > 10000)) ||
    (nominal !== null && (nominal < 100 || nominal > 15000)) ||
    (maximum !== null && (nominal === null || maximum < nominal || maximum > 30000)) ||
    (velocity !== null && (!speeds?.[1] || !speeds[2] ||
      Number(speeds[1]) > Number(speeds[2]) || Number(speeds[2]) > 40))) return null;
  if (length === null && nominal === null) return null;

  const dimensions = length !== null
    ? `El equipo mide ${length} mm de longitud y ${width} mm de anchura`
    : `La anchura indicada para esta variante es de ${width} mm`;
  const heightText = height !== null ? `, con ${height} mm de altura` : "";
  const details = [
    weight !== null ? `El peso publicado es de ${weight} kg.` : null,
    nominal !== null ? `El tiro nominal a la barra es de ${nominal} N${maximum !== null ? ` y el máximo indicado de ${maximum} N` : ""}.` : null,
    speeds ? `La velocidad especificada es de ${speeds[1]} km/h con carga y ${speeds[2]} km/h sin carga.` : null
  ].filter((item): item is string => item !== null);

  return `${general}\n\nLa ficha del tractor ${record.model} indica una capacidad de carga de ${capacity} kg. ` +
    `${dimensions}${heightText}. ${details.join(" ")}`;
};

const logisticGeneral = (record: ProductRecord): string | null => {
  if (record.categoryKey !== "marcas-nuevas" ||
    !ownIdentity(record, "trenes-logisticos-tecnacar", false) ||
    !/^Tren logístico Tecnacar (?:R-Portal|E-Frame Simple|E-Frame Doble)$/u.test(record.title ?? "") ||
    record.longDescription?.trim() !== "Tecnacar es fabricante de trenes logísticos: soluciones innovadoras y ergonómicas, productos que se adaptan a las especificaciones técnicas que se demanden, material personalizado y una excelente estabilidad direccional.") return null;

  const options = {
    "R-Portal": {
      reference: "299", capacity: 600,
      description: "Este remolque pórtico permite cargar y descargar plataformas rodantes por ambos lados. " +
        "Dispone de bloqueo del carro y lo transporta apoyado sobre sus propias ruedas."
    },
    "E-Frame Simple": {
      reference: "297", capacity: 1000,
      description: "El sistema de tipo madre-hija transporta una plataforma dentro de la estructura del remolque, " +
        "sin que el carro mantenga contacto con el suelo. La elevación puede ser eléctrica o hidráulica."
    },
    "E-Frame Doble": {
      reference: "298", capacity: 2000,
      description: "El sistema de tipo madre-hija cuenta con una plataforma doble de elevación hidráulica " +
        "para transportar dos plataformas, manteniendo los carros separados del suelo."
    }
  } as const;
  const model = record.model;
  if (model !== "R-Portal" && model !== "E-Frame Simple" && model !== "E-Frame Doble") return null;
  const option = options[model];
  const capacity = measurement(record, "Capacidad de carga (kg)", "kg");
  const mentioned = [...(record.shortDescription ?? "").matchAll(/(\d+)\s*kg\b/giu)]
    .map((match) => Number(match[1]));
  if (record.reference !== option.reference || capacity !== option.capacity ||
    (model !== "R-Portal" && (mentioned.length !== 1 || mentioned[0] !== capacity)) ||
    (model === "R-Portal" && mentioned.length !== 0) ||
    !normalized(record.shortDescription ?? "").includes(normalized(model))) return null;
  if (model === "R-Portal" && !/ambos lados|bloqueo del carro/iu.test(record.shortDescription ?? "")) return null;
  if (model === "E-Frame Simple" && !/eléctrica o hidráulica|sin contacto con el suelo/iu.test(record.shortDescription ?? "")) return null;
  if (model === "E-Frame Doble" && !/doble de elevación hidráulica|dos plataformas/iu.test(record.shortDescription ?? "")) return null;

  return `${record.longDescription?.trim()}\n\nEl modelo ${model} tiene una capacidad declarada de ` +
    `${capacity} kg. ${option.description}`;
};

export const resolveGamTecnacarGeneral = (record: ProductRecord): string | null =>
  tractorGeneral(record) ?? logisticGeneral(record);
