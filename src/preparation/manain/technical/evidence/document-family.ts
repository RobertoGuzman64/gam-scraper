import type { ProductRecord } from "../../../../contracts/catalog.js";
import { fold } from "../../../shared/classification/mapping/category-utils.js";
import type { ManainFamily } from "./source.js";

type DocumentFamily = {
  readonly family: ManainFamily;
  readonly energy: "diesel" | "electrica" | null;
};

const classify = (value: string): DocumentFamily | null => {
  const label = fold(value).toUpperCase();
  if (/^AD-\d+ ARTICULADA DIESEL$/u.test(label)) return { family: "elevacion-brazo-articulado", energy: "diesel" };
  if (/^AE-\d+ ARTICULADA ELECTRICA$/u.test(label)) return { family: "elevacion-brazo-articulado", energy: "electrica" };
  if (/^TD-\d+ TIJERA DIESEL$/u.test(label)) return { family: "elevacion-tijera", energy: "diesel" };
  if (/^TE-\d+ TIJERA ELECTRICA$/u.test(label)) return { family: "elevacion-tijera", energy: "electrica" };
  if (/^TE-\d+ BI TIJERA BIENERGY$/u.test(label)) return { family: "elevacion-tijera", energy: null };
  if (/^TEL-\d+ TELESCOPICA DIESEL$/u.test(label)) return { family: "elevacion-brazo-telescopico", energy: "diesel" };
  if (/^CAM-\d+ CAMION (?:ARTICULADO|TELESCOPICO)$/u.test(label)) return { family: "elevacion-camion-cesta", energy: null };
  if (/^MAS-\d+ MASTIL ELECTRICO$/u.test(label)) return { family: "elevacion-mastil", energy: "electrica" };
  if (/^UNI-\d+ UNIPERSONAL$/u.test(label)) return { family: "elevacion-unipersonal", energy: null };
  if (/^CDO?-\d+ CARRETILLA DIESEL$/u.test(label)) return { family: "manipulacion-carretilla", energy: "diesel" };
  if (/^CE-\d+ CARRETILLA ELECTRICA$/u.test(label)) return { family: "manipulacion-carretilla", energy: "electrica" };
  if (/^MT-\d+ MANIPULADOR TELESCOPICO \d+MTS$/u.test(label)) return { family: "manipulacion-manipulador", energy: null };
  if (/^TRAS-E TRANSPALETA ELECTRICA$/u.test(label)) return { family: "manipulacion-transpaletas", energy: "electrica" };
  if (/^TRAS-M TRANSPALETA MANUAL$/u.test(label)) return { family: "manipulacion-transpaletas", energy: null };
  if (/^RETR\d+ RETRACTIL ELECTRICA \d+KG$/u.test(label)) return { family: "manipulacion-retractil", energy: "electrica" };
  if (/^APIL-E APILADOR ELECTRICO$/u.test(label)) return { family: "manipulacion-apilador", energy: "electrica" };
  if (/^ME-\d+ MINI EXCAVADORA \d+KG$/u.test(label)) return { family: "movimiento-tierra-miniexcavadora", energy: null };
  if (/^MC-\d+ MINI CARGADORA$/u.test(label)) return { family: "movimiento-tierra-minicargadora", energy: null };
  if (/^MAR-\d+ MARTILLO EXCAVACION$/u.test(label)) return { family: "movimiento-tierra-martillo-miniex", energy: null };
  if (/^D(?:DG|AU|DA)-\d+ DUMPER (?:GIRATORIO|AUTOCARGABLE|DESCARGA ALTURA) \d+KG$/u.test(label)) {
    return { family: "movimiento-tierra-dumper", energy: null };
  }
  if (/^RO-(?:CO|LLA) RODILLO (?:COMPACTACION|LANZA COMPACTACION) \d+KG$/u.test(label)) {
    return { family: "movimiento-tierra-rodillo-compactador", energy: null };
  }
  if (/^GRU-\d+ VARIOS (?:DIESEL|GASOLINA)$/u.test(label)) {
    return { family: "energia-grupo-electrogeno", energy: label.endsWith("DIESEL") ? "diesel" : null };
  }
  if (label === "HIDRO HIDROLIMPIADORA ELECTRICO") return { family: "pequena-maquinaria-hidrolimpiadora", energy: "electrica" };
  if (label === "PISON COMPACTACION") return { family: "pequena-maquinaria-compactacion", energy: null };
  return null;
};

export const manainDocumentFamily = (record: ProductRecord): DocumentFamily | null => {
  if (record.providerId !== "manain" || !record.reference || record.categoryKey !== record.categoryName) return null;
  try {
    const url = new URL(record.url);
    if (url.protocol !== "https:" || !["manain.com", "www.manain.com"].includes(url.hostname) ||
      url.pathname !== "/" || url.searchParams.getAll("sku").length !== 1 ||
      url.searchParams.get("sku") !== record.reference) return null;
    return classify(record.categoryName);
  } catch {
    return null;
  }
};
