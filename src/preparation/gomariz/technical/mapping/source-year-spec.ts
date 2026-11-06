import type { ProductRecord, SpecsMap } from "../../../../contracts/catalog.js";

const isGomarizSale = (record: ProductRecord): boolean => {
  if (record.providerId !== "gomariz" || record.categoryKey !== "venta" ||
    record.condition !== "Segunda mano" || !record.reference?.trim() || !record.title?.trim()) return false;
  try {
    const url = new URL(record.url);
    const path = url.pathname.split("/").filter(Boolean);
    return url.protocol === "https:" &&
      (url.hostname === "gomarizrent.com" || url.hostname === "www.gomarizrent.com") &&
      path.length === 4 && path[0] === "venta";
  } catch {
    return false;
  }
};

const isYearKey = (key: string): boolean =>
  /^ano(?: de fabricacion)?$/u.test(key.trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/gu, ""));

export const recoverGomarizSourceYearSpec = (record: ProductRecord, specs: SpecsMap): SpecsMap => {
  const year = record.year?.trim();
  if (!isGomarizSale(record) || !year || !/^(?:19|20)\d{2}$/u.test(year) ||
    (record.yearSource != null && record.yearSource !== "ficha") ||
    Object.keys(specs).some(isYearKey)) return specs;
  return { ...specs, "Año de fabricación": year };
};
