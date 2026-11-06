import type { ImportCandidate, ImportCatalog } from "../../legacy-export/contracts.js";
import { fold } from "./attribute-utils.js";

type Attribute = ImportCatalog["attributes"][number];
type Assignment = ImportCandidate["attributes"][number];
type AttributeValueIssue = "tipo-invalido" | "opcion-invalida" | "opciones-no-definidas";

export const validateCommercialAttributeValue = (
  attribute: Attribute, value: Assignment["value"]
): AttributeValueIssue | null => {
  if (attribute.type === "NUMBER" || attribute.type === "DECIMAL") {
    return typeof value === "number" && Number.isFinite(value) && value >= 0 ? null : "tipo-invalido";
  }
  if (attribute.type === "BOOLEAN") return typeof value === "boolean" ? null : "tipo-invalido";
  if (attribute.type === "TEXT") return typeof value === "string" && value.trim().length > 0 ? null : "tipo-invalido";
  if (attribute.type === "SELECT") {
    if (typeof value !== "string" || value.trim().length === 0) return "tipo-invalido";
    const options = attribute.unit_option.split(/\s+\/\s+/).map((option) => option.trim()).filter(Boolean);
    if (options.length === 0) return "opciones-no-definidas";
    return options.some((option) => fold(option) === fold(value)) ? null : "opcion-invalida";
  }
  return "tipo-invalido";
};

