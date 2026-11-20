import { readFile } from "node:fs/promises";
import { join } from "node:path";
import type { PanelProviderEvidence, PanelProviderId } from "../evidence/types.js";
import type { PanelFieldDifference, PanelSpecAddition } from "./types.js";

type AuditKind = Exclude<PanelSpecAddition["kind"], "pending">;
type AuditEntry = {
  readonly providerId: PanelProviderId;
  readonly reference: string | null;
  readonly sourceUrl: string;
  readonly field: string;
  readonly value: string;
  readonly kind: AuditKind;
};
type AuditCut = { readonly originalSha256: string; readonly publicationSha256: string };
export type SpecAdditionAudit = {
  readonly version: 1;
  readonly cuts: Readonly<Record<PanelProviderId, AuditCut>>;
  readonly entries: readonly AuditEntry[];
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value);
const isSha = (value: unknown): value is string => typeof value === "string" && /^[a-f0-9]{64}$/.test(value);
const providers: readonly PanelProviderId[] = ["gam", "gomariz", "mercaeleva"];
const isAudit = (value: unknown): value is SpecAdditionAudit => {
  if (!isRecord(value) || value.version !== 1 || !isRecord(value.cuts) || !Array.isArray(value.entries)) {
    return false;
  }
  const cuts = value.cuts;
  return providers.every((provider) => {
    const cut = cuts[provider];
    return isRecord(cut) && isSha(cut.originalSha256) && isSha(cut.publicationSha256);
  }) && value.entries.every((entry: unknown) =>
    isRecord(entry) && (entry.providerId === "gam" || entry.providerId === "gomariz" ||
      entry.providerId === "mercaeleva") &&
    (entry.reference === null || typeof entry.reference === "string") &&
    typeof entry.sourceUrl === "string" && typeof entry.field === "string" &&
    typeof entry.value === "string" && (entry.kind === "own" || entry.kind === "reused"));
};

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

export const classifySpecAdditions = (
  changes: readonly PanelFieldDifference[], provider: PanelProviderEvidence,
  reference: string | null, sourceUrl: string, audit: SpecAdditionAudit | null
): readonly PanelSpecAddition[] => {
  const cut = audit?.cuts[provider.providerId];
  const validCut = cut !== undefined && provider.original.status === "verified" &&
    cut.originalSha256 === provider.original.artifact.sha256 &&
    cut.publicationSha256 === provider.publication.sha256;
  const found = new Map<string, AuditEntry>();
  if (validCut && audit) {
    for (const entry of audit.entries) {
      if (entry.providerId === provider.providerId && entry.reference === reference && entry.sourceUrl === sourceUrl) {
        found.set(entry.field, entry);
      }
    }
  }
  return changes.filter((difference) => difference.group === "technical" && difference.change === "added")
    .map((difference): PanelSpecAddition => {
      const entry = found.get(difference.field);
      return { field: difference.field, value: difference.after ?? "",
        kind: entry && entry.value === difference.after ? entry.kind : "pending" };
    });
};
