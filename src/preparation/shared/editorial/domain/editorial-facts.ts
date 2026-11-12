import type { ProductRecord } from "../../../../contracts/catalog.js";
import { resolveEditorialSource } from "./editorial-source.js";
import type { EditorialSource } from "./editorial-source-contract.js";

type Family = "plataforma-tijera" | "plataforma-articulada" | "plataforma-telescopica" | "carretilla-elevadora";

type EditorialFacts = {
  readonly family: Family;
  readonly brand: string;
  readonly model: string;
  readonly workingHeightM: number | null;
  readonly lateralReachM: number | null;
  readonly liftingHeightM: number | null;
  readonly loadCapacityKg: number | null;
  readonly energy: "eléctrica" | "diésel" | null;
};

const measured = (value: unknown, unit: "m" | "mm" | "kg"): number | null => {
  if (typeof value !== "string") return null;
  const text = value.trim();
  const match = unit === "kg" ? /^(\d{1,3}(?:[. ]\d{3})*|\d+)\s*kg$/iu.exec(text)
    : unit === "mm" ? /^(\d+)\s*mm$/iu.exec(text)
      : /^(\d+(?:[.,]\d{1,2})?)\s*(?:m|metros?)$/iu.exec(text);
  if (!match?.[1]) return null;
  const raw = unit === "kg" ? match[1].replace(/[. ]/gu, "") : match[1].replace(",", ".");
  const number = Number(raw);
  return Number.isFinite(number) && number > 0 ? number : null;
};

const familyOf = (source: EditorialSource): Family | null => {
  const clues = source.familyClues.normalize("NFD")
    .replace(/[\u0300-\u036f]/gu, "").toLocaleLowerCase("es");
  const isScissor = /\b(?:tijera|tijeras|scissor|elevador-tijera)\b/u.test(clues);
  const isForklift = /\b(?:carretilla|carretillas|forklift)\b/u.test(clues);
  const isTelescopicPlatform = /\b(?:plataformas?[-\s]+telescopic[oa]s?|brazo[-\s]+telescopic[oa]s?)\b/u.test(clues);
  const isArticulated = /\b(?:articulad[oa]s?|articulating)\b/u.test(clues) ||
    (/\bboom-lift\b/u.test(clues) && !isTelescopicPlatform);
  const incompatible = /\b(?:telescopic[oa]s?|manipulador|oruga|retr[aá]ctil)\b/u.test(clues);
  if (isScissor && !isForklift && !isArticulated && !isTelescopicPlatform && !incompatible &&
    source.workingHeight !== undefined) return "plataforma-tijera";
  if (isArticulated && !isScissor && !isForklift && !isTelescopicPlatform && !incompatible &&
    source.workingHeight !== undefined) return "plataforma-articulada";
  if (isTelescopicPlatform && !isScissor && !isForklift && !isArticulated &&
    !/\b(?:manipulador|oruga|retractil|camion[-\s]+cesta)\b/u.test(clues) &&
    source.workingHeight !== undefined) return "plataforma-telescopica";
  if (isForklift && !isScissor && !isArticulated && !isTelescopicPlatform && !/\b(?:manipulador|transpalet|plataforma|tijera)\b/u.test(clues)) {
    return "carretilla-elevadora";
  }
  return null;
};

const energyOf = (record: ProductRecord, raw: EditorialSource["motor"]): "eléctrica" | "diésel" | null | false => {
  if (raw === undefined) return null;
  if (typeof raw !== "string") return false;
  const value = raw.trim().normalize("NFD").replace(/[\u0300-\u036f]/gu, "").toLowerCase();
  const energy = value === "electrico" ? "eléctrica" : value === "diesel" ? "diésel" : null;
  if (energy === null) return false;
  const text = `${record.title ?? ""} ${record.longDescription ?? ""}`.normalize("NFD")
    .replace(/[\u0300-\u036f]/gu, "").toLowerCase();
  if (energy === "eléctrica" && /\bdiesel\b/u.test(text)) return false;
  if (energy === "diésel" && /\belectric[oa]s?\b/u.test(text)) return false;
  return energy;
};

export const resolveEditorialFacts = (record: ProductRecord): EditorialFacts | null => {
  const source = resolveEditorialSource(record);
  if (!source) return null;
  const family = familyOf(source);
  if (!family) return null;
  const energy = energyOf(record, source.motor);
  if (energy === false) return null;
  const workingHeightM = measured(source.workingHeight, "m");
  const lateralReachM = measured(source.lateralReach, "m");
  const liftingHeight = measured(source.liftingHeight, source.liftingHeightUnit);
  const liftingHeightM = liftingHeight === null ? null :
    source.liftingHeightUnit === "mm" ? liftingHeight / 1000 : liftingHeight;
  const loadCapacityKg = measured(source.loadCapacity, "kg");
  if (source.loadCapacity !== undefined && loadCapacityKg === null) return null;
  if (source.workingHeight !== undefined && family !== "carretilla-elevadora" && workingHeightM === null) return null;
  if ((family === "plataforma-articulada" || family === "plataforma-telescopica") &&
    source.lateralReach !== undefined && lateralReachM === null) return null;
  if (family === "carretilla-elevadora" && source.liftingHeight !== undefined && liftingHeight === null) return null;
  if (family !== "carretilla-elevadora" &&
    (workingHeightM === null || workingHeightM < 3 || workingHeightM > 60)) return null;
  if (lateralReachM !== null && (lateralReachM < 0.5 || lateralReachM > 60)) return null;
  if (family === "carretilla-elevadora" &&
    (loadCapacityKg === null || loadCapacityKg < 200 || loadCapacityKg > 50000)) return null;
  if (loadCapacityKg !== null && (loadCapacityKg < 100 || loadCapacityKg > 50000)) return null;
  if (liftingHeightM !== null && (liftingHeightM < 0.5 || liftingHeightM > 30)) return null;
  if (family === "carretilla-elevadora") {
    const announced = /\b(\d{3,5})\s*kg\b/iu.exec(record.title ?? "")?.[1];
    if (announced && Number(announced) !== loadCapacityKg) return null;
  }
  return {
    family,
    brand: source.brand,
    model: source.model,
    workingHeightM: family !== "carretilla-elevadora" ? workingHeightM : null,
    lateralReachM: family === "plataforma-articulada" || family === "plataforma-telescopica" ? lateralReachM : null,
    liftingHeightM: family === "carretilla-elevadora" ? liftingHeightM : null,
    loadCapacityKg,
    energy
  };
};

export type { EditorialFacts };
