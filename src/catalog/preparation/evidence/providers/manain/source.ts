import type { ProductRecord } from "../../../../../contracts/catalog.js";
import { fold } from "../../../mapping/category-utils.js";

const families = [
  "elevacion-tijera",
  "elevacion-brazo-articulado",
  "elevacion-brazo-telescopico",
  "elevacion-camion-cesta",
  "movimiento-tierra-miniexcavadora",
  "energia-grupo-electrogeno",
  "manipulacion-carretilla-4x4",
  "manipulacion-carretilla",
  "manipulacion-manipulador",
  "movimiento-tierra-dumper",
  "movimiento-tierra-minicargadora",
  "movimiento-tierra-martillo-miniex",
  "elevacion-unipersonal",
  "elevacion-mastil",
  "manipulacion-transpaletas",
  "manipulacion-retractil",
  "manipulacion-apilador",
  "movimiento-tierra-rodillo-compactador",
  "pequena-maquinaria-compactacion",
  "pequena-maquinaria-demolicion",
  "pequena-maquinaria-radiales-electricas",
  "pequena-maquinaria-martillos-electricos",
  "pequena-maquinaria-hidrolimpiadora",
  "pequena-maquinaria-bomba-sumergible"
] as const;

export type ManainFamily = (typeof families)[number];

const aliases: readonly { readonly prefix: string; readonly family: ManainFamily }[] = [
  { prefix: "venda-elevacio-tisores", family: "elevacion-tijera" },
  { prefix: "venda-elevacio-bracos-articulats", family: "elevacion-brazo-articulado" },
  { prefix: "venda-manipulacio-de-carregues-carretilles", family: "manipulacion-carretilla" },
  { prefix: "venda-moviment-de-terres-minicargadora", family: "movimiento-tierra-minicargadora" },
  { prefix: "venda-elevacio-camions-plataforma", family: "elevacion-camion-cesta" },
  { prefix: "venda-elevacio-unipersonals", family: "elevacion-unipersonal" },
  { prefix: "venda-energia-grups-electrogens", family: "energia-grupo-electrogeno" },
  { prefix: "venda-elevacio-mastils-verticals", family: "elevacion-mastil" },
  { prefix: "venta-manipulacion-apiladors", family: "manipulacion-apilador" }
];

export const manainSourceFamily = (record: ProductRecord): ManainFamily | null => {
  if (record.providerId !== "manain") return null;
  try {
    const url = new URL(record.url);
    if (url.protocol !== "https:" || !["manain.com", "www.manain.com"].includes(url.hostname)) return null;
    const path = url.pathname;
    if (!/^\/producto\/(?:venta|venda)-[^/]+\/?$/.test(path)) return null;
    const family = families.find((item) => path.startsWith(`/producto/venta-${item}-`));
    if (family) return family;
    return aliases.find((alias) => path.startsWith(`/producto/${alias.prefix}-`))?.family ?? null;
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
