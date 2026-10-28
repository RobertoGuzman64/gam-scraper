import { isDeepStrictEqual } from "node:util";
import type { EditableInterventionField, ManualInterventionProposal } from "./contracts.js";

const textualFields: ReadonlySet<string> = new Set<EditableInterventionField>([
  "title", "shortDescription", "longDescription", "brand", "model"
]);

export const isSpecField = (field: string): field is `spec:${string}` =>
  field.startsWith("spec:") && field.slice(5).trim().length > 0 && field.slice(5) === field.slice(5).trim();

const isEditableField = (field: string): field is EditableInterventionField =>
  textualFields.has(field) || isSpecField(field);

const keys = new Set(["providerId", "identity", "field", "expected", "next", "reason", "evidence"]);

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const requiredText = (value: unknown, name: string): string => {
  if (typeof value !== "string" || !value.trim()) throw new Error(`${name} debe ser texto no vacío`);
  return value;
};

const nullableText = (value: unknown, name: string): string | null => {
  if (value !== null && typeof value !== "string") throw new Error(`${name} debe ser texto o null`);
  return value;
};

const specValue = (value: unknown, name: string): ManualInterventionProposal["next"] => {
  const scalar = (entry: unknown): entry is string | number | boolean =>
    typeof entry === "string" || typeof entry === "boolean" ||
    (typeof entry === "number" && Number.isFinite(entry));
  if (scalar(value)) return value;
  if (Array.isArray(value) && value.length > 0 && value.every(scalar)) return value;
  throw new Error(`${name} debe ser un valor técnico concreto y no vacío`);
};

export const validateInterventionProposals = (input: unknown, providerId: string): readonly ManualInterventionProposal[] => {
  if (!Array.isArray(input) || input.length === 0) throw new Error("El script debe exportar proposals como un array no vacío");
  const seen = new Set<string>();
  const proposals: ManualInterventionProposal[] = [];

  for (const [index, item] of input.entries()) {
    const label = `Propuesta ${index + 1}`;
    if (!isObject(item)) throw new Error(`${label}: objeto inválido`);
    for (const key of Object.keys(item)) {
      if (!keys.has(key)) throw new Error(`${label}: propiedad no permitida: ${key}`);
    }
    if (Object.keys(item).length !== keys.size) throw new Error(`${label}: deben indicarse los siete campos obligatorios`);
    const provider = requiredText(item.providerId, `${label}.providerId`);
    if (provider !== providerId) throw new Error(`${label}: proveedor diferente del solicitado: ${provider}`);
    const identity = requiredText(item.identity, `${label}.identity`);
    if (!identity.startsWith(`${provider}:`)) throw new Error(`${label}: identidad incompatible con el proveedor`);
    const field = requiredText(item.field, `${label}.field`);
    if (!isEditableField(field)) throw new Error(`${label}: campo prohibido: ${field}`);
    const expected = isSpecField(field)
      ? specValue(item.expected, `${label}.expected`) : nullableText(item.expected, `${label}.expected`);
    const next = isSpecField(field)
      ? specValue(item.next, `${label}.next`) : nullableText(item.next, `${label}.next`);
    if ((field === "brand" || field === "model") && (typeof next !== "string" || !next.trim())) {
      throw new Error(`${label}: marca y modelo requieren texto contrastado no vacío`);
    }
    if (isDeepStrictEqual(expected, next)) throw new Error(`${label}: el valor propuesto coincide con el original`);
    const reason = requiredText(item.reason, `${label}.reason`);
    const evidence = requiredText(item.evidence, `${label}.evidence`);
    const identityField = `${identity}\0${field}`;
    if (seen.has(identityField)) throw new Error(`${label}: intervención duplicada para identidad y campo`);
    seen.add(identityField);
    proposals.push({ providerId: provider, identity, field, expected, next, reason, evidence });
  }

  return proposals;
};
