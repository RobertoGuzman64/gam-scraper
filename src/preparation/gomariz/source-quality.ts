import type { ProductRecord } from "../../contracts/catalog.js";
import { fold } from "../classification/attribute-utils.js";
import { verifiedSourceHost } from "../classification/category-utils.js";
import { verifiedGomarizPlatformHeight } from "../../catalog/normalization/gomariz/technical.js";

const sourceGomariz = (record: ProductRecord): boolean =>
  record.providerId === "gomariz" && record.categoryKey === "venta" &&
  (verifiedSourceHost(record.url, "www.gomarizrent.com") || verifiedSourceHost(record.url, "gomarizrent.com")) &&
  Boolean(record.reference?.trim());

const metres = (value: unknown): number | null => {
  if (typeof value !== "string") return null;
  const match = /^(\d+(?:[.,]\d{1,2})?)\s*m$/iu.exec(value.trim());
  const number = match?.[1] ? Number(match[1].replace(",", ".")) : NaN;
  return Number.isFinite(number) && number > 0 ? number : null;
};

export const gomarizSemanticQualityIssues = (record: ProductRecord): readonly string[] => {
  if (!sourceGomariz(record)) return [];
  const issues: string[] = [];
  const platform = metres(record.specs?.["Altura plataforma"]);
  const working = metres(record.specs?.["Altura de trabajo"]);
  if (platform !== null && working !== null && platform > working &&
    verifiedGomarizPlatformHeight(record) === null) {
    issues.push("Alturas contradictorias: la altura de plataforma supera la altura de trabajo publicada");
  }
  const motor = record.specs?.Motor;
  const general = fold(record.longDescription ?? "");
  if (typeof motor === "string" && fold(motor) === "electrico" &&
    /^las articuladas diesel\b/u.test(general) &&
    /\/brazo-articulado(?:-boom-lift)?\//u.test(new URL(record.url).pathname)) {
    issues.push("Motorización contradictoria: la ficha técnica indica eléctrico y la descripción dice diésel");
  }
  return issues;
};

