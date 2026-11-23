import type { ProductRecord } from "../../contracts/catalog.js";
import type { ImportCandidate } from "../legacy-export/contracts.js";
import { fold } from "../../preparation/shared/classification/mapping/category-utils.js";
import { manainSourceFamily } from "../../preparation/manain/technical/evidence/source.js";

const singleOperatorModels: ReadonlyMap<string, string> = new Map([
  ["genie:gr-15", "227 kg"],
  ["genie:grc-12", "227 kg"],
  ["skyjack:sj16", "227 kg"],
  ["jlg:1230es", "230 kg"]
]);

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
  if (family === "elevacion-mastil" && motor === "electrico" &&
    typeof source.specs?.["Altura trabajo"] === "string" && source.specs["Altura trabajo"].trim()) {
    const capacity = singleOperatorModels.get(`${brand}:${model}`);
    if (capacity && fold(String(source.specs?.["Capacidad carga"] ?? "")) === capacity) {
      return "plataformas-unipersonales-segunda-mano";
    }
  }
  if (family === "manipulacion-apilador" && brand === "atlet" && model === "160 sth sn 380" &&
    motor === "electrico" && fold(String(source.specs?.["Capacidad carga"] ?? "")) === "1600 kg") {
    return "apiladores-electricos-segunda-mano";
  }
  if (family === "movimiento-tierra-rodillo-compactador" && brand === "wacker" && model === "rd 28-120" &&
    motor === "diesel" && fold(String(source.specs?.["Diametro del tambor"] ?? "")) === "720 mm" &&
    fold(String(source.specs?.Peso ?? "")) === "2695 kg") {
    return "rodillo-tandem-segunda-mano";
  }
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
