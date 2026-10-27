import type { ProductRecord } from "../../../../../contracts/catalog.js";
import { fold } from "../../category-utils.js";

const families = [
  "elevacion-tijera",
  "elevacion-brazo-articulado",
  "elevacion-brazo-telescopico",
  "elevacion-camion-cesta",
  "movimiento-tierra-miniexcavadora",
  "energia-grupo-electrogeno"
] as const;

export type ManainFamily = (typeof families)[number];

export const manainSourceFamily = (record: ProductRecord): ManainFamily | null => {
  if (record.providerId !== "manain") return null;
  try {
    const url = new URL(record.url);
    if (url.protocol !== "https:" || !["manain.com", "www.manain.com"].includes(url.hostname)) return null;
    const path = url.pathname;
    const family = families.find((item) => path.startsWith(`/producto/venta-${item}-`));
    if (family && /^\/producto\/venta-[^/]+\/?$/.test(path)) return family;
    return /^\/producto\/venda-elevacio-tisores-[^/]+\/?$/.test(path) ? "elevacion-tijera" : null;
  } catch {
    return null;
  }
};

const describedFamily = (description: string): ManainFamily | null => {
  const text = fold(description);
  if (/^plataforma(?: elevadora)? (?:de )?tijera\b/.test(text)) return "elevacion-tijera";
  if (/^plataforma(?: elevadora)? (?:de )?brazo articulado\b/.test(text)) return "elevacion-brazo-articulado";
  if (/^plataforma(?: elevadora)? (?:de )?brazo telescopico\b/.test(text)) return "elevacion-brazo-telescopico";
  if (/^camion cesta\b/.test(text)) return "elevacion-camion-cesta";
  if (/^miniexcavadora\b/.test(text)) return "movimiento-tierra-miniexcavadora";
  if (/^grupo electrogeno\b/.test(text)) return "energia-grupo-electrogeno";
  return null;
};

export const manainSourceDescriptionContradictsFamily = (record: ProductRecord, family: ManainFamily): boolean => {
  const described = describedFamily(record.shortDescription ?? "");
  return described !== null && described !== family;
};
