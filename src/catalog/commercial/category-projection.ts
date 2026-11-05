import type { ProductRecord } from "../../contracts/catalog.js";
import type { ImportCandidate, ImportCatalog } from "../legacy-export/contracts.js";
import type { PreparedProduct } from "../preparation/contracts.js";
import { fold } from "../preparation/mapping/category-utils.js";
import { isLeafCategoryForCondition } from "../preparation/mapping/category-mapping.js";
import { productAttributes } from "../preparation/product-attributes.js";

const generalCategorySlugs = new Set([
  "plataforma-articulada",
  "plataforma-elevadora",
  "carretilla-elevadora",
  "manipulacion-elevacion-cargas",
  "manipulacion-elevacion-cargas-segunda-mano",
  "maquinaria-construccion-segunda-mano",
  "vehiculos-segunda-mano"
]);

const sourceRoute = (source: ProductRecord): string | null => {
  try {
    const url = new URL(source.url);
    const segments = url.pathname.split("/").filter(Boolean);
    if (source.providerId === "gam" && url.hostname === "online.gamrentals.com" && segments[0] === "es") {
      return segments.at(-2) ?? null;
    }
    if (source.providerId === "gomariz" && ["www.gomarizrent.com", "gomarizrent.com"].includes(url.hostname) &&
      segments[0] === "venta") return segments.slice(1, -1).join("/");
    if (source.providerId === "mercaeleva" && url.hostname === "sales.mercaeleva.com" &&
      segments[0] === "es" && segments[1] === "for-sale" && segments[2] === "machine") return "for-sale/machine";
  } catch {
    return null;
  }
  return null;
};

const verified = (source: ProductRecord, model: RegExp, brand: string): boolean => {
  const sourceBrand = fold(source.brand ?? "");
  const specBrand = fold(typeof source.specs?.["Marca"] === "string" ? source.specs["Marca"] : "");
  const modelName = fold(source.model ?? "");
  const specModel = fold(typeof source.specs?.["Modelo"] === "string" ? source.specs["Modelo"] : "");
  return sourceBrand === fold(brand) && specBrand === fold(brand) &&
    model.test(modelName) && model.test(specModel);
};

const commercialSlug = (source: ProductRecord, condition: ImportCandidate["condition"]): string | null => {
  if (!condition) return null;
  const route = sourceRoute(source);
  if (!route) return null;
  const title = fold(source.title ?? "");
  const short = fold(source.shortDescription ?? "");
  const general = fold(source.longDescription ?? "");
  if (source.providerId === "gam") {
    if (condition === "Nuevo" && source.categoryKey === "elevacion-nueva" &&
      route === "plataformas-elevadoras-bravi" && verified(source, /^lui 460$/, "bravi") &&
      /^plataforma elevadora\b/.test(title) && title.includes("bravi lui 460") &&
      fold(String(source.specs?.["Tipo motor"] ?? "")) === "electrico") return "plataforma-elevadora";
    if (condition === "Nuevo" && source.categoryKey === "apiladores-nuevos" &&
      route === "apiladores-logitrans" && verified(source, /^ehsi$/, "logitrans") &&
      /^apilador manual de acero inoxidable\b/.test(title) &&
      /\b1000\s?kg\b/.test(title) &&
      /\b1000\s?kg\b/i.test(String(source.specs?.["Capacidad de carga (kg)"] ?? ""))) {
      return "apilador-electrico";
    }
    if (condition === "Nuevo" && ["marcas-nuevas", "otros-nuevos"].includes(source.categoryKey) && route === "packmat" &&
      /^compactador(?:a)?\b/.test(title) && verified(source, /^pk\d+(?:rc|c)?$/, "packmat") &&
      source.model && fold(source.model) === fold(String(source.specs?.["Modelo"] ?? "")) &&
      title.includes(fold(source.model)) && /\bcompactacion\b/.test(general)) return "compactador";
    if (condition === "Nuevo" && source.categoryKey === "carretillas-nuevas" &&
      route === "carretillas-elevadoras-diesel-hyster" && /\bcarretilla\b/.test(title) &&
      /\bhyster\b/.test(title) && source.model &&
      fold(String(source.specs?.["Modelo"] ?? "")) === fold(source.model) &&
      title.includes(fold(source.model)) &&
      /\b(?:diesel|glp|lpg)\b/.test(fold(String(source.specs?.["Tipo motor"] ?? "") + " " +
        String(source.specs?.["Motorización"] ?? ""))) &&
      !/\belectric[oa]\b/.test(`${title} ${short}`)) return "carretilla-elevadora";
    if (condition === "Nuevo" && source.categoryKey === "marcas-nuevas" && route === "bts" &&
      /^arrastrador a pie trailercaddy\b/.test(title) && source.model &&
      title.includes(fold(source.model)) &&
      fold(String(source.specs?.["Modelo"] ?? "")) === fold(source.model)) {
      return "manipulacion-elevacion-cargas";
    }
    if (condition === "Nuevo" && source.categoryKey === "marcas-nuevas" &&
      route === "trenes-logisticos-tecnacar" && /^tren logistico tecnacar\b/.test(title) &&
      verified(source, /^(?:e-frame simple|e-frame doble|r-portal)$/, "tecna")) {
      return "manipulacion-elevacion-cargas";
    }
    if (condition === "Nuevo" && source.categoryKey === "apiladores-nuevos" && route === "apiladores-logitrans" &&
      verified(source, /^logiflex se(?:-articuladas)?$/, "logitrans") &&
      /^apilador semi electrico\b/.test(title) && /\blogitrans\b/.test(title) &&
      fold(String(source.specs?.["Motorización"] ?? "")) === "electrico" &&
      !/\b(?:diesel|glp|gasolina)\b/.test(`${title} ${short}`)) return "apilador-electrico";
    if (condition === "Nuevo" && source.categoryKey === "limpieza-barredoras" &&
      ["tennant", "fregadoras-industriales-nuevas"].includes(route) &&
      /^barredora fregadora\b/.test(title) && /\btennant\b/.test(title) &&
      (fold(source.brand ?? String(source.specs?.["Marca"] ?? "")) === "tennant" ||
        (route === "fregadoras-industriales-nuevas" && /\btennant\b/.test(general) &&
          fold(String(source.specs?.["Modelo"] ?? "")) === fold(source.model ?? ""))) &&
      /\bbarrid[oa]\b/.test(`${short} ${general}`) && /\bfregad[oa]\b/.test(`${short} ${general}`)) {
      return "fregadora-industrial";
    }
    if (condition === "Nuevo" && source.categoryKey === "elevacion-nueva" && route === "cte" &&
      verified(source, /^vj1[25](?: fib)?$/, "cte") &&
      /^plataforma sobre furgon\b/.test(title) && /\bplataforma sobre furgon\b/.test(general)) {
      return "plataforma-sobre-camion";
    }
    if (condition === "Nuevo" && source.categoryKey === "elevacion-nueva" &&
      route === "plataforma-articulada-hibrida-xcmg" && verified(source, /^xga(?:16|18|20)h$/, "xcmg") &&
      /^plataforma articulada hibrida\b/.test(title) &&
      fold(String(source.specs?.["Tipo motor"] ?? "")) === "hibrida" &&
      /\bpropulsion hibrid[ao]\b|\bsistema hibrido\b/.test(general)) return "plataforma-articulada";
    if (condition === "Nuevo" && source.categoryKey === "marcas-nuevas" && route === "modula" &&
      (/^almacen automatico vertical\b/.test(title) || /\balmacen automatico\b/.test(title)) &&
      /\balmacen automatico vertical\b/.test(general) &&
      verified(source, /^(?:mc|mx|ml|msl)\d{2}(?:d)?$/, "modula")) return "manipulacion-elevacion-cargas";
    if (condition === "Nuevo" && source.categoryKey === "otros-nuevos" && route === "ormig" &&
      /^grua electrica\b/.test(title) && /\bgrua\b/.test(general) &&
      fold(source.brand ?? "") === "ormig" && fold(String(source.specs?.["Marca"] ?? "")) === "ormig" &&
      !!source.model && fold(source.model) === fold(String(source.specs?.["Modelo"] ?? ""))) {
      return "manipulacion-elevacion-cargas";
    }
    if (condition === "Segunda_Mano" && source.categoryKey === "movilidad" && route === "vehiculos-segunda-mano" &&
      source.model &&
      (title.includes(fold(source.model)) ||
        (/\b(?:alfa romeo|audi|land rover|peugeot)\b/.test(title) &&
          /\bmatricula\b/i.test(Object.keys(source.specs ?? {}).map(fold).join(" ")))) &&
      /\b(?:vehiculo|coche|automovil|cabriolet|cabrio|land rover)\b/.test(`${title} ${short} ${general}`)) {
      return "vehiculos-segunda-mano";
    }
    if (condition === "Segunda_Mano" && source.categoryKey === "otros" &&
      route === "resto-maquinaria-segunda-mano" &&
      fold(source.brand ?? "") === "nooteboom" &&
      fold(String(source.specs?.["Marca"] ?? "")) === "nooteboom" &&
      source.model && fold(source.model) === fold(String(source.specs?.["Modelo"] ?? "")) &&
      /\b(?:platafora|plataforma|semiremolque)\b/.test(title) &&
      Object.keys(source.specs ?? {}).some((key) => fold(key) === "matricula") &&
      /\b(?:matriculado|itv)\b/.test(general)) return "vehiculos-segunda-mano";
    if (condition === "Segunda_Mano" && source.categoryKey === "maquinaria" &&
      route === "furgonetas-electricas-de-ocasion" &&
      /\bcuatriciclo electrico\b/.test(`${short} ${general}`)) return "vehiculos-segunda-mano";
  }
  if (source.providerId === "gomariz" && condition === "Segunda_Mano") {
    if (route === "camion/camion-porta-maquinaria" &&
      /\bcamion\b|\b(?:renault|scania)\b/.test(title) && /\bcamion\b/.test(`${short} ${general}`)) {
      return "vehiculos-segunda-mano";
    }
    if (route === "movimiento-de-tierras-demolicion-y-compactacion/retroexcavadora" &&
      /\bjcb 1cx\b/.test(title) && /\bretroexcavadora\b/.test(general)) {
      return "maquinaria-construccion-segunda-mano";
    }
    if (route === "elevacion-y-trabajos-en-altura/elevador-mastil-vertical" &&
      /\bgenie sla15\b/.test(title) && fold(source.model ?? "") === "sla15" &&
      (/\bmaterial(?:es)?\b/.test(general) || /\balmacenaje\b/.test(general)) &&
      /\b363\s?kg\b/i.test(String(source.specs?.["Capacidad"] ?? ""))) {
      return "manipulacion-elevacion-cargas-segunda-mano";
    }
  }
  if (source.providerId === "mercaeleva" && condition === "Segunda_Mano" &&
    route === "for-sale/machine" && /\bcamion porta-vehiculos\b/.test(title) &&
    /\bcamion porta-vehiculos\b/.test(general) &&
    fold(source.brand ?? "") === "iveco") return "vehiculos-segunda-mano";
  return null;
};

const belongsToCondition = (
  categoryId: number, categories: ImportCatalog["categories"], condition: Exclude<ImportCandidate["condition"], null>
): boolean => {
  const expectedRoot = condition === "Nuevo" ? "maquinaria nueva" : "maquinaria de ocasion";
  const byId = new Map(categories.map((item) => [item.id, item]));
  let cursor = byId.get(categoryId);
  const visited = new Set<number>();
  while (cursor && !visited.has(cursor.id) && cursor.active !== false) {
    if (fold(cursor.name) === expectedRoot) return true;
    visited.add(cursor.id);
    cursor = cursor.parentId === null ? undefined : byId.get(cursor.parentId);
  }
  return false;
};

export const isValidCommercialCategory = (
  source: ProductRecord, categoryId: number, condition: ImportCandidate["condition"], catalog: ImportCatalog
): boolean => {
  if (!condition) return false;
  const categories = catalog.categories.filter((item) => item.id === categoryId && item.active !== false);
  if (categories.length !== 1 || !belongsToCondition(categoryId, catalog.categories, condition)) return false;
  if (isLeafCategoryForCondition(categoryId, catalog.categories, condition)) return true;
  const category = categories[0];
  return !!category && generalCategorySlugs.has(category.slug) &&
    commercialSlug(source, condition) === category.slug;
};

export const projectCommercialCategory = (
  source: ProductRecord, mapped: PreparedProduct, catalog: ImportCatalog
): PreparedProduct => {
  if (mapped.product.categorySellID !== null) return mapped;
  const slug = commercialSlug(source, mapped.product.condition);
  if (!slug) return mapped;
  const candidates = catalog.categories.filter((item) => item.slug === slug && item.active !== false);
  const category = candidates.length === 1 ? candidates[0] : undefined;
  if (!category || !isValidCommercialCategory(source, category.id, mapped.product.condition, catalog)) return mapped;
  const resolved = productAttributes(source, category, catalog);
  const product: ImportCandidate = {
    ...mapped.product, categorySellID: category.id, category: category.name,
    attributes: resolved.attributes.length ? resolved.attributes : mapped.product.attributes
  };
  return { ...mapped, product };
};
