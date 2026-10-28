import type { ManualInterventionProposal } from "./contracts.js";
import { validateInterventionProposals } from "./proposals.js";

export type VersionedInterventionScript = {
  readonly id: string;
  readonly script: string;
  readonly sha256: string;
};

export type AppliedInterventionRecord = {
  readonly version: 1 | 2;
  readonly status: "applied";
  readonly campaign: string;
  readonly appliedAt: string;
  readonly providerId: string;
  readonly sourceCatalogSha256: string;
  readonly planSha256: string;
  readonly derivedCatalogSha256: string;
  readonly analyzedProducts: number;
  readonly affectedProducts: number;
  readonly changes: readonly ManualInterventionProposal[];
  readonly scripts?: readonly string[];
  readonly scriptVersions?: readonly VersionedInterventionScript[];
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const isScriptList = (value: unknown): value is string[] =>
  Array.isArray(value) && value.length > 0 &&
  value.every((item: unknown) => typeof item === "string" &&
    item.endsWith(".ts") && !item.endsWith(".d.ts") &&
    !item.includes("/") && !item.includes("\\")) &&
  new Set(value).size === value.length;

const recordKeys = new Set([
  "version", "status", "campaign", "appliedAt", "providerId", "sourceCatalogSha256",
  "planSha256", "derivedCatalogSha256", "analyzedProducts", "affectedProducts", "changes", "scripts", "scriptVersions"
]);

const isSha = (value: unknown): value is string =>
  typeof value === "string" && /^[a-f0-9]{64}$/.test(value);

const isScriptVersions = (value: unknown, providerId: string): value is VersionedInterventionScript[] => {
  if (!Array.isArray(value) || value.length === 0) return false;
  const identifiers = new Set<string>();
  const paths = new Set<string>();
  for (const entry of value) {
    if (!isRecord(entry) || Object.keys(entry).length !== 3 ||
      typeof entry.id !== "string" || !new RegExp(`^${providerId}-[a-z0-9]+(?:-[a-z0-9]+)*$`).test(entry.id) ||
      typeof entry.script !== "string" ||
      !new RegExp(`^interventions/${providerId}/[a-zA-Z0-9_-]+\\.ts$`).test(entry.script) ||
      !isSha(entry.sha256) || identifiers.has(entry.id) || paths.has(entry.script)) return false;
    identifiers.add(entry.id);
    paths.add(entry.script);
  }
  return true;
};

const hasValidScriptVersions = (record: Record<string, unknown>): boolean => {
  const { providerId, scripts, scriptVersions } = record;
  return typeof providerId === "string" && isScriptList(scripts) &&
    isScriptVersions(scriptVersions, providerId) &&
    scriptVersions.every((entry) => scripts.includes(entry.script.split("/").at(-1) ?? ""));
};

export const parseAppliedInterventionRecord = (value: unknown): AppliedInterventionRecord => {
  if (!isRecord(value) || Object.keys(value).length !== (value.version === 2 ? 13 : value.scripts === undefined ? 11 : 12) ||
    Object.keys(value).some((key) => !recordKeys.has(key)) ||
    (value.scripts !== undefined && !isScriptList(value.scripts)) ||
    (value.version !== 1 && value.version !== 2) || value.status !== "applied" ||
    (value.version === 1 && value.scriptVersions !== undefined) ||
    (value.version === 2 && !hasValidScriptVersions(value)) ||
    typeof value.campaign !== "string" || !/^[a-zA-Z0-9][a-zA-Z0-9_-]*$/.test(value.campaign) ||
    typeof value.appliedAt !== "string" || !Number.isFinite(Date.parse(value.appliedAt)) ||
    typeof value.providerId !== "string" || !value.providerId.trim() ||
    !isSha(value.sourceCatalogSha256) || !isSha(value.planSha256) || !isSha(value.derivedCatalogSha256) ||
    typeof value.analyzedProducts !== "number" || !Number.isSafeInteger(value.analyzedProducts) || value.analyzedProducts < 1 ||
    typeof value.affectedProducts !== "number" || !Number.isSafeInteger(value.affectedProducts) ||
    value.affectedProducts < 1 || value.affectedProducts > value.analyzedProducts) {
    throw new Error("Expediente de intervención inválido");
  }
  return {
    version: value.version,
    status: "applied",
    campaign: value.campaign,
    appliedAt: value.appliedAt,
    providerId: value.providerId,
    sourceCatalogSha256: value.sourceCatalogSha256,
    planSha256: value.planSha256,
    derivedCatalogSha256: value.derivedCatalogSha256,
    analyzedProducts: value.analyzedProducts,
    affectedProducts: value.affectedProducts,
    changes: validateInterventionProposals(value.changes, value.providerId),
    ...(isScriptList(value.scripts) ? { scripts: value.scripts } : {}),
    ...(value.version === 2 && isScriptVersions(value.scriptVersions, value.providerId) ?
      { scriptVersions: value.scriptVersions } : {})
  };
};
