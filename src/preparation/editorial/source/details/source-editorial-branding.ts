import type { ProductRecord } from "../../../../contracts/catalog.js";

export const removeSourceTitleBranding = (
  source: Pick<ProductRecord, "providerId">, value: string | null
): string | null => source.providerId === "gam" ? value?.trim().replace(/\s*\|\s*GAM Online$/iu, "").trim() ?? null : value;

export const removeSourceSummaryBranding = (
  source: Pick<ProductRecord, "providerId">, value: string | null
): string | null => source.providerId === "gam" ? value?.replace(
  /\s+en GAM Online\.\s+Somos distribuidores oficiales de [^.]+ en España\.\s*$/iu, "."
) ?? null : value;
