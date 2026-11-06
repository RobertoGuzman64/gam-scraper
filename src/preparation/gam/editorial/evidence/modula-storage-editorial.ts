import type { ProductRecord, SpecsMap } from "../../../../contracts/catalog.js";
import { fold } from "../../../shared/classification/mapping/attribute-utils.js";

export const reconcileGamModulaStorageSummary = (
  source: ProductRecord, short: string | null, specs: SpecsMap
): string | null => {
  if (!short || source.providerId !== "gam" || source.categoryKey !== "marcas-nuevas" ||
    source.condition !== "Nuevo" || fold(source.brand ?? "") !== "modula" ||
    fold(String(source.specs?.["Marca"] ?? "")) !== "modula" ||
    source.specs?.["Carga neta por bandeja"] !== undefined ||
    specs["Carga neta por bandeja"] !== "350 kg") return short;
  const model = source.model;
  if (!model || !/^MSL(?:13|19|25)$/.test(model) || source.specs?.["Modelo"] !== model ||
    specs["Modelo"] !== model || !source.title?.includes(`MODULA ${model}`)) return short;
  let path: string[];
  try {
    const url = new URL(source.url);
    if (url.hostname !== "online.gamrentals.com") return short;
    path = url.pathname.split("/").filter(Boolean);
  } catch {
    return short;
  }
  if (path.length !== 3 || path[0] !== "es" || path[1] !== "modula" ||
    !path[2]?.startsWith(`${source.reference}-`)) return short;
  const expectedHeight: Readonly<Record<string, string>> = {
    MSL13: "1,3", MSL19: "1,9", MSL25: "2,5"
  };
  const height = expectedHeight[model];
  if (!height || specs.Altura !== `${Number(height.replace(",", ".")) * 1000} mm` ||
    !short.includes(`MODULA ${model} nuevo`) ||
    !short.includes(`de ${height} metros de altura`) ||
    !short.includes(`Altura ${height} metros`) ||
    !short.includes("⭐Capacidad del almacén ➨")) return short;
  return short.replace("⭐Capacidad del almacén ➨", "⭐Carga neta por bandeja: 350 kg ➨");
};
