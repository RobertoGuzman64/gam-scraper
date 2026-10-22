import type { ProductRecord } from "../../../../../contracts/catalog.js";
import type { Attribute, Candidate } from "../../attribute-types.js";
import { fold, numberToken, scalar } from "../../attribute-utils.js";

const sourceSection = (record: ProductRecord): string | null => {
  if (record.providerId !== "gam") return null;
  try {
    const url = new URL(record.url);
    const path = url.pathname.split("/").filter(Boolean);
    return url.hostname === "online.gamrentals.com" && path[0] === "es" ? path[1] ?? null : null;
  } catch {
    return null;
  }
};

const manipulatorCandidate = (record: ProductRecord, attribute: Attribute): Candidate | null => {
  if (record.categoryKey !== "otros-nuevos" || sourceSection(record) !== "xcmg-manipulacion" ||
    !/\bmanipulador\s+telescopico\b/.test(fold(record.title ?? "")) ||
    !record.model || !fold(record.title ?? "").includes(fold(record.model))) return null;
  const description = record.longDescription ?? "";
  if (attribute.name === "Capacidad máxima" && attribute.type === "NUMBER" && attribute.unit_option === "kg") {
    const source = record.specs?.["Capacidad de carga (kg)"];
    const raw = source === undefined ? null : scalar(source);
    if (raw === null || typeof raw === "boolean") return null;
    const sourceValue = numberToken(String(raw).replace(/\s*(?:kg|kilogramos?)$/i, ""));
    if (sourceValue === null || sourceValue <= 0) return null;
    const capacities = [...fold(description).matchAll(
      /\bcapacidad\s+(?:maxima|nominal)\s+(?:de\s+)?(?:carga\s+)?(?:de\s+)?(\d[\d.,]*)\s*(?:kg|kilogramos?)\b/g
    )];
    const text = fold(description);
    if (capacities.some((match) => !match[1] || numberToken(match[1]) !== sourceValue ||
      /^(?:\s*(?:o|y|hasta|\/|-)\s*)\d[\d.,]*\s*(?:kg|kilogramos?)\b/.test(
        text.slice((match.index ?? 0) + match[0].length, (match.index ?? 0) + match[0].length + 45)
      ))) return null;
    return { key: "Capacidad de carga (kg)", value: raw };
  }
  if (attribute.name === "Altura máxima de elevación" && attribute.type === "NUMBER" && attribute.unit_option === "m") {
    const source = record.specs?.["Altura de elevación (m)"];
    const raw = source === undefined ? null : scalar(source);
    if (raw === null || typeof raw === "boolean") return null;
    const sourceValue = numberToken(String(raw).replace(/\s*(?:metros?|m)$/i, ""));
    if (sourceValue === null || sourceValue <= 0) return null;
    const heights = [...fold(description).matchAll(
      /\baltura\s+maxima\s+de\s+elevacion\s+(?:de\s+)?(\d[\d.,]*)\s*(?:metros?|m)\b/g
    )];
    const text = fold(description);
    if (heights.some((match) => !match[1] || numberToken(match[1]) !== sourceValue ||
      /^(?:\s*(?:o|y|hasta|\/|-)\s*)\d[\d.,]*\s*(?:metros?|m)\b/.test(
        text.slice((match.index ?? 0) + match[0].length, (match.index ?? 0) + match[0].length + 45)
      ))) return null;
    return { key: "Altura de elevación (m)", value: raw };
  }
  return null;
};

const tractorCandidate = (record: ProductRecord, attribute: Attribute): Candidate | null => {
  if (attribute.name !== "Motorización / Energía" || attribute.type !== "SELECT" ||
    !["otros-nuevos", "marcas-nuevas"].includes(record.categoryKey) ||
    !/\btractor\b.*\belectrico\b/.test(fold(record.title ?? "")) ||
    !/^tractores-(?:electricos|arrastre)/.test(sourceSection(record) ?? "")) return null;
  const source = record.specs?.["Motorización"];
  const motor = source === undefined ? null : scalar(source);
  if (typeof motor !== "string" || fold(motor) !== "electrico") return null;
  return { key: "Motorización", value: "Eléctrico" };
};

export const gamSpecializedCandidate = (record: ProductRecord, attribute: Attribute): Candidate | null => {
  if (sourceSection(record) === null) return null;
  return manipulatorCandidate(record, attribute) ?? tractorCandidate(record, attribute);
};
