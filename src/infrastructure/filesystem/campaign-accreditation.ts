import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { readCanonicalCatalog } from "./canonical-catalog.js";
import { sha256 } from "../../catalog/editorial/campaign-accreditation.js";
import type { AccreditedSource } from "../../catalog/editorial/campaign-accreditation.js";
import type { OfflinePreparation } from "../../catalog/import/preparation/offline-document.js";
import type { BatchReport } from "../../pipeline/batch/report-types.js";

const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value);

const isCompleteBatch = (value: unknown): value is BatchReport => {
  if (!isRecord(value) || value.version !== 1 || value.status !== "complete" ||
    typeof value.runId !== "string" || !Array.isArray(value.requestedProviders) ||
    !Array.isArray(value.providers)) return false;
  const required = ["gam", "gomariz", "mercaeleva"];
  const requested: readonly unknown[] = value.requestedProviders;
  const providers: readonly unknown[] = value.providers;
  return requested.length === required.length &&
    required.every((provider) => requested.includes(provider)) &&
    providers.length === required.length &&
    providers.every((item) => isRecord(item) && item.status === "complete" &&
      typeof item.providerId === "string" && required.includes(item.providerId) &&
      typeof item.outputDir === "string" && typeof item.outputPrefix === "string" &&
      typeof item.startedAt === "string" && typeof item.endedAt === "string") &&
    new Set(providers.map((item) => isRecord(item) ? item.providerId : undefined)).size === required.length;
};

export const readCampaignAccreditationSources = async (
  runPath: string,
  preparations: readonly OfflinePreparation[],
  paths: readonly { readonly providerId: string; readonly path: string }[]
): Promise<{ readonly runId: string; readonly sources: readonly AccreditedSource[] }> => {
  const report: unknown = JSON.parse(await readFile(runPath, "utf8"));
  if (!isCompleteBatch(report)) {
    throw new Error("Acreditación editorial: el lote no acredita los tres proveedores completos");
  }
  const sources: AccreditedSource[] = [];
  for (const path of paths) {
    const run = report.providers.find((item) => item.providerId === path.providerId);
    const preparation = preparations.find((item) => item.source.providerId === path.providerId);
    if (!run || !preparation || preparation.source.intervention !== undefined ||
      sources.some((item) => item.providerId === path.providerId)) {
      throw new Error(`Acreditación editorial: proveedor no acreditado (${path.providerId})`);
    }
    const catalogPath = resolve(run.outputDir, `${run.outputPrefix}-catalog.json`);
    const catalog = await readCanonicalCatalog(catalogPath);
    const catalogSha256 = sha256(await readFile(catalogPath, "utf8"));
    if (catalog.providerId !== path.providerId || catalog.prefix !== run.outputPrefix ||
      catalogSha256 !== preparation.source.catalogSha256 ||
      catalog.scope !== preparation.source.scope ||
      preparation.source.prefix !== run.outputPrefix ||
      catalog.productCount !== preparation.source.productCount ||
      catalog.startedAt < run.startedAt || catalog.endedAt > run.endedAt ||
      !resolve(path.path).endsWith("-preparation.json")) {
      throw new Error(`Acreditación editorial: catálogo o preparación ajena al lote (${path.providerId})`);
    }
    sources.push({
      providerId: path.providerId,
      catalogSha256,
      preparationSha256: sha256(await readFile(path.path, "utf8")),
      productCount: catalog.productCount
    });
  }
  return { runId: report.runId, sources };
};
