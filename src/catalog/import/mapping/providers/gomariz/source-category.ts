import type { ProductRecord } from "../../../../../contracts/catalog.js";
import { fold } from "../../category-utils.js";

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
