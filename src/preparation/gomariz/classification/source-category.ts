import type { ProductRecord } from "../../../contracts/catalog.js";
import { fold } from "../../classification/category-utils.js";
import { verifiedEditorialUrl } from "../../editorial/source/editorial-source-url.js";
import { gomarizProductFamily } from "./product-family.js";

const currentRouteFamilies: Readonly<Record<string, readonly string[]>> = {
  "elevacion-y-trabajos-en-altura": [
    "elevador-tijera", "brazo-articulado", "brazo-articulado-boom-lift", "brazo-telescopico",
    "elevador-mastil-vertical", "camion-plataforma", "oruga"
  ],
  "manipulacion-de-materiales": ["carretilla-industrial", "carretilla-todoterreno", "manipulador-telescopico", "carretilla-retractil"],
  "energia-electrica-e-iluminacion": ["generador", "torre-de-luz"],
  "movimiento-de-tierras-demolicion-y-compactacion": ["rodillo", "dumper"],
  limpieza: ["fregadora"]
};

export const gomarizSourceFamily = (record: ProductRecord, path: readonly string[]): string | null => {
  const documentedFamily = gomarizProductFamily(record, path);
  if (documentedFamily || path[0] === "producto") return documentedFamily;
  if (path[0] === "venta" && path.length >= 4) return path[2] ?? null;
  if (path.length !== 3) return null;
  const [section, family] = path;
  return family && currentRouteFamilies[section ?? ""]?.includes(family) ? family : null;
};

export const gomarizDocumentedSourceType = (record: ProductRecord, path: readonly string[]): boolean => {
  if (path.length !== 4 || path[0] !== "venta") return false;
  const source = `${path[1]}/${path[2]}`;
  const detail = fold(path[3] ?? "");
  const brand = fold(record.brand ?? "");
  const title = fold(record.title ?? "");
  const model = fold(record.model ?? "");
  const modelSlug = model.replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  if (!brand || !modelSlug || !title.includes(brand) ||
    !detail.includes(brand) || !detail.includes(modelSlug)) return false;
  switch (source) {
    case "camion/camion-porta-maquinaria":
      return /camion-(?:truck-)?porta-?maquinaria/.test(detail);
    case "movimiento-de-tierras-demolicion-y-compactacion/retroexcavadora":
      return /retroexcavadora/.test(detail) && /\b1cx\b/.test(title) && /\b1cx\b/.test(detail);
    case "elevacion-y-trabajos-en-altura/elevador-mastil-vertical":
      return /elevador-mastil-vertical/.test(detail) && /\bsla15\b/.test(title) && /\bsla15\b/.test(detail);
    default:
      return false;
  }
};

export const gomarizTechnicalSourceFamily = (record: ProductRecord): string | null => {
  if (record.providerId !== "gomariz") return null;
  const url = verifiedEditorialUrl(record.url, ["gomarizrent.com", "www.gomarizrent.com"]);
  if (!url) return null;
  const path = url.pathname.split("/").filter(Boolean);
  if (path[0] === "venta") {
    if (path.length !== 4) return null;
    const section = path[1] ?? "";
    const family = path[2] ?? "";
    if (!currentRouteFamilies[section]?.includes(family) &&
      !(section === "movimiento-de-tierras-demolicion-y-compactacion" && family === "retroexcavadora")) return null;
  }
  return gomarizSourceFamily(record, path);
};
