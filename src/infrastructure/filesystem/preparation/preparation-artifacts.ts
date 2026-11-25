import { mkdir, rm, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import type { OfflinePreparation } from "../../../preparation/documents/offline-document.js";
import type { OfflineDiagnostics, PreparationComparison } from "../../../preparation/documents/offline-diagnostics.js";
import type { SourceTriageGroup } from "../../../catalog/diagnostics/review/source-triage.js";
import { offlinePreparationManifest, offlinePreparationManifestPath } from "./offline-preparation.js";
import { preparedWorkspaceForOutput, withPreparedStorageWriteLock } from "./prepared-storage-lock.js";

export const preparationArtifactPaths = (out: string, hasComparison: boolean): {
  readonly diagnosticsFile: string;
  readonly manifestFile: string;
  readonly comparisonFile: string | null;
} => ({
  diagnosticsFile: out.slice(0, -"-preparation.json".length) + "-diagnostics.json",
  manifestFile: offlinePreparationManifestPath(out),
  comparisonFile: hasComparison ? out.slice(0, -"-preparation.json".length) + "-comparison.json" : null
});

const writeExclusive = async (files: readonly { readonly path: string; readonly content: string }[]): Promise<void> => {
  const created: string[] = [];
  try {
    for (const file of files) {
      await writeFile(file.path, file.content, { flag: "wx" });
      created.push(file.path);
    }
  } catch (error) {
    for (const path of created) await rm(path, { force: true });
    throw error;
  }
};

export const writePreparationArtifacts = async (
  output: string,
  providerId: string,
  preparation: OfflinePreparation,
  diagnostics: OfflineDiagnostics & { readonly sourceTriage: readonly SourceTriageGroup[] },
  comparison: PreparationComparison | null
): Promise<void> => {
  const out = resolve(output);
  const { diagnosticsFile, manifestFile, comparisonFile } = preparationArtifactPaths(out, comparison !== null);
  await mkdir(dirname(out), { recursive: true });
  const rawPreparation = JSON.stringify(preparation, null, 2);
  const files = [
    { path: out, content: rawPreparation },
    { path: diagnosticsFile, content: JSON.stringify(diagnostics, null, 2) },
    ...(comparison && comparisonFile ? [{ path: comparisonFile, content: JSON.stringify(comparison, null, 2) }] : []),
    { path: manifestFile, content: offlinePreparationManifest(rawPreparation, preparation) }
  ];
  const workspace = preparedWorkspaceForOutput(out, providerId);
  if (workspace) await withPreparedStorageWriteLock(workspace, providerId, () => writeExclusive(files));
  else await writeExclusive(files);
};
