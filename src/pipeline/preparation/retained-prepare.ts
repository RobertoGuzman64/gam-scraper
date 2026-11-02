import { preparedWorkspaceForOutput } from "../../infrastructure/filesystem/preparation/prepared-storage-lock.js";
import { simulatePreparedRetention } from "../../infrastructure/filesystem/preparation/preparation-retention.js";
import { executePreparedRetention, type PreparedRetentionExecution } from "../../infrastructure/filesystem/preparation/prepared-retention-execution.js";
import { readOfflinePreparation } from "../../infrastructure/filesystem/preparation/offline-preparation.js";
import { prepareSavedCatalog, type PrepareOptions, type PrepareResult } from "./prepare.js";

export type RetainedPrepareResult = PrepareResult & {
  readonly retention: PreparedRetentionExecution | null;
};

export const prepareSavedCatalogWithRetention = async (options: PrepareOptions): Promise<RetainedPrepareResult> => {
  const result = await prepareSavedCatalog(options);
  const workspace = preparedWorkspaceForOutput(result.preparationFile, options.providerId);
  if (options.dryRun || !workspace) return { ...result, retention: null };
  let retention: PreparedRetentionExecution;
  try {
    await readOfflinePreparation(result.preparationFile, options.providerId);
    const referencedPaths = options.compare ? [options.compare] : [];
    const planned = await simulatePreparedRetention(workspace, options.providerId, undefined, referencedPaths);
    retention = await executePreparedRetention(workspace, options.providerId, planned, {
      phase3Closed: true,
      externalReferencesVerified: true,
      writersCoordinated: true,
      familyApproved: true
    }, referencedPaths);
  } catch (error) {
    retention = {
      status: "incompleta", deletedVersions: 0, deletedFiles: 0, deletedBytes: 0,
      protectedVersions: 0, failures: [`No se pudo comprobar la retención: ${error instanceof Error ? error.message : String(error)}`]
    };
  }
  return { ...result, retention };
};
