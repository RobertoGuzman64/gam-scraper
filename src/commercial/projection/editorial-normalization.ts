import { normalizeEditorialGeneral, normalizeEditorialSummary, normalizeEditorialTitle } from "../../preparation/editorial/core/editorial-normalization.js";
import { removeSourceTitleBranding, removeSourceSummaryBranding } from "../../preparation/editorial/source/details/source-editorial-branding.js";

export const normalizeCommercialTitle = (
  value: string | null, providerId: string, model: string | null
): string | null => normalizeEditorialTitle(removeSourceTitleBranding({ providerId }, value), model);

export const normalizeCommercialSummary = (
  value: string | null, model: string | null, providerId: string | null = null
): string | null => normalizeEditorialSummary(providerId ? removeSourceSummaryBranding({ providerId }, value) : value, model);

export const normalizeCommercialGeneral = normalizeEditorialGeneral;
