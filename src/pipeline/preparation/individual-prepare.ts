import { resolve } from "node:path";
import { buildOfflineDiagnostics } from "../../catalog/preparation/offline-diagnostics.js";
import type { OfflinePreparation } from "../../catalog/preparation/offline-document.js";
import { prepareSavedCatalog } from "./prepare.js";
import { differenceBetween } from "../publication/active-publication.js";
import { reconcileRemovedSpecifications } from "../publication/specification-reconciliations.js";
import {
  ensureIndividualPreparationDirectory, resolveIndividualPreparationContext,
  type IndividualCatalogProvider, type IndividualPreparationContext, type IndividualPreparationSummary
} from "./individual-context.js";

export type IndividualPreparationOutcome = {
  readonly providerId: IndividualCatalogProvider;
  readonly summary: IndividualPreparationSummary | null;
  readonly error: string | null;
};

const identity = (item: { readonly reference: string | null; readonly sourceUrl: string }): string =>
  item.reference?.trim() ? `ref:${item.reference.trim().toLowerCase()}` : `url:${item.sourceUrl}`;

const summarize = (
  context: IndividualPreparationContext, preparation: OfflinePreparation,
  status: IndividualPreparationSummary["status"], preparationFile: string | null
): IndividualPreparationSummary => {
  const active = new Set(context.activeProducts.map(identity));
  const ready = new Set(preparation.products.filter((item) => item.status === "ready").map((item) => identity(item.product)));
  const all = new Set(preparation.products.map((item) => identity(item.product)));
  const reviewReferences = preparation.products.filter((item) => item.status === "review")
    .map((item) => item.product.reference ?? item.product.sourceUrl);
  const historicalExclusions = context.activeFile ? [...all].filter((id) => !active.has(id)) : [];
  const diagnostics = buildOfflineDiagnostics(preparation);
  const readyProducts = preparation.products.filter((item) => item.status === "ready").map((item) => item.product);
  const difference = context.activeFile ? differenceBetween(context.activeFile, "preparación sin acreditar",
    context.activeProducts, readyProducts) : null;
  const specificationReconciliation = difference ? reconcileRemovedSpecifications(context.providerId, difference, context.activeProducts, readyProducts) : null;
  return {
    providerId: context.providerId, status, sourceCount: context.sourceProducts,
    ready: preparation.totals.ready, review: preparation.totals.review,
    incidences: diagnostics.totals.incidences, reviewReferences, historicalExclusions,
    activeAvailable: context.activeFile !== null,
    possibleAdds: [...ready].filter((id) => !active.has(id)).length,
    possibleRemovals: [...active].filter((id) => !ready.has(id)).length,
    possibleChanges: difference?.modified.length ?? 0,
    possibleSpecificationLosses: (specificationReconciliation?.unresolved.length ?? 0) + (difference?.lostSpecificationValues.length ?? 0),
    reconciledSpecificationChanges: specificationReconciliation?.resolved.length ?? 0,
    preparationFile, diagnostics
  };
};

export const prepareIndividualCatalogs = async (options: {
  readonly workspace: string;
  readonly providers: readonly IndividualCatalogProvider[];
  readonly dryRun: boolean;
}): Promise<readonly IndividualPreparationOutcome[]> => {
  const workspace = resolve(options.workspace);
  const results: IndividualPreparationOutcome[] = [];
  for (const providerId of options.providers) {
    try {
      const context = await resolveIndividualPreparationContext(workspace, providerId);
      if (context.preparation && context.preparationFile) {
        results.push({ providerId, summary: summarize(context, context.preparation, "reutilizada", context.preparationFile), error: null });
        continue;
      }
      if (!options.dryRun) await ensureIndividualPreparationDirectory(workspace, providerId);
      const result = await prepareSavedCatalog({
        providerId, source: context.sourceFile, out: context.outputFile, compare: null, dryRun: options.dryRun
      });
      if (result.preparation.source.catalogSha256 !== context.catalogSha256 ||
        result.preparation.source.prefix !== context.sourcePrefix ||
        result.preparation.source.productCount !== context.sourceProducts ||
        JSON.stringify(result.preparation.fingerprints) !== JSON.stringify(context.fingerprints)) {
        throw new Error("El origen o las reglas cambiaron durante la preparación; revisar el nuevo conjunto antes de reintentar");
      }
      if (!options.dryRun) {
        const verified = await resolveIndividualPreparationContext(workspace, providerId);
        if (verified.preparationFile !== context.outputFile || !verified.preparation) {
          throw new Error("El conjunto guardado no supera la verificación posterior; no acreditar");
        }
      }
      results.push({
        providerId,
        summary: summarize(context, result.preparation, options.dryRun ? "simulada" : "generada",
          options.dryRun ? null : result.preparationFile),
        error: null
      });
    } catch (error) {
      results.push({
        providerId, summary: null,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }
  return results;
};
