import type { ProductRecord } from "../../../../contracts/catalog.js";
import { editorialMetricOf, editorialQuantityOf, formatEditorialQuantity } from "./editorial-measurements.js";
import { verifiedUnbrandedEditorialSource } from "./editorial-source.js";

type EquipmentKind = "módulo sanitario" | "módulo prefabricado";

const kindOf = (value: string): EquipmentKind | null => {
  const normalized = value.normalize("NFD").replace(/[\u0300-\u036f]/gu, "").toLocaleLowerCase("es");
  if (/\bmodulo\s+(?:bano|sanitario|wc)\b/u.test(normalized)) return "módulo sanitario";
  if (/\bmodulo\s+(?:caseta|prefabricado)\b/u.test(normalized)) return "módulo prefabricado";
  return null;
};

const isAuthenticUnbrandedSource = (record: ProductRecord): boolean => {
  const kind = kindOf(record.title ?? "");
  if (!kind || record.brand?.trim() || record.model?.trim() || !verifiedUnbrandedEditorialSource(record)) return false;
  const sourceKind = kindOf(new URL(record.url ?? "").pathname.replace(/[-_]/gu, " "));
  return sourceKind === null || sourceKind === kind;
};

export const resolveUnbrandedEditorial = (
  record: ProductRecord
): { readonly short: string | null; readonly general: string | null } | null => {
  if (!isAuthenticUnbrandedSource(record)) return null;
  const kind = kindOf(record.title ?? "");
  if (!kind) return null;
  const length = editorialMetricOf(record.specs, ["Longitud"]);
  const width = editorialMetricOf(record.specs, ["Anchura"]);
  const height = editorialMetricOf(record.specs, ["Altura"]);
  const weight = editorialQuantityOf(record.specs, ["Peso"], "kg");
  const dimensions = [length !== null && length >= 0.5 && length <= 30 ? `longitud de ${formatEditorialQuantity(length)} m` : null,
    width !== null && width >= 0.5 && width <= 10 ? `anchura de ${formatEditorialQuantity(width)} m` : null,
    height !== null && height >= 1 && height <= 6 ? `altura de ${formatEditorialQuantity(height)} m` : null,
    weight !== null && weight >= 50 && weight <= 50000 ? `peso declarado de ${formatEditorialQuantity(weight)} kg` : null]
    .filter((value): value is string => value !== null);
  if (dimensions.length === 0) return null;
  const label = `${kind[0]?.toLocaleUpperCase("es") ?? ""}${kind.slice(1)}`;
  return {
    short: `${label} anunciado en la ficha con ${dimensions.slice(0, 2).join(" y ")}.`,
    general: `La ficha de origen identifica un ${kind} y declara ${dimensions.join(", ")}. Las medidas corresponden al equipo anunciado y no a otros modelos ni configuraciones.`
  };
};

export const isVerifiedUnbrandedEditorialSource = isAuthenticUnbrandedSource;
