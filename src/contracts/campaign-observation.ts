import type { CanonicalCatalog } from "../catalog/canonical-catalog.js";

export type CampaignCatalogObservation = {
  readonly runId: string;
  readonly catalog: CanonicalCatalog | null;
  readonly reason?: string;
};
