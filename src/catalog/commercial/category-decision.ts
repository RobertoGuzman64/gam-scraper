import type { ProductRecord } from "../../contracts/catalog.js";
import { fold } from "../preparation/mapping/category-utils.js";

export type CommercialCategoryDecision =
  | { readonly status: "excluded"; readonly reason: "lote" | "herramienta" | "accesorio"; readonly categorySellID: null }
  | { readonly status: "pending"; readonly reason: "sin-categoria"; readonly categorySellID: null }
  | { readonly status: "proposed"; readonly reason: null; readonly categorySellID: number };

export const decideCommercialCategory = (
  source: ProductRecord, categorySellID: number | null
): CommercialCategoryDecision => {
  let segments: string[] = [];
  try {
    segments = new URL(source.url).pathname.toLocaleLowerCase("es").split("/").filter(Boolean);
  } catch {
    segments = [];
  }
  const sourceCategory = source.categoryKey.toLocaleLowerCase("es").trim();
  const title = (source.title ?? "").toLocaleLowerCase("es").trim();
  if (segments.includes("lotes") || sourceCategory === "lotes" ||
    (/^lote\s+\d+\b/.test(title) && sourceCategory === "maquinaria")) {
    return { status: "excluded", reason: "lote", categorySellID: null };
  }
  if (segments.some((segment) => segment === "herramientas" || segment === "tools") ||
    sourceCategory === "herramientas" || sourceCategory === "tools") {
    return { status: "excluded", reason: "herramienta", categorySellID: null };
  }
  const isBraviComponent = source.providerId === "gam" && source.categoryKey === "marcas-nuevas" &&
    segments.includes("plataformas-elevadoras-bravi") && fold(source.brand ?? "") === "bravi";
  const isAccessory = isBraviComponent && (
    /^kit de elevacion\b/.test(fold(source.title ?? "")) &&
      /\baccesorio\b/.test(fold(`${source.shortDescription ?? ""} ${source.longDescription ?? ""}`)) ||
    fold(source.title ?? "") === "sky deck" && fold(source.model ?? "") === "sky deck" &&
      fold(String(source.specs?.["Modelo"] ?? "")) === "sky deck"
  );
  const isSoloGyps = source.providerId === "gam" && source.categoryKey === "marcas-nuevas" &&
    segments.includes("bravi") && fold(source.brand ?? "") === "bravi" &&
    fold(source.model ?? "") === "solo gyps" &&
    fold(String(source.specs?.["Marca"] ?? "")) === "bravi" &&
    fold(String(source.specs?.["Modelo"] ?? "")) === "solo gyps" &&
    /\bsolo gyps\b/.test(fold(source.title ?? ""));
  if (isAccessory || isSoloGyps) return { status: "excluded", reason: "accesorio", categorySellID: null };
  return categorySellID === null
    ? { status: "pending", reason: "sin-categoria", categorySellID: null }
    : { status: "proposed", reason: null, categorySellID };
};
