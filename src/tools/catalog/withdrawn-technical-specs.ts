import type { PanelProviderId } from "../../panel/evidence/types.js";
import { withdrawnTechnicalSpecs as approvedWithdrawals } from "../../catalog/withdrawn-technical-specs.js";

export type WithdrawnTechnicalSpec = {
  readonly providerId: PanelProviderId;
  readonly reference: string;
  readonly field: string;
  readonly value: string;
  readonly reason: string;
};

export const withdrawnTechnicalSpecs: readonly WithdrawnTechnicalSpec[] = approvedWithdrawals;
