import type { EditableInterventionField, ManualInterventionProposal } from "./contracts.js";

const allowedFields: ReadonlySet<string> = new Set<EditableInterventionField>([
  "title", "shortDescription", "longDescription"
]);

const isEditableField = (field: string): field is EditableInterventionField => allowedFields.has(field);

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
    const expected = nullableText(item.expected, `${label}.expected`);
    const next = nullableText(item.next, `${label}.next`);
    if (expected === next) throw new Error(`${label}: el valor propuesto coincide con el original`);
    const reason = requiredText(item.reason, `${label}.reason`);
    const evidence = requiredText(item.evidence, `${label}.evidence`);
    const identityField = `${identity}\0${field}`;
    if (seen.has(identityField)) throw new Error(`${label}: intervención duplicada para identidad y campo`);
    seen.add(identityField);
    proposals.push({ providerId: provider, identity, field, expected, next, reason, evidence });
  }

  return proposals;
};
