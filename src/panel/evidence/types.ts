import type { CommercialPackageProvider } from "../../commercial/export/commercial-package-snapshot.js";
import type { LEGACY_CAMPAIGN_PROVIDERS } from "../../contracts/campaign-providers.js";

export type PanelProviderId = typeof LEGACY_CAMPAIGN_PROVIDERS[number];

export type PanelArtifact = {
  readonly path: string;
  readonly sha256: string;
};

export type PanelOriginalEvidence =
  | { readonly status: "verified"; readonly artifact: PanelArtifact; readonly products: number }
  | { readonly status: "unavailable"; readonly expectedSha256: string; readonly reason: string };

export type PanelTransformationMetrics = {
  readonly changedProducts: number;
  readonly changedTitles: number;
  readonly createdDescriptions: number;
  readonly modifiedDescriptions: number;
  readonly addedTechnicalKeys: number;
  readonly renamedTechnicalKeys: number;
  readonly formattedTechnicalValues: number;
  readonly changedTechnicalValues: number;
};

export type PanelProviderMetrics = {
  readonly originals: number;
  readonly published: number;
  readonly excludedEditorial: number;
  readonly exported: number;
  readonly excludedCommercial: number;
  readonly categorized: number;
  readonly pendingCategory: number;
  readonly attributes: number;
  readonly withPrice: number;
  readonly exceptions: number;
  readonly repeatedReferences: number;
  readonly transformations: PanelTransformationMetrics;
};

export type PanelProviderEvidence = {
  readonly providerId: PanelProviderId;
  readonly approvalSha256: string;
  readonly previousApprovalSha256: string | null;
  readonly publication: PanelArtifact;
  readonly publicationManifest: PanelArtifact;
  readonly original: PanelOriginalEvidence;
  readonly commercial: PanelArtifact;
  readonly metrics: PanelProviderMetrics;
  readonly commercialSummary: CommercialPackageProvider["summary"];
};

export type PanelSnapshot = {
  readonly environment: "develop";
  readonly packageDateUtc: string;
  readonly commercialManifest: PanelArtifact;
  readonly technicalReport: PanelArtifact;
  readonly commercialReport: PanelArtifact;
  readonly retainedPreviousSha256: {
    readonly commercial: string | null;
    readonly technicalReport: string | null;
    readonly commercialReport: string | null;
  };
  readonly providers: readonly PanelProviderEvidence[];
  readonly totals: PanelProviderMetrics;
  readonly backendIntegration: "not-verified";
};
