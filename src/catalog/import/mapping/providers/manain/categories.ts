import type { ProductRecord } from "../../../../../contracts/catalog.js";
import type { ImportCandidate } from "../../../preparation/contracts.js";
import { fold } from "../../category-utils.js";
import { manainSourceDescriptionContradictsFamily, manainSourceFamily } from "./source.js";

const energyOf = (record: ProductRecord): "diesel" | "electrica" | null => {
  const raw = record.specs?.Motor;
  if (raw !== undefined && typeof raw !== "string") return null;
  const motor = fold(raw ?? "");
  const motorEnergy = motor === "diesel" ? "diesel" : motor === "electrico" ? "electrica" : null;
  if (motor && !motorEnergy) return null;
  const text = fold(`${record.title ?? ""} ${record.shortDescription ?? ""}`);
  const textDiesel = /\bdiesel\b/.test(text);
  const textElectric = /\belectric[oa]\b/.test(text);
  if (textDiesel && textElectric || /\b(?:gasolina|glp|hibrid[oa])\b/.test(text)) return null;
  const textEnergy = textDiesel ? "diesel" : textElectric ? "electrica" : null;
  return motorEnergy && textEnergy && motorEnergy !== textEnergy ? null : motorEnergy ?? textEnergy;
};

export const manainCategorySlug = (record: ProductRecord, condition: ImportCandidate["condition"]): string | null => {
  if (condition === null) return null;
  const family = manainSourceFamily(record);
  if (!family || manainSourceDescriptionContradictsFamily(record, family)) return null;
  const used = condition === "Segunda_Mano";
  if (family === "elevacion-tijera" || family === "elevacion-brazo-articulado") {
    const energy = energyOf(record);
    if (!energy) return null;
    const kind = family === "elevacion-tijera" ? "tijera" : "articulada";
    const usedKind = family === "elevacion-tijera" ? "tijera" : "articuladas";
    return used ? `plataformas-${usedKind}-${energy === "diesel" ? "diesel" : "electricas"}-segunda-mano` :
      `plataforma-${kind}-${energy === "diesel" ? "diesel" : "electrica"}`;
  }
  if (family === "elevacion-brazo-telescopico") {
    if (used) return "plataformas-elevadoras-telescopicas-segunda-mano";
    const energy = energyOf(record);
    return energy ? `plataforma-telescopica-${energy}` : null;
  }
  if (family === "elevacion-camion-cesta") return used ? "plataformas-elevadoras-sobre-camion-segunda-mano" : "plataforma-sobre-camion";
  if (family === "movimiento-tierra-miniexcavadora") return used ? "miniexcavadoras-segunda-mano" : "miniexcavadora";
  if (family === "energia-grupo-electrogeno") return used ? "grupos-electrogenos-segunda-mano" : "grupos-electrogenos";
  return null;
};
