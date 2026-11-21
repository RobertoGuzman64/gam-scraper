import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { digest, isRecord, isSha } from "./evidence-files.js";
import type { PanelProviderId } from "./types.js";
import type { PanelSpecAddition } from "../explorer/types.js";

type AuditKind = Exclude<PanelSpecAddition["kind"], "pending">;
export type AuditEntry = {
  readonly providerId: PanelProviderId;
  readonly reference: string | null;
  readonly sourceUrl: string;
  readonly field: string;
  readonly value: string;
  readonly kind: AuditKind;
};
export type FingerprintedAuditEntry = AuditEntry & { readonly originalRecordSha256: string };
type AuditCut = { readonly originalSha256: string; readonly publicationSha256: string };
type AuditCuts = Readonly<Record<PanelProviderId, AuditCut>>;
export type SpecAdditionAudit =
  | { readonly version: 1; readonly cuts: AuditCuts; readonly entries: readonly AuditEntry[] }
  | { readonly version: 2; readonly cuts: AuditCuts; readonly entries: readonly FingerprintedAuditEntry[] };

const providers: readonly PanelProviderId[] = ["gam", "gomariz", "mercaeleva"];
const isEntry = (value: unknown): value is AuditEntry => isRecord(value) &&
  (value.providerId === "gam" || value.providerId === "gomariz" || value.providerId === "mercaeleva") &&
  (value.reference === null || typeof value.reference === "string") &&
  typeof value.sourceUrl === "string" && typeof value.field === "string" &&
  typeof value.value === "string" && (value.kind === "own" || value.kind === "reused");

const isAudit = (value: unknown): value is SpecAdditionAudit => {
  if (!isRecord(value) || (value.version !== 1 && value.version !== 2) ||
    !isRecord(value.cuts) || !Array.isArray(value.entries)) return false;
  const cuts = value.cuts;
  return providers.every((provider) => {
    const cut = cuts[provider];
    return isRecord(cut) && isSha(cut.originalSha256) && isSha(cut.publicationSha256);
  }) && value.entries.every((entry: unknown) => isEntry(entry) &&
    (value.version === 1 || ("originalRecordSha256" in entry && isSha(entry.originalRecordSha256))));
};

export { originalRecordFingerprint } from "../../catalog/identity-fingerprint.js";

const identity = (provider: PanelProviderId, reference: string | null, url: string, field: string): string =>
  JSON.stringify([provider, reference, url, field]);

export const loadSpecAdditionAudit = async (root: string): Promise<SpecAdditionAudit | null> => {
  let raw: string;
  try { raw = await readFile(join(root, "src", "panel", "evidence", "spec-addition-audit.json"), "utf8"); }
  catch (error: unknown) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") return null;
    throw error;
  }
  const decoded: unknown = JSON.parse(raw);
  if (!isAudit(decoded)) throw new Error("Auditoría de specs incorporadas inválida");
  const keys = new Set<string>();
  for (const entry of decoded.entries) {
    const key = identity(entry.providerId, entry.reference, entry.sourceUrl, entry.field);
    if (keys.has(key)) throw new Error(`Auditoría de specs duplicada: ${key}`);
    keys.add(key);
  }
  return decoded;
};
