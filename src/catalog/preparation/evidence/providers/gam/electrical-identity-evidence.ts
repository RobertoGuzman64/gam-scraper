import type { ProductRecord } from "../../../../../contracts/catalog.js";

export const normalizedElectricalIdentity = (value: string): string => value.toLowerCase().normalize("NFD")
  .replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, "");

export const verifiedGamElectricalIdentity = (record: ProductRecord): boolean => {
  if (record.providerId !== "gam" || record.condition !== "Nuevo" || !record.brand || !record.model || !record.reference) return false;
  const brand = normalizedElectricalIdentity(record.brand);
  const model = normalizedElectricalIdentity(record.model);
  if (!brand || !model || normalizedElectricalIdentity(String(record.specs?.["Marca"] ?? "")) !== brand ||
    normalizedElectricalIdentity(String(record.specs?.["Modelo"] ?? "")) !== model ||
    !normalizedElectricalIdentity(record.title ?? "").includes(model) ||
    !normalizedElectricalIdentity(record.longDescription ?? "").includes(model) ||
    !normalizedElectricalIdentity(record.longDescription ?? "").includes(brand)) return false;
  const isCleaning = record.categoryKey === "limpieza-barredoras" && brand === "tennant";
  if (!isCleaning && !normalizedElectricalIdentity(record.title ?? "").includes(brand)) return false;
  try {
    const url = new URL(record.url);
    const path = url.pathname.split("/").filter(Boolean);
    return url.hostname === "online.gamrentals.com" && !url.search && !url.hash &&
      path.length === 3 && path[0] === "es" && path[2]?.startsWith(`${record.reference}-`) === true &&
      normalizedElectricalIdentity(path[2] ?? "").includes(model) &&
      (isCleaning || normalizedElectricalIdentity(path[2] ?? "").includes(brand));
  } catch {
    return false;
  }
};
