import { basename, dirname, join, resolve } from "node:path";
import { isDeepStrictEqual } from "node:util";
import { CAMPAIGN_PROVIDERS } from "../../contracts/campaign-providers.js";
import { readActiveCatalogIndex, withActiveCatalogLock, writeActiveCatalogIndex } from "../../infrastructure/filesystem/catalog/active-selection.js";
import { readAccreditedPublication, resolveAccreditedPublication } from "../../infrastructure/filesystem/catalog/accredited-publication.js";
import { readPortableCampaign } from "../../infrastructure/filesystem/catalog/portable-campaign.js";
import { differenceBetween } from "./active-publication.js";
import type { PublicationDifference } from "./active-publication.js";

export type CampaignActivation = {
  readonly status: "simulation" | "activated" | "unchanged";
  readonly runId: string;
  readonly approvalSha256: string;
  readonly differences: Readonly<Record<string, PublicationDifference>>;
};

const compare = async (root: string, runId: string): Promise<CampaignActivation> => {
  const manifest = await readPortableCampaign(root, runId);
  const differences: Record<string, PublicationDifference> = {};
  for (const providerId of CAMPAIGN_PROVIDERS) {
    const next = await readAccreditedPublication(join(root, "catalogs", "campaigns", runId, providerId, "publishable.json"));
    const current = await resolveAccreditedPublication(root, providerId, true);
    const previous = current ? await readAccreditedPublication(current) : null;
    differences[providerId] = differenceBetween(current ? (basename(current) === "publishable.json" ? previous?.runId ?? null : basename(dirname(current))) : null, runId,
      previous?.products ?? [], next.products);
  }
  return { status: "simulation", runId, approvalSha256: manifest.approvalSha256, differences };
};

export const selectActiveCampaign = async (
  rootDirectory: string, runId: string, activate = false
): Promise<CampaignActivation> => {
  const root = resolve(rootDirectory);
  const preview = await compare(root, runId);
  if (!activate) return preview;
  return withActiveCatalogLock(root, async () => {
    const latest = await compare(root, runId);
    if (!isDeepStrictEqual(latest, preview)) throw new Error("Los finales vigentes cambiaron durante la selección global");
    const current = await readActiveCatalogIndex(root);
    if (current && CAMPAIGN_PROVIDERS.every((id) =>
      current.providers[id]?.runId === runId && current.providers[id]?.approvalSha256 === preview.approvalSha256)) {
      return { ...preview, status: "unchanged" };
    }
    const providers = Object.fromEntries(CAMPAIGN_PROVIDERS.map((id) =>
      [id, { runId, approvalSha256: preview.approvalSha256 }]));
    await writeActiveCatalogIndex(root, { version: 1, providers });
    for (const id of CAMPAIGN_PROVIDERS) {
      const selected = await resolveAccreditedPublication(root, id);
      if (selected !== join(root, "catalogs", "campaigns", runId, id, "publishable.json")) {
        throw new Error(`No coincide la publicación global activada de ${id}`);
      }
    }
    return { ...preview, status: "activated" };
  });
};
