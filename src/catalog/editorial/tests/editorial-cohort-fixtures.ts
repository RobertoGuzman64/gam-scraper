import { prepareSavedCatalog } from "../../../pipeline/preparation/prepare.js";
import { createAccreditationDraft, selectAccreditedPublishable, sha256 } from "../campaign-accreditation.js";
import type { OfflinePreparation } from "../../preparation/offline-document.js";

export const EDITORIAL_PROVIDERS = ["gam", "gomariz", "mercaeleva"] as const;
export const EDITORIAL_SOURCES = {
  gam: "src/testing/fixtures/gam/scrape-gam-marzo-2026-catalog.json",
  gomariz: "src/testing/fixtures/gomariz/scrape-gomariz-catalog.json",
  mercaeleva: "src/testing/fixtures/mercaeleva/scrape-mercaeleva-catalog.json"
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

export const createEditorialTestApproval = (preparations: readonly OfflinePreparation[]) => {
  const sources = preparations.map((preparation) => ({
    providerId: preparation.source.providerId,
    catalogSha256: preparation.source.catalogSha256,
    preparationSha256: sha256(JSON.stringify(preparation, null, 2)),
    productCount: preparation.source.productCount
  }));
  const runId = "prueba-acreditacion-editorial";
  const draft = createAccreditationDraft(preparations, sources, runId);
  const approval = {
    ...draft,
    approved: true,
    approvalReason: "Revisión editorial explícita de las incidencias acreditadas en los fixtures.",
    exclusions: draft.exclusions.map((entry) => ({
      ...entry,
      decision: "excluir" as const,
      reason: "Identidad o atributo contradictorio pendiente de revisión.",
      evidenceUrls: [entry.sourceUrl]
    }))
  };
  return {
    sources,
    approval,
    select: (candidate: readonly OfflinePreparation[] = preparations) => selectAccreditedPublishable(
      candidate, sources, runId, approval, sha256(JSON.stringify(approval))
    )
  };
};
