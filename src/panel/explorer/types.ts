import type { SpecValue } from "../../contracts/catalog.js";
import type { PanelProviderId } from "../evidence/types.js";

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
  readonly specAdditions: readonly PanelSpecAddition[];
  readonly decision: PanelProductDecision | null;
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
