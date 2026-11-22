import type { TechnicalDocumentReference, TechnicalDocumentVerification } from "../../contracts/technical-provenance.js";
import type { SpecValue } from "../../contracts/catalog.js";
import type { PanelArtifact, PanelProviderId } from "../evidence/types.js";

export type PanelProductStage = "commercial" | "commercial-excluded" | "editorial-excluded";
export type PanelFieldChange = "added" | "changed" | "unchanged" | "removed" | "ambiguous";

export type PanelProductView = {
  readonly title: string | null;
  readonly shortDescription: string | null;
  readonly generalDescription: string | null;
  readonly category: string | null;
  readonly price: string | number | null;
  readonly image: string | null;
  readonly images: readonly string[];
  readonly specs: Readonly<Record<string, SpecValue>>;
};

export type PanelCommercialView = PanelProductView & {
  readonly categorySellID: number | null;
  readonly attributes: readonly { readonly attributeID: number; readonly value: string | number | boolean }[];
};

export type PanelFieldDifference = {
  readonly field: string;
  readonly group: "content" | "technical" | "commercial";
  readonly change: PanelFieldChange;
  readonly before: string | null;
  readonly after: string | null;
};

export type PanelFieldProvenance = {
  readonly field: PanelFieldDifference["field"];
  readonly group: PanelFieldDifference["group"];
  readonly status: "source-compatible" | "mechanism-compatible" | "observed-only";
  readonly publicationSha256: string;
  readonly originalSha256: string | null;
  readonly scope: "unit" | "unknown" | "model-document" | "unit-document" | "document-reference";
  readonly document?: TechnicalDocumentReference;
  readonly verification?: TechnicalDocumentVerification;
  readonly sourceField: string | null;
  readonly sourceValue: string | null;
  readonly proof: PanelArtifact | null;
  readonly sourceDigest: string | null;
  readonly mechanism: string | null;
  readonly historicalApplication: "not-demonstrated" | "demonstrated";
};

export type PanelSpecAddition = {
  readonly field: string;
  readonly value: string;
  readonly kind: "own" | "reused" | "pending";
  readonly linkedMachines?: readonly string[];
};

export type PanelProductDecision = {
  readonly stage: "editorial" | "commercial";
  readonly reason: string;
  readonly issues: readonly string[];
  readonly evidenceUrls: readonly string[];
};

export type PanelExplorerProduct = {
  readonly identity: string;
  readonly providerId: PanelProviderId;
  readonly reference: string | null;
  readonly sourceUrl: string;
  readonly stage: PanelProductStage;
  readonly category: string | null;
  readonly original: PanelProductView | null;
  readonly published: PanelProductView | null;
  readonly commercial: PanelCommercialView | null;
  readonly changes: readonly PanelFieldDifference[];
  readonly commercialChanges: readonly PanelFieldDifference[];
  readonly commercialTechnicalChanges: readonly PanelFieldDifference[];
  readonly provenance: readonly PanelFieldProvenance[];
  readonly specAdditions: readonly PanelSpecAddition[];
  readonly decision: PanelProductDecision | null;
  readonly evidence: {
    readonly original: PanelArtifact | null;
    readonly publication: PanelArtifact | null;
    readonly commercial: PanelArtifact | null;
    readonly accreditation: PanelArtifact | null;
  };
};

export type PanelPresentationCase = {
  readonly identity: string;
  readonly providerId: PanelProviderId;
  readonly focus: "content" | "technical" | "commercial" | "exclusion";
};

export type PanelExplorerPayload = {
  readonly products: readonly PanelExplorerProduct[];
  readonly cases: readonly PanelPresentationCase[];
  readonly originalComparisonsAvailable: boolean;
};
