import { discoverCampaign } from "./discovery.js";
import type { CampaignDiscovery } from "./discovery.js";

export type ExtractionInspection = {
  readonly campaign: CampaignDiscovery;
  readonly requiresNewCampaign: boolean;
};

export const inspectBeforeExtraction = async (root: string): Promise<ExtractionInspection> => {
  const campaign = await discoverCampaign(root);
  return {
    campaign,
    requiresNewCampaign: campaign.issues.length > 0 || (campaign.runId !== null && campaign.status !== "complete")
  };
};
