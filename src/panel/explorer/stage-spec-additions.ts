import type { SpecValue } from "../../contracts/catalog.js";
import type { PanelSpecAddition } from "./types.js";

export const stageSpecAddition = (
  stage: "original" | "published" | "commercial", field: string, value: SpecValue,
  additions: readonly PanelSpecAddition[], normalizedFields: ReadonlyMap<string, string>
): PanelSpecAddition | null => {
  if (stage === "original") return null;
  const normalized = field.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
  const canonical = normalizedFields.get(normalized) ?? field.trim();
  const actual = typeof value === "string" ? value : JSON.stringify(value);
  return additions.find((addition) => addition.field === canonical && addition.value === actual) ?? null;
};
