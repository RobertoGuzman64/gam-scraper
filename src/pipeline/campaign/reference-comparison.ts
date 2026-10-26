import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { compareCampaignReferences } from "../../catalog/reference/compare.js";
import { readCanonicalCatalog } from "../../infrastructure/filesystem/canonical-catalog.js";
import { readCampaignReference } from "../../infrastructure/filesystem/campaign-reference.js";
import { CAMPAIGN_PROVIDERS, discoverCampaign } from "./discovery.js";
import type { ReferenceComparison } from "../../catalog/reference/compare.js";
import type { ReferenceCatalogSource } from "../../infrastructure/filesystem/campaign-reference.js";

export type ActiveCampaignReferenceInput = {
  readonly runId: string;
  readonly catalogs: readonly (ReferenceCatalogSource & { readonly path: string; readonly sha256: string })[];
};

const digest = (raw: string): string => createHash("sha256").update(raw).digest("hex");

export const readActiveCampaignReferenceInput = async (rootDirectory: string): Promise<ActiveCampaignReferenceInput> => {
  const root = resolve(rootDirectory);
  const campaign = await discoverCampaign(root);
  if (!campaign.runId || !campaign.runFile || campaign.status !== "complete" || campaign.issues.length) {
    throw new Error(`No hay campaña completa y verificable: ${campaign.issues.join("; ") || campaign.status}`);
  }
  const catalogs: (ReferenceCatalogSource & { readonly path: string; readonly sha256: string })[] = [];
  for (const providerId of CAMPAIGN_PROVIDERS) {
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

export const compareActiveCampaignReference = async (rootDirectory: string): Promise<ReferenceComparison> => {
  const current = await readActiveCampaignReferenceInput(rootDirectory);
  const previous = await readCampaignReference(rootDirectory);
  return compareCampaignReferences(
    previous?.manifest.runId ?? null, previous?.catalogs ?? null, current.runId,
    current.catalogs.map((entry) => entry.catalog)
  );
};
