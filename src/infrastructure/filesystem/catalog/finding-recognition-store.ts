import { readFile } from "node:fs/promises";
import { join } from "node:path";
import type { AuditedFinding, FindingRecognition, FindingRecognitionRegistry } from "../../../catalog/diagnostics/finding-recognitions.js";
import { validateFindingRecognitionRegistry } from "../../../catalog/diagnostics/finding-recognitions.js";

const record = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value);

const string = (value: unknown): value is string => typeof value === "string";

const exact = (value: Record<string, unknown>, fields: readonly string[]): boolean =>
  Object.keys(value).length === fields.length && fields.every((field) => field in value);

const fact = (value: unknown): value is AuditedFinding["facts"][number] =>
  record(value) && exact(value, ["name", "value"]) && string(value.name) && string(value.value);

const finding = (value: unknown): value is AuditedFinding => record(value) &&
  exact(value, ["providerId", "reference", "sourceUrl", "audit", "severity", "field", "code", "evidenceSha256", "facts"]) &&
  string(value.providerId) && (value.reference === null || string(value.reference)) &&
  string(value.sourceUrl) && ((value.audit === "coherencia_preparacion" && value.severity === "revisar") ||
    (value.audit === "acreditacion_comercial" && value.severity === "warn")) &&
  string(value.field) && string(value.code) && string(value.evidenceSha256) &&
  Array.isArray(value.facts) && value.facts.every(fact);

const evidence = (value: unknown): value is FindingRecognition["decision"]["evidence"][number] =>
  record(value) && exact(value, ["origin", "content"]) && string(value.origin) && string(value.content);

const decision = (value: unknown): value is FindingRecognition["decision"] => record(value) &&
  exact(value, ["reviewedBy", "reviewedAt", "rationale", "evidence"]) &&
  string(value.reviewedBy) && string(value.reviewedAt) && string(value.rationale) &&
  Array.isArray(value.evidence) && value.evidence.every(evidence);

const recognition = (value: unknown): value is FindingRecognition => record(value) &&
  exact(value, ["finding", "fingerprint", "decision"]) && finding(value.finding) &&
  string(value.fingerprint) && decision(value.decision);

export const parseFindingRecognitionRegistry = (value: unknown): FindingRecognitionRegistry => {
  if (!record(value) || !exact(value, ["version", "recognitions"]) || value.version !== 1 ||
    !Array.isArray(value.recognitions) || !value.recognitions.every(recognition)) {
    throw new Error("Registro de reconocimientos de hallazgos inválido");
  }
  const registry: FindingRecognitionRegistry = { version: 1, recognitions: value.recognitions };
  validateFindingRecognitionRegistry(registry);
  return registry;
};

export const loadFindingRecognitionRegistry = async (root: string): Promise<FindingRecognitionRegistry> => {
  const content = await readFile(join(root, "data", "audit-finding-recognitions.json"), "utf8");
  const data: unknown = JSON.parse(content);
  return parseFindingRecognitionRegistry(data);
};
