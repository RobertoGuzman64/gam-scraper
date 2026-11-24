import type { ProductRecord } from "../../contracts/catalog.js";
import type { ImportCandidate } from "../legacy-export/contracts.js";
import { fold } from "../../preparation/classification/category-utils.js";
import { manainSourceFamily } from "../../preparation/manain/source.js";

import { documentedManainLeafSlug } from "../../preparation/manain/categories.js";

const matchingSourceRoute = (source: ProductRecord, family: string, brand: string, model: string): boolean => {
  const slug = (value: string): string => fold(value).replace(/[^a-z0-9]+/gu, "-").replace(/^-|-$/gu, "");
  const expected = `venta-${family}-${slug(brand)}-${slug(model)}`;
  try {
    const url = new URL(source.url);
    if (url.protocol !== "https:" || !["manain.com", "www.manain.com"].includes(url.hostname) || url.search || url.hash) {
      return false;
    }
    const segments = url.pathname.split("/").filter(Boolean);
    const route = segments[1] ?? "";
    return segments.length === 2 && segments[0] === "producto" &&
      (route === expected || route.startsWith(`${expected}-`) &&
        /^-[2-9][0-9]*$/u.test(route.slice(expected.length)));
  } catch {
    return false;
  }
};

export const documentedManainCommercialSlug = (
  source: ProductRecord, condition: ImportCandidate["condition"]
): string | null => {
  if (source.providerId !== "manain" || source.categoryKey !== "venta" ||
    condition !== "Segunda_Mano" || fold(String(source.specs?.["Nueva o usada"] ?? "")) !== "usada") return null;
  const family = manainSourceFamily(source);
  if (!family) return null;
  const brand = fold(source.brand ?? "");
  const model = fold(source.model ?? "");
  if (!brand || !model || fold(String(source.specs?.Marca ?? "")) !== brand ||
    fold(String(source.specs?.Modelo ?? "")) !== model) return null;
  const motor = fold(String(source.specs?.Motor ?? ""));
  const leaf = documentedManainLeafSlug(source, condition);
  if (leaf) return leaf;
  if (source.condition !== "Segunda mano" || fold(source.title ?? "") !== model) return null;
  if (family === "elevacion-mastil" && motor === "electrico" &&
    fold(String(source.specs?.["Capacidad carga"] ?? "")) === "200 kg" &&
    typeof source.specs?.["Altura trabajo"] === "string" && source.specs["Altura trabajo"].trim() &&
    typeof source.specs?.["Longitud plataforma"] === "string" && source.specs["Longitud plataforma"].trim() &&
    matchingSourceRoute(source, family, brand, model)) {
    return "plataforma-elevadora-segunda-mano";
  }
  if (family === "pequena-maquinaria-compactacion" && motor === "gasolina" &&
    /^\d+(?:[.,]\d+)? kg$/u.test(fold(String(source.specs?.Peso ?? ""))) &&
    matchingSourceRoute(source, family, brand, model)) {
    return "maquinaria-construccion-segunda-mano";
  }
  if (motor === "electrico" && matchingSourceRoute(source, family, brand, model) && (
    family === "pequena-maquinaria-bomba-sumergible" &&
      typeof source.specs?.["Caudal max."] === "string" && source.specs["Caudal max."].trim() &&
      typeof source.specs?.["Altura elevacion max"] === "string" && source.specs["Altura elevacion max"].trim() ||
    family === "pequena-maquinaria-hidrolimpiadora" &&
      typeof source.specs?.["Presion max."] === "string" && source.specs["Presion max."].trim() &&
      typeof source.specs?.["Caudal nominal"] === "string" && source.specs["Caudal nominal"].trim()
  )) {
    return "energia-aire-agua-segunda-mano";
  }
  return null;
};
