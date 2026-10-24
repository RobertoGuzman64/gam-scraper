import type { ProductRecord } from "../../../../../contracts/catalog.js";
import { fold, numberToken } from "../../attribute-utils.js";

export const reconcileGamOrderPickerEditorial = (record: ProductRecord): ProductRecord => {
  if (record.providerId !== "gam" || record.categoryKey !== "carretillas-nuevas" ||
    record.condition !== "Nuevo" || fold(record.brand ?? "") !== "yale" ||
    fold(String(record.specs?.["Marca"] ?? "")) !== "yale" ||
    !record.model || !/^MO\d{2}$/.test(record.model) ||
    fold(String(record.specs?.["Modelo"] ?? "")) !== fold(record.model) ||
    !record.title || !record.shortDescription || !record.longDescription) return record;
  const title = record.title.match(/^Preparapedidos\s+(\d{3,4})\s+Kg\s+Yale\s+(MO\d{2})$/i);
  const source = record.specs?.["Capacidad de carga (kg)"];
  const spec = typeof source === "string" ? source.trim().match(/^(\d{3,4})\s*KG$/i) : null;
  if (!title?.[1] || !title[2] || !spec?.[1] || title[2] !== record.model ||
    Number(title[1]) !== Number(spec[1]) || Number(spec[1]) < 500) return record;
  try {
    const url = new URL(record.url);
    const parts = url.pathname.split("/").filter(Boolean);
    if (url.hostname !== "online.gamrentals.com" || parts[0] !== "es" ||
      parts[1] !== "recogepedidos-yale" || parts.length !== 3 ||
      !(parts[2] ?? "").startsWith(`${record.reference}-preparapedidos-`) ||
      !(parts[2] ?? "").endsWith(`-yale-${fold(record.model)}`)) return record;
  } catch {
    return record;
  }
  const advertised = record.shortDescription.match(/^(➨\s*Yale\s+MO\d{2}\s+➨\s+Venta de Preparapedidos Eléctrico Yale nueva\s*⭐\s*Capacidad de carga de\s+)(\d{3,4})(\s*kg)$/i);
  if (!advertised?.[1] || !advertised[2] || !advertised[3] ||
    !fold(advertised[0]).includes(fold(record.model)) ||
    Number(advertised[2]) === Number(spec[1])) return record;
  const first = new RegExp(`^El Preparapedidos Yale ${record.model} de ${title[1]} Kg\\b`);
  const end = new RegExp(`\\bEl Preparapedidos Yale ${record.model} de ${title[1]} Kg\\b`, "g");
  const originalLong = record.longDescription;
  if (!first.test(originalLong) || [...originalLong.matchAll(end)].length !== 2) return record;
  const otherModel = [...originalLong.matchAll(/\bMO\d{2}L?\b/g)].map((match) => match[0]);
  const other = [...new Set(otherModel.filter((model) => model !== record.model))];
  if (other.length !== 1 || !/^MO\d{2}L?$/.test(other[0] ?? "")) return record;
  const texts = [...originalLong.matchAll(/\b(?:capacidad de carga de|capacidad de carga|manejar)\s+(\d{3,4})\s+kilogramos\b/gi)];
  const copy = texts[0];
  const otherName = other[0];
  if (texts.length !== 1 || !copy || !copy[1] || !otherName ||
    numberToken(copy[1]) !== Number(advertised[2])) return record;
  const updatedLong = originalLong.replace(new RegExp(`\\b${otherName}\\b`, "g"), record.model)
    .replace(copy[0], copy[0].replace(copy[1], spec[1]));
  const updatedShort = `${advertised[1]}${spec[1]}${advertised[3]}`;
  return { ...record, shortDescription: updatedShort, longDescription: updatedLong };
};
