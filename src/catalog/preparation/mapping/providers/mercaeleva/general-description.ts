import type { ProductRecord } from "../../../../../contracts/catalog.js";
import { fold } from "../../category-utils.js";
import { validMercaelevaTechnicalSource } from "./technical.js";

const identity = (value: string): string => fold(value).replace(/[^a-z0-9]/g, "");

const source = (record: ProductRecord, key: string): string | null => {
  const value = record.specs?.[key];
  return typeof value === "string" && value.trim() ? value.trim() : null;
};

const platformName: Readonly<Record<string, string>> = {
  tijera: "Plataforma de tijera",
  articulada: "Plataforma articulada",
  telescopica: "Plataforma telescópica",
  "vertical autopropulsada": "Plataforma vertical autopropulsada"
};

export const resolveMercaelevaGeneralDescription = (record: ProductRecord): string | null => {
  if (!validMercaelevaTechnicalSource(record) || record.categoryKey !== "venta" ||
    !record.reference || !/^M\d+-\d+$/.test(record.reference) ||
    !record.url.replace(/\/$/, "").endsWith(`-${record.reference}`)) return null;

  const general = record.longDescription?.trim();
  const title = record.title?.trim();
  const brand = source(record, "Marca");
  const model = source(record, "Modelo");
  const additional = source(record, "Título adicional");
  const article = source(record, "Artículo No.");
  const year = source(record, "Año de fabricación");
  const hours = source(record, "Horas laborales");
  const workingHeight = source(record, "Altura de trabajo");
  if (!general || !title || !brand || !model || !additional || !article || !year || !hours || !workingHeight ||
    !record.brand || !record.model || identity(record.brand) !== identity(brand) ||
    identity(record.model) !== identity(model) || identity(title) !== identity(`${brand} ${model} ${additional}`) ||
    !/^[\p{L}\d/-]+$/u.test(article) || !/^(?:19|20)\d{2}$/.test(year) ||
    (record.year && record.year !== year)) return null;

  const kind = /^PLATAFORMA (TIJERA|ARTICULADA|TELESCOPICA|VERTICAL AUTOPROPULSADA)(?: (ELECTRICA|DIESEL))?\s+(\d{1,2}(?:[.,]\d{1,2})?)\s+MT$/i.exec(additional);
  if (!kind?.[1] || !kind[3]) return null;
  const family = fold(kind[1]);
  const name = platformName[family];
  if (!name || (family !== "vertical autopropulsada" && !kind[2])) return null;

  const height = Number(kind[3].replace(",", "."));
  const publishedHeight = /^(\d{1,2}(?:[.,]\d{1,2})?)\s*m$/i.exec(workingHeight);
  const publishedHours = /^(\d{1,6})\s*h$/i.exec(hours);
  const sourceHorometer = record.horometer?.trim().match(/^(\d{1,6})(?:\s*h)?$/i)?.[1];
  if (!publishedHeight?.[1] || !publishedHours?.[1] || height <= 0 || height > 60 ||
    Number(publishedHeight[1].replace(",", ".")) !== height ||
    (record.horometer && sourceHorometer !== publishedHours[1])) return null;

  const energy = fold(kind[2] ?? "");
  const motor = source(record, "Tipo de motor");
  if (motor && (!energy || fold(motor) !== (energy === "electrica" ? "electrico" : "diesel"))) return null;

  const expected = `Ref. ${article} ${additional.replace(/\s+\d{1,2}(?:[.,]\d{1,2})?\s+MT$/i, "")} ` +
    `ALTURA DE TRABAJO ${kind[3]} MT ${brand} ${model} HORAS ${publishedHours[1]} AÑO DE FABRICACION ${year}`;
  if (identity(general) !== identity(expected)) return null;

  const presentation = `${name}${energy === "electrica" ? " eléctrica" : energy === "diesel" ? " diésel" : ""}`;
  const displayHeight = kind[3].replace(".", ",");
  return `${presentation} ${brand} ${model}, con altura de trabajo de ${displayHeight} m. ` +
    `Año de fabricación: ${year}. Horas de uso publicadas: ${publishedHours[1]} h. ` +
    `Referencia del vendedor: ${article}.`;
};
