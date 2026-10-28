import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { resolve } from "node:path";
import { compareCampaignReferences } from "../../catalog/reference/compare.js";
import { readCanonicalCatalog } from "../../infrastructure/filesystem/canonical-catalog.js";
import { inspectCampaignReference } from "../../infrastructure/filesystem/campaign-reference.js";
import { discoverCampaign, listCampaignRuns } from "./discovery.js";
import { verifyDeliveredCampaign } from "./delivery-verification.js";
import type { CanonicalCatalog } from "../../catalog/canonical-catalog.js";
import type { ReferenceComparison } from "../../catalog/reference/compare.js";
import type { ReferenceCatalogSource } from "../../infrastructure/filesystem/campaign-reference.js";

export type ActiveCampaignReferenceInput = {
  readonly runId: string;
  readonly catalogs: readonly (ReferenceCatalogSource & { readonly path: string; readonly sha256: string })[];
};

const digest = (raw: string): string => createHash("sha256").update(raw).digest("hex");

export const readActiveCampaignReferenceInput = async (rootDirectory: string, targetRunId?: string): Promise<ActiveCampaignReferenceInput> => {
  const root = resolve(rootDirectory);
  const campaign = await discoverCampaign(root, targetRunId);
  if (!campaign.runId || !campaign.runFile || campaign.status !== "complete" || campaign.issues.length) {
    throw new Error(`No hay campaña completa y verificable: ${campaign.issues.join("; ") || campaign.status}`);
  }
  const catalogs: (ReferenceCatalogSource & { readonly path: string; readonly sha256: string })[] = [];
  for (const providerId of campaign.requestedProviders) {
    const provider = campaign.providers.find((item) => item.providerId === providerId);
    if (!provider?.catalog || (provider.state !== "catalog" && provider.state !== "prepared")) {
      throw new Error(`No existe catálogo original verificable de ${providerId}: ${provider?.message ?? "ausente"}`);
    }
    const path = provider.catalog.path;
    const raw = await readFile(path, "utf8");
    if (digest(raw) !== provider.catalog.sha256) {
      throw new Error(`El catálogo de ${providerId} cambió durante la comparación`);
    }
    const catalog = await readCanonicalCatalog(path);
    if (catalog.providerId !== providerId || digest(await readFile(path, "utf8")) !== provider.catalog.sha256) {
      throw new Error(`El catálogo de ${providerId} cambió durante la lectura`);
    }
    catalogs.push({ providerId, path, sha256: provider.catalog.sha256, catalog, raw });
  }
  return { runId: campaign.runId, catalogs };
};

export type ComparisonBaseline = { readonly runId: string; readonly catalogs: readonly CanonicalCatalog[] };

export const findCampaignBaseline = async (
  rootDirectory: string, excludeRunId?: string
): Promise<ComparisonBaseline | null> => {
  const root = resolve(rootDirectory);
  const runs = await listCampaignRuns(root);
  for (const run of runs) {
    if (run.report.runId === excludeRunId) continue;
    const receipt = join(root, "storage", "campaigns", run.report.runId, "delivery.json");
    let exists = false;
    try { await readFile(receipt); exists = true; }
    catch (error) {
      if (!(error instanceof Error && "code" in error && error.code === "ENOENT")) throw error;
    }
    if (!exists) continue;
    await verifyDeliveredCampaign(root, undefined, run.report.runId);
    const input = await readActiveCampaignReferenceInput(root, run.report.runId);
    return { runId: input.runId, catalogs: input.catalogs.map((entry) => entry.catalog) };
  }
  const inspection = await inspectCampaignReference(root);
  if (inspection.status === "invalid" || inspection.status === "recoverable") {
    throw new Error(`Referencia legada ${inspection.status}; no se puede comparar`);
  }
  if (inspection.status === "valid" && inspection.reference.manifest.runId !== excludeRunId) {
    return { runId: inspection.reference.manifest.runId, catalogs: inspection.reference.catalogs };
  }
  return null;
};

export const compareActiveCampaignReference = async (rootDirectory: string): Promise<ReferenceComparison> => {
  const current = await readActiveCampaignReferenceInput(rootDirectory);
  const previous = await findCampaignBaseline(rootDirectory, current.runId);
  return compareCampaignReferences(
    previous?.runId ?? null, previous?.catalogs ?? null, current.runId,
    current.catalogs.map((entry) => entry.catalog)
  );
};
