import type { ProductRecord } from "../../../../../contracts/catalog.js";

const normalize = (value: string): string => value.normalize("NFD")
  .replace(/[\u0300-\u036f]/gu, "").toLowerCase().replace(/[^a-z0-9]/gu, "");

const sameBrand = (brand: string, text: string): boolean =>
  normalize(text).includes(normalize(brand)) ||
  brand.split(/\s+/u).length === 2 && brand.split(/\s+/u).every((part) =>
    part.length >= 3 && normalize(text).includes(normalize(part)));

const families: Readonly<Record<string, { readonly label: string; readonly description: RegExp }>> = {
  "elevador-tijera": { label: "plataforma de tijera", description: /^Las Tijeras El[eé]ctricas\b/iu },
  "brazo-articulado": { label: "plataforma articulada", description: /^Las Articuladas Di[eé]sel\b/iu },
  "camion-plataforma": { label: "camión plataforma", description: /^Los Camiones Cesta\b/iu },
  "fregadora": { label: "fregadora", description: /^Las fregadoras son m[aá]quinas\b/iu },
  "elevador-mastil-vertical": { label: "elevador de mástil vertical", description: /^Indicadas especialmente para el almacenaje\b/iu }
};

const measurement = (record: ProductRecord, key: string, unit: "m" | "kg"): number | null => {
  const value = record.specs?.[key];
  if (typeof value !== "string") return null;
  const match = /^(\d+(?:[.,]\d{1,2})?)\s*(m|metros?|kg)$/iu.exec(value.trim());
  if (!match?.[1] || !match[2] || (unit === "m" ? !/^m(?:etros?)?$/iu.test(match[2]) : match[2].toLowerCase() !== "kg")) return null;
  const amount = Number(match[1].replace(",", "."));
  return Number.isFinite(amount) && amount > 0 ? amount : null;
};

const format = (amount: number): string => String(amount).replace(".", ",");

export const resolveGomarizResidualGeneral = (record: ProductRecord): string | null => {
  const original = record.longDescription?.trim();
  const title = record.title?.trim();
  const brand = record.brand?.trim();
  const model = record.model?.trim();
  if (record.providerId !== "gomariz" || record.categoryKey !== "venta" ||
    record.condition !== "Segunda mano" || !record.reference || !original ||
    !title || !brand || !model || !sameBrand(brand, title) ||
    !normalize(title).includes(normalize(model)) ||
    normalize(original).includes(normalize(model))) return null;

  let family: string;
  try {
    const url = new URL(record.url);
    const path = url.pathname.split("/").filter(Boolean);
    if (url.protocol !== "https:" || url.hostname !== "www.gomarizrent.com" ||
      path.length !== 4 || path[0] !== "venta" ||
      !sameBrand(brand, path[3] ?? "") ||
      !normalize(path[3] ?? "").includes(normalize(model)) ||
      url.search || url.hash) return null;
    family = path[2] ?? "";
  } catch {
    return null;
  }
  const category = families[family];
  if (!category?.description.test(original)) return null;

  const motor = record.specs?.Motor;
  if (motor !== undefined && motor !== "Eléctrico" && motor !== "Diésel") return null;
  const working = measurement(record, "Altura de trabajo", "m");
  const platform = measurement(record, "Altura plataforma", "m");
  const stored = measurement(record, "Altura almacenaje", "m");
  const reach = measurement(record, "Alcance lateral", "m");
  const capacity = measurement(record, "Capacidad", "kg");
  const length = measurement(record, "Longitud", "m");
  const width = measurement(record, "Anchura", "m");
  const weight = measurement(record, "Peso", "kg");
  const cleaningWidth = measurement(record, "Anchura limpieza", "m");
  if (working !== null && (working < 2 || working > 45 ||
    platform !== null && platform > working || stored !== null && stored > working)) return null;
  if (length !== null && width !== null && (length > 20 ||
    (length < width && family !== "elevador-mastil-vertical"))) return null;
  if (capacity !== null && (capacity < 50 || capacity > 10000)) return null;
  if (weight !== null && weight > 50000) return null;
  if (!length || !width || !weight) return null;
  if (family !== "fregadora" && (!working || !capacity)) return null;
  if (family === "fregadora" && (!cleaningWidth || motor !== "Eléctrico")) return null;
  if (family === "elevador-tijera" && (motor === "Diésel" ||
    (motor !== "Eléctrico" && !/tijera-electrica/iu.test(record.url)) ||
    /brazo-articulado/iu.test(new URL(record.url).pathname.split("/").at(-1) ?? ""))) return null;

  const facts = [`${format(length)} m de longitud`, `${format(width)} m de anchura`, `${format(weight)} kg de peso`];
  if (working !== null) facts.push(`${format(working)} m de altura de trabajo`);
  if (capacity !== null) facts.push(`${format(capacity)} kg de capacidad`);
  if (reach !== null && reach > 0) facts.push(`${format(reach)} m de alcance lateral`);
  if (cleaningWidth !== null) facts.push(`${format(cleaningWidth)} m de anchura de limpieza`);
  const engine = motor ? ` El motor indicado es ${motor.toLowerCase()}.` : "";
  return `La ficha técnica de ${title} (${category.label}) recoge ${facts.join(", ")}.` + engine;
};
