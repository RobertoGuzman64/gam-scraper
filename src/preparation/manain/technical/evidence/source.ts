import type { ProductRecord } from "../../../../contracts/catalog.js";
import { fold } from "../../../shared/classification/mapping/category-utils.js";
import { manainDocumentFamily } from "./document-family.js";

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

export const manainSourceFamily = (record: ProductRecord): ManainFamily | null =>
  record.providerId === "manain" ? manainDocumentFamily(record)?.family ?? null : null;

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
