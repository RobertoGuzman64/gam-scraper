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
  return null;
};
