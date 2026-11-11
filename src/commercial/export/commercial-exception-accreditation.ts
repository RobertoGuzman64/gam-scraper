import { createHash } from "node:crypto";

export type CommercialExceptionAccreditation = {
  readonly field: "year" | "height";
  readonly fingerprint: string;
  readonly evidenceSha256: string;
  readonly bindingSha256: string;
};

type ExceptionIdentity = {
  readonly identity: string;
  readonly reference: string | null;
  readonly sourceUrl: string;
  readonly reason: string;
};

export const controlledCommercialField = (reason: string): "year" | "height" | null => {
  if (reason === "ano-url-atributo-discordante") return "year";
  if (reason === "altura-titulo-resumen-discordante") return "height";
  return null;
};

const sha256 = (value: unknown): string =>
  createHash("sha256").update(JSON.stringify(value)).digest("hex");

export const createCommercialExceptionAccreditation = (
  providerId: string, issue: ExceptionIdentity, product: unknown,
  recognition: { readonly fingerprint: string; readonly evidenceSha256: string; readonly field: string }
): CommercialExceptionAccreditation => {
  const field = controlledCommercialField(issue.reason);
  if (!field || field !== recognition.field ||
    !/^[a-f0-9]{64}$/u.test(recognition.fingerprint) ||
    !/^[a-f0-9]{64}$/u.test(recognition.evidenceSha256)) {
    throw new Error("Reconocimiento comercial incompatible con la incidencia");
  }
  return {
    field,
    fingerprint: recognition.fingerprint,
    evidenceSha256: recognition.evidenceSha256,
    bindingSha256: sha256([providerId, issue.identity, issue.reference, issue.sourceUrl,
      issue.reason, field, recognition.fingerprint, recognition.evidenceSha256, product]),
  };
};

export const validCommercialExceptionAccreditation = (
  providerId: string, issue: ExceptionIdentity & { readonly accreditation?: unknown }, product: unknown
): boolean => {
  const proof = issue.accreditation;
  if (!proof || typeof proof !== "object" || Array.isArray(proof)) return false;
  const value: Record<string, unknown> = Object.fromEntries(Object.entries(proof));
  const field = controlledCommercialField(issue.reason);
  return field !== null && value.field === field &&
    Object.keys(value).length === 4 &&
    ["field", "fingerprint", "evidenceSha256", "bindingSha256"].every((key) =>
      Object.prototype.hasOwnProperty.call(value, key)) &&
    [value.fingerprint, value.evidenceSha256, value.bindingSha256].every((hash) =>
      typeof hash === "string" && /^[a-f0-9]{64}$/u.test(hash)) &&
    value.bindingSha256 === sha256([providerId, issue.identity, issue.reference, issue.sourceUrl,
      issue.reason, field, value.fingerprint, value.evidenceSha256, product]);
};
