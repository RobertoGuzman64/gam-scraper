import { basename, dirname, join } from "node:path";
import { prepareSavedCatalog } from "../preparation/prepare.js";
import { validateCanonicalSource, validateOfflinePreparation } from "../validation/offline.js";
import { discoverCampaign, listCampaignRuns } from "./discovery.js";
import type { CampaignDiscovery, ProviderDiscovery } from "./discovery.js";

export type ReviewItem = {
  readonly reference: string;
  readonly title: string;
  readonly url: string;
  readonly issues: readonly string[];
};

export type ReviewedProvider = {
  readonly providerId: string;
  readonly state: "validated" | "pending" | "error";
  readonly products?: number;
  readonly ready?: number;
  readonly review?: number;
  readonly preparationFile?: string;
  readonly items?: readonly ReviewItem[];
  readonly message?: string;
};

export type CampaignReview = {
  readonly campaign: CampaignDiscovery;
  readonly providers: readonly ReviewedProvider[];
  readonly complete: boolean;
};

const explainUnavailable = (provider: ProviderDiscovery): ReviewedProvider => ({
  providerId: provider.providerId, state: "pending", message: provider.message ??
    (provider.state === "catalog" ? "Catálogo pendiente de revisión" : `Estado ${provider.state}`)
});

const inspectPreparation = async (
  root: string, campaignId: string, provider: ProviderDiscovery
): Promise<ReviewedProvider> => {
  if (!provider.catalog) return explainUnavailable(provider);
  try {
    const catalog = await validateCanonicalSource(provider.catalog.path, provider.providerId);
    if (catalog.catalogSha256 !== provider.catalog.sha256) throw new Error("El catálogo cambió desde el descubrimiento");
    const preparationFile = provider.preparation?.path ?? join(
      root, "storage", "campaigns", campaignId, provider.providerId,
      `${basename(provider.catalog.path, "-catalog.json")}-preparation.json`
    );
    if (!provider.preparation) {
      await prepareSavedCatalog({
        providerId: provider.providerId, source: provider.catalog.path, out: preparationFile,
        dryRun: false, compare: null
      });
    }
    const intervened = provider.preparation?.intervened === true;
    const verifiedSource = intervened ? join(dirname(dirname(preparationFile)), "catalog-derived.json") : provider.catalog.path;
    const result = await validateOfflinePreparation(provider.providerId, preparationFile, verifiedSource, null,
      intervened ? provider.catalog.path : undefined);
    if ((intervened ? result.preparation.source.intervention?.sourceCatalogSha256 : result.catalog.catalogSha256) !==
      provider.catalog.sha256) throw new Error("La preparación procede de otro catálogo");
    return {
      providerId: provider.providerId, state: "validated", products: result.catalog.productCount,
      ready: result.ready, review: result.review, preparationFile,
      items: result.preparation.products.filter((entry) => entry.status === "review").map((entry) => ({
        reference: entry.product.reference?.trim() || "sin referencia",
        title: entry.product.title ?? "sin título",
        url: entry.product.sourceUrl,
        issues: entry.issues
      }))
    };
  } catch (error) {
    return {
      providerId: provider.providerId, state: "error",
      message: error instanceof Error ? error.message : String(error)
    };
  }
};

export const reviewActiveCampaign = async (root: string): Promise<CampaignReview> => {
  const current = await discoverCampaign(root);
  const campaign = current.runId && (await listCampaignRuns(root)).length > 1 ?
    await discoverCampaign(root, current.runId) : current;
  if (!campaign.runId || campaign.status !== "complete" || campaign.issues.length > 0 ||
    campaign.providers.some((provider) => provider.state === "failed" || provider.state === "invalid" || provider.state === "not-started")) {
    return {
      campaign, complete: false,
      providers: campaign.providers.map(explainUnavailable)
    };
  }
  const campaignId = campaign.runId;
  const providers = await Promise.all(campaign.providers.map((provider) => inspectPreparation(root, campaignId, provider)));
  return { campaign, providers, complete: providers.every((provider) => provider.state === "validated") };
};
