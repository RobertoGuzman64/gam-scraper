import type { ProductRecord } from "../../../../../contracts/catalog.js";
import { fold, numberToken } from "../../attribute-utils.js";

const sourceModel = (record: ProductRecord): string | null => {
  const model = record.specs?.["Modelo"];
  return typeof model === "string" && model.trim() && fold(model) === fold(record.model ?? "") ? model : null;
};

export const reconcileGamBtsEditorialSummary = (record: ProductRecord): ProductRecord => {
  if (record.providerId !== "gam" || record.categoryKey !== "marcas-nuevas" ||
    record.condition !== "Nuevo" || !record.shortDescription || !record.longDescription || !record.title) return record;
  let section: string;
  try {
    const url = new URL(record.url);
    const parts = url.pathname.split("/").filter(Boolean);
    if (url.hostname !== "online.gamrentals.com" || parts[0] !== "es" || parts.length !== 3) return record;
    section = parts[1] ?? "";
  } catch {
    return record;
  }
  if (section !== "bts") return record;
  const model = sourceModel(record);
  if (!model || !fold(record.title).startsWith("arrastrador a pie trailercaddy ") ||
    !fold(record.title).includes(fold(model)) || !fold(record.longDescription).includes(fold(model)) ||
    !/\bsistema alimentado por bateria\b/.test(fold(record.longDescription))) return record;
  const summary = record.shortDescription.match(/^(➨\s*TrailerCaddy\s+)(.+?)(\s+(?:Segunda Mano|nuevo)\s+➨\s+Venta de arrastrador a pie(?: nuevo)?\s*⭐\s*Capacidad de arrastre\s+)(\d[\d.,]*)\s*Kg\s*$/i);
  if (!summary?.[2] || !summary[3] || !summary[4]) return record;
  const advertisedCapacity = numberToken(summary[4]);
  const specCapacity = record.specs?.["Capacidad de arrastre"];
  const specified = typeof specCapacity === "string" ? specCapacity.match(/^(\d[\d.,]*)\s*kg$/i)?.[1] : null;
  const declaredCapacity = specified ? numberToken(specified) : null;
  const described = [...record.longDescription.matchAll(/\bmueve hasta\s+([\d.,]+)\s*kg\b/gi)]
    .map((match) => match[1] ? numberToken(match[1]) : null);
  if (advertisedCapacity === null || advertisedCapacity !== declaredCapacity ||
    described.length !== 1 || described[0] !== advertisedCapacity) return record;
  const oldModel = fold(summary[2]);
  const expected = fold(record.title.slice("Arrastrador a Pie TrailerCaddy ".length));
  if (oldModel === expected) {
    if (!/\bsegunda mano\b/i.test(summary[3]) || !/\bventa de arrastrador a pie nuevo\b/i.test(summary[3])) return record;
    return { ...record, shortDescription: record.shortDescription.replace(/\bSegunda Mano\b/, "").replace(/\s{2,}/g, " ") };
  }
  if (!/\bnuevo\b/i.test(summary[3]) || fold(record.shortDescription).includes(fold(model)) ||
    fold(record.longDescription).includes(oldModel)) return record;
  const updated = record.shortDescription.replace(/^➨\s*TrailerCaddy\s+.+?\s+nuevo\s+➨/i,
    `➨ ${record.title.slice("Arrastrador a Pie ".length)} nuevo ➨`);
  return updated === record.shortDescription ? record : { ...record, shortDescription: updated };
};
