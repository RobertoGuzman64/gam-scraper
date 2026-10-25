import type { ManualInterventionProposal } from "./contracts.js";
import { validateInterventionProposals } from "./proposals.js";

export type AppliedInterventionRecord = {
  readonly version: 1;
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
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const isSha = (value: unknown): value is string =>
  typeof value === "string" && /^[a-f0-9]{64}$/.test(value);

export const parseAppliedInterventionRecord = (value: unknown): AppliedInterventionRecord => {
  if (!isRecord(value) || Object.keys(value).length !== 11 ||
    value.version !== 1 || value.status !== "applied" ||
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
    version: 1,
    status: "applied",
    campaign: value.campaign,
    appliedAt: value.appliedAt,
    providerId: value.providerId,
    sourceCatalogSha256: value.sourceCatalogSha256,
    planSha256: value.planSha256,
    derivedCatalogSha256: value.derivedCatalogSha256,
    analyzedProducts: value.analyzedProducts,
    affectedProducts: value.affectedProducts,
    changes: validateInterventionProposals(value.changes, value.providerId)
  };
};
