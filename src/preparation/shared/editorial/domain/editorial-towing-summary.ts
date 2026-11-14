import { containsEditorialIdentity } from "./editorial-identity-match.js";
import type { ProductRecord } from "../../../../contracts/catalog.js";
import type { ImportCandidate } from "../../../../commercial/legacy-export/contracts.js";
import { normalizeEditorialSummary } from "./editorial-normalization.js";
import { resolveVerifiedEditorialCondition } from "./editorial-condition.js";

type AdvertisedSummary = Readonly<{
  label: string;
  condition: string;
  capacity: number;
}>;

const compact = (value: string): string => value.normalize("NFD")
  .replace(/[\u0300-\u036f]/gu, "").toLocaleLowerCase("es").replace(/[^a-z0-9]/gu, "");

const kilograms = (value: string): number | null => {
  const cleaned = value.replace(/\s/gu, "").replace(/\.(?=\d{3}(?:\D|$))/gu, "").replace(",", ".");
  const parsed = Number(cleaned);
  return Number.isSafeInteger(parsed) && parsed > 0 && parsed <= 100000 ? parsed : null;
};

const sourceSummary = (text: string): AdvertisedSummary | null => {
  const match = /^➨\s*(.+?)\s+(Segunda Mano|nuevo)\s+➨\s*Venta de arrastrador a pie(?: nuevo)?\s*⭐\s*Capacidad de arrastre\s+([\d.,]+)\s*Kg\s*$/iu.exec(text.trim());
  if (!match?.[1] || !match[2] || !match[3]) return null;
  const capacity = kilograms(match[3]);
  return capacity === null ? null : { label: match[1], condition: match[2], capacity };
};

const titleLabel = (title: string, summaryLabel: string): string | null => {
  const prefix = summaryLabel.trim().split(/\s+/u)[0];
  if (!prefix) return null;
  const label = title.split(/\s+/u);
  const index = label.findIndex((word) => compact(word) === compact(prefix));
  return index < 0 ? null : label.slice(index).join(" ");
};

export const normalizeCorroboratedTowingSummary = (
  source: ProductRecord, prepared: ImportCandidate, summary: string | null
): string | null => {
  if (!summary || !source.shortDescription || !source.longDescription || !source.title || !source.model ||
    resolveVerifiedEditorialCondition(source) !== "Nuevo" || prepared.condition !== "Nuevo" ||
    source.reference !== prepared.reference ||
    source.url !== prepared.sourceUrl || !source.reference ||
    typeof source.specs?.Modelo !== "string" || compact(source.specs.Modelo) !== compact(source.model) ||
    !containsEditorialIdentity(source.title, source.model) ||
    !containsEditorialIdentity(prepared.title ?? "", source.model) ||
    summary !== normalizeEditorialSummary(source.shortDescription, source.model)) return summary;
  const announced = sourceSummary(source.shortDescription);
  const unitLabel = announced && titleLabel(source.title, announced.label);
  if (!announced || !unitLabel || !compact(source.longDescription).includes(compact(unitLabel))) return summary;
  const declared = source.specs?.["Capacidad de arrastre"];
  const capacityMatch = typeof declared === "string" ? /^([\d.,]+)\s*kg$/iu.exec(declared.trim()) : null;
  const declaredKg = capacityMatch?.[1] ? kilograms(capacityMatch[1]) : null;
  const described = [...source.longDescription.matchAll(/\bmueve hasta\s+([\d.,]+)\s*kg\b/giu)];
  if (declaredKg !== announced.capacity || described.length !== 1 ||
    !described[0]?.[1] || kilograms(described[0][1]) !== declaredKg) return summary;
  const original = compact(announced.label);
  const expected = compact(unitLabel);
  if (original !== expected && compact(source.longDescription).includes(original)) return summary;
  const prefix = `${announced.label} ${announced.condition}`;
  if (!summary.startsWith(prefix)) return summary;
  const corrected = `${unitLabel} ${announced.condition === "Segunda Mano" ? "nuevo" : announced.condition}`;
  return corrected === prefix ? summary : corrected + summary.slice(prefix.length);
};
