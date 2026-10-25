import { prepareSavedCatalog } from "../../../pipeline/preparation/prepare.js";

export const EDITORIAL_PROVIDERS = ["gam", "gomariz", "mercaeleva"] as const;
export const EDITORIAL_SOURCES = {
  gam: "storage/scraped/gam/scrape-gam-marzo-2026-catalog.json",
  gomariz: "storage/scraped/gomariz/scrape-gomariz-catalog.json",
  mercaeleva: "storage/scraped/mercaeleva/scrape-mercaeleva-catalog.json"
};

export const prepareEditorialCohort = async (suffix = "") => Promise.all(EDITORIAL_PROVIDERS.map(async (providerId) => {
  const source = EDITORIAL_SOURCES[providerId];
  const prefix = source.slice(source.lastIndexOf("/") + 1).replace(/-catalog\.json$/, "");
  return (await prepareSavedCatalog({
    providerId,
    source,
    out: `storage/prepared/${providerId}/${prefix}${suffix}-preparation.json`,
    dryRun: true,
    compare: null
  })).preparation;
}));
