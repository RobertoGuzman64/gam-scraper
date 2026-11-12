import type { ProductRecord } from "../../../../contracts/catalog.js";
import { fold } from "../../../shared/classification/mapping/category-utils.js";
import { validMercaelevaTechnicalSource } from "../../technical/mapping/technical.js";
import { platformMeasurements } from "../../../shared/editorial/domain/platform-measurements.js";

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

const reachTruckGeneral = (
  record: ProductRecord, general: string, brand: string, model: string,
  additional: string, article: string, year: string | null, hours: string | null
): string | null => {
  const reach = /^CARRETILLA ELEVADORA RETRACTIL (\d{3,5}) KG$/i.exec(additional);
  const declaredHeight = /^Ref\.\s+[\p{L}\d-]+\s+CARRETILLA RETRACTIL ELECTRICA\s+\d{3,5} KG\s+ALTURA DE ELEVACION\s+(\d{1,2}\.\d{3}|\d{3,5}) mm\s+/iu.exec(general)?.[1];
  const hoursValue = hours?.match(/^(\d[\d ]*)\s*h$/i)?.[1]?.replace(/\s/g, "") ?? null;
  const capacity = record.specs?.["Capacidad máxima de elevación"];
  const motor = source(record, "Tipo de motor");
  if (record.reference !== "M547-2372" || !reach?.[1] || declaredHeight !== "6.500" || !year || !hoursValue ||
    (motor !== null && fold(motor) !== "electrico") ||
    (capacity !== undefined && identity(String(capacity)) !== identity(`${reach[1]} kg`)) ||
    (record.horometer && record.horometer.replace(/[^\d]/g, "") !== hoursValue) ||
    source(record, "Condición general") !== "Bueno") return null;
  const expected = `Ref. ${article} CARRETILLA RETRACTIL ELECTRICA ${reach[1]} KG ` +
    `ALTURA DE ELEVACION ${declaredHeight} mm ${brand} ${model} HORAS ${hoursValue} AÑO DE FABRICACION ${year}`;
  if (identity(general) !== identity(expected)) return null;
  return `Carretilla elevadora retráctil eléctrica ${brand} ${model}, anunciada con capacidad de ${Number(reach[1]).toLocaleString("es-ES")} kg. ` +
    `El texto comercial declara ${declaredHeight} mm de altura; debe comprobarse el concepto de medida y la configuración del mástil antes de emplear esa cifra como prestación acreditada. ` +
    `La ficha identifica el año de fabricación ${year}, ${Number(hoursValue).toLocaleString("es-ES")} horas registradas y la referencia del vendedor ${article}. ` +
    `El vendedor clasifica la condición general como «${source(record, "Condición general") ?? "no indicada"}»; esta valoración comercial no equivale a una inspección acreditada.`;
};

const handlingGeneral = (
  record: ProductRecord, general: string, brand: string, model: string,
  additional: string, article: string, year: string | null, hours: string | null
): string | null => {
  const kind = /^(?:CARRETILLA ELEVADORA (ELECTRICA|DIESEL) (\d{3,5})\s*KG|TRANSPALET ELECTRICO)$/i.exec(additional);
  if (!kind) return reachTruckGeneral(record, general, brand, model, additional, article, year, hours);
  if (!year && !hours) return null;
  const motor = source(record, "Tipo de motor");
  if (motor && (!kind[1] || fold(motor) !== (fold(kind[1]) === "electrica" ? "electrico" : "diesel"))) return null;
  const capacity = source(record, "Capacidad máxima de elevación");
  if (kind[2] && (!capacity || identity(capacity) !== identity(`${kind[2]} kg`))) return null;
  if (!kind[2] && capacity) return null;

  const publishedHours = hours?.match(/^(\d[\d ]*)\s*h$/i)?.[1]?.replace(/\s/g, "") ?? null;
  if ((hours && !publishedHours) || (record.horometer &&
    (!publishedHours || !/^(\d[\d ]*)\s*h?$/i.test(record.horometer.trim()) ||
      record.horometer.replace(/[^\d]/g, "") !== publishedHours))) return null;

  const expected = `Ref. ${article} ${additional} ${brand} ${model}` +
    `${publishedHours ? ` HORAS ${publishedHours}` : ""}${year ? ` AÑO DE FABRICACION ${year}` : ""}`;
  if (identity(general) !== identity(expected)) return null;

  const name = kind[1] ? `Carretilla elevadora ${fold(kind[1]) === "electrica" ? "eléctrica" : "diésel"}` : "Transpaleta eléctrica";
  return `${name} ${brand} ${model}${kind[2] ? `, con capacidad máxima de elevación de ${Number(kind[2]).toLocaleString("es-ES")} kg` : ""}. ` +
    `${year ? `Año de fabricación: ${year}. ` : ""}${publishedHours ? `Horas de uso publicadas: ${publishedHours} h. ` : ""}` +
    `Referencia del vendedor: ${article}.`;
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
  if (!general || !title || !brand || !model || !additional || !article ||
    !record.brand || !record.model || identity(record.brand) !== identity(brand) ||
    identity(record.model) !== identity(model) || identity(title) !== identity(`${brand} ${model} ${additional}`) ||
    !/^[\p{L}\d/-]+$/u.test(article) || (year !== null && !/^(?:19|20)\d{2}$/.test(year)) ||
    (record.year && record.year !== year)) return null;

  const kind = /^PLATAFORMA (TIJERA|ARTICULADA|TELESCOPICA|VERTICAL AUTOPROPULSADA)(?: (ELECTRICA|DIESEL))?\s+(\d{1,2}(?:[.,]\d{1,2})?)\s+MT$/i.exec(additional);
  if (!kind?.[1] || !kind[3]) return handlingGeneral(record, general, brand, model, additional, article, year, hours);
  const family = fold(kind[1]);
  const name = platformName[family];
  if (!name || !year || !workingHeight || (family !== "vertical autopropulsada" && !kind[2])) return null;

  const height = Number(kind[3].replace(",", "."));
  const publishedHeight = /^(\d{1,2}(?:[.,]\d{1,2})?)\s*m$/i.exec(workingHeight);
  const publishedHours = hours?.match(/^(\d[\d ]*)\s*h$/i)?.[1]?.replace(/\s/g, "") ?? null;
  const sourceHorometer = record.horometer?.trim().match(/^(\d{1,6})(?:\s*h)?$/i)?.[1];
  if (!publishedHeight?.[1] || (hours && !publishedHours) || height <= 0 || height > 60 ||
    Number(publishedHeight[1].replace(",", ".")) !== height ||
    (record.horometer && (!publishedHours || sourceHorometer !== publishedHours))) return null;

  const energy = fold(kind[2] ?? "");
  const motor = source(record, "Tipo de motor");
  if (motor && (!energy || fold(motor) !== (energy === "electrica" ? "electrico" : "diesel"))) return null;

  const expected = `Ref. ${article} ${additional.replace(/\s+\d{1,2}(?:[.,]\d{1,2})?\s+MT$/i, "")} ` +
    `ALTURA DE TRABAJO ${kind[3]} MT ${brand} ${model}${publishedHours ? ` HORAS ${publishedHours}` : ""} AÑO DE FABRICACION ${year}`;
  if (identity(general) !== identity(expected)) return null;

  const presentation = `${name}${energy === "electrica" ? " eléctrica" : energy === "diesel" ? " diésel" : ""}`;
  const displayHeight = kind[3].replace(".", ",");
  return `${presentation} ${brand} ${model}, con ${platformMeasurements(displayHeight, null, null)}. ` +
    `Año de fabricación: ${year}.${publishedHours ? ` Horas de uso publicadas: ${publishedHours} h.` : ""} ` +
    `Referencia del vendedor: ${article}.`;
};
