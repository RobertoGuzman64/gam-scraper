import type { ProductRecord } from "../../../../../contracts/catalog.js";
import { fold } from "../../category-utils.js";
import { validMercaelevaTechnicalSource } from "./technical.js";

const source = (record: ProductRecord, key: string): string | null => {
  const value = record.specs?.[key];
  return typeof value === "string" && value.trim() ? value.trim() : null;
};

const identity = (value: string): string => fold(value).replace(/[^a-z0-9]/g, "");

const referencedGeneral = (record: ProductRecord): string | null => {
  const general = record.longDescription?.trim();
  const article = source(record, "Artículo No.");
  if (!general || !article) return null;
  const match = /^ref\.\s*([\p{L}\d/-]+)\s+(.+)$/iu.exec(general);
  return match?.[1] && match[2] && identity(match[1]) === identity(article) ? match[2].trim() : null;
};

const usedTranspaleta = (record: ProductRecord, short: string, general: string): string | null => {
  const brand = record.brand;
  const model = record.model;
  if (!brand || !model || record.condition !== "Segunda mano" ||
    fold(source(record, "Estado") ?? "") !== "usado" ||
    fold(source(record, "Título adicional") ?? "") !== "transpalet electrico" ||
    ![
      `TRANSPALET ELECTRICO ${brand} ${model}`,
      `TRANSPALET ELECTRICO ${brand} - ${model}`
    ].some((candidate) => identity(candidate) === identity(short))) return null;

  const year = source(record, "Año de fabricación");
  const hours = source(record, "Horas laborales");
  const publishedHours = hours?.match(/^(\d[\d ]*)\s*h$/i)?.[1]?.replace(/\s/g, "") ?? null;
  if (year && /^(?:19|20)\d{2}$/.test(year) && (!record.year || record.year === year) &&
    fold(general) === fold(`${short} AÑO DE FABRICACION ${year}`)) {
    return `Transpaleta eléctrica ${brand} ${model}, año de fabricación ${year}.`;
  }
  if (publishedHours && Number(publishedHours) >= 0 &&
    fold(general) === fold(`${short} HORAS ${publishedHours}`)) {
    return `Transpaleta eléctrica ${brand} ${model}, con ${Number(publishedHours).toLocaleString("es-ES")} horas de uso registradas.`;
  }
  return null;
};

const telehandlerCapacity = (record: ProductRecord, short: string, general: string): string | null => {
  const brand = record.brand;
  const model = record.model;
  const additional = source(record, "Título adicional");
  const height = additional?.match(/^MANIPULADOR TELESCOPICO (\d{1,2}(?:[.,]\d+)?) MT$/i)?.[1];
  const elevation = source(record, "Altura máxima de elevación");
  const capacity = source(record, "Capacidad máxima de elevación")?.match(/^(\d[\d .]*)\s*kg$/i)?.[1];
  const year = source(record, "Año de fabricación");
  const hours = source(record, "Horas laborales")?.match(/^(\d[\d ]*)\s*h$/i)?.[1]?.replace(/\s/g, "");
  if (!brand || !model || !height || !elevation || !capacity || !year || !hours ||
    fold(short) !== fold(`MANIPULADOR TELESCOPICO ALTURA DE TRABAJO ${height} MT ${brand} ${model}`) ||
    fold(elevation) !== fold(`${height} m`) ||
    !/^(?:19|20)\d{2}$/.test(year) || (record.year && record.year !== year) ||
    fold(general) !== fold(`${short} HORAS ${hours} AÑO DE FABRICACION ${year}`)) return null;
  const load = Number(capacity.replace(/[ .]/g, ""));
  if (!Number.isSafeInteger(load) || load <= 0 || load > 50000) return null;
  return `Manipulador telescópico ${brand} ${model}, con altura máxima de elevación de ${height.replace(".", ",")} m y capacidad máxima de ${load.toLocaleString("es-ES")} kg.`;
};

const englishPlatform = (record: ProductRecord, short: string, general: string): string | null => {
  const brand = record.brand;
  const model = record.model;
  const additional = source(record, "Título adicional");
  const height = additional?.match(/^PLATAFORMA ARTICULADA ELECTRICA (\d{1,2}(?:[.,]\d+)?) MT$/i)?.[1];
  const year = source(record, "Año de fabricación");
  const hours = source(record, "Horas laborales")?.match(/^(\d[\d ]*)\s*h$/i)?.[1]?.replace(/\s/g, "");
  if (!brand || !model || !height || !year || !hours ||
    fold(source(record, "Tipo de motor") ?? "") !== "electrico" ||
    fold(source(record, "Altura de trabajo") ?? "") !== fold(`${height} m`) ||
    fold(short) !== fold(`ELECTRIC ARTICULATED BOOM WORKING HEIGHT ${height} MT ${brand} ${model}`) ||
    fold(general) !== fold(`${short} HOURS ${hours} YEAR OF MANUFACTURE ${year}`) ||
    (record.year && record.year !== year)) return null;
  return `Plataforma articulada eléctrica ${brand} ${model}, con altura de trabajo de ${height.replace(".", ",")} m.`;
};

const vehicleSummary = (record: ProductRecord, short: string): string | null => {
  const brand = record.brand;
  const model = record.model;
  const additional = source(record, "Título adicional");
  const power = additional?.match(/^Camión porta-vehículos (\d{2,3})\s*CV$/i)?.[1];
  if (!brand || !model || !power ||
    fold(short) !== fold(`Marca: ${brand} Modelo: ${model} Tipo: Camión porta-vehículos`) ||
    fold(source(record, "Tipo de motor") ?? "") !== "diesel" ||
    !fold(record.longDescription ?? "").startsWith(fold(short)) ||
    !new RegExp(`\\bpotencia:\\s*${power}\\s*cv\\b`).test(fold(record.longDescription ?? ""))) return null;
  return `Camión porta-vehículos ${brand} ${model}, con motor diésel de ${power} CV.`;
};

export const resolveMercaelevaConciseDescription = (record: ProductRecord): string | null => {
  const short = record.shortDescription?.trim();
  const brand = record.brand;
  const model = record.model;
  const title = record.title?.trim();
  const additional = source(record, "Título adicional");
  if (!validMercaelevaTechnicalSource(record) || record.categoryKey !== "venta" ||
    !record.reference || !/^M\d+-\d+$/.test(record.reference) ||
    !record.url.replace(/\/$/, "").endsWith(`-${record.reference}`) ||
    !short || short.split(/\s+/u).length >= 10 ||
    !brand || !model || !title || !additional ||
    identity(brand) !== identity(source(record, "Marca") ?? "") ||
    identity(model) !== identity(source(record, "Modelo") ?? "") ||
    identity(title) !== identity(`${brand} ${model} ${additional}`)) return null;

  const general = referencedGeneral(record);
  if (general) {
    return usedTranspaleta(record, short, general) ??
      telehandlerCapacity(record, short, general) ??
      englishPlatform(record, short, general);
  }
  return vehicleSummary(record, short);
};
