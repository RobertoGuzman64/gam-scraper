import { copyFile, mkdir, stat } from "node:fs/promises";
import { join } from "node:path";
import type { ScrapeEvent } from "../../contracts/progress.js";
import { readPublicationStats } from "./report.js";
import type { ProviderRun } from "./report.js";
import { executeProvider } from "./process-child.js";

const timestamp = (): string => new Date().toISOString();

const archiveReports = async (
  providerId: string, outputDir: string, outputPrefix: string, runDir: string, startedAt: string
): Promise<Pick<ProviderRun, "archivedSummaryFile" | "archivedChangesFile" | "archivedErrorsFile" | "archivedPreparationFile" | "archivedPartialPreparationFile">> => {
  const entries = [
    { suffix: "summary", field: "archivedSummaryFile" },
    { suffix: "changes", field: "archivedChangesFile" },
    { suffix: "errors", field: "archivedErrorsFile" },
    { suffix: "preparation", field: "archivedPreparationFile" },
    { suffix: "partial-preparation", field: "archivedPartialPreparationFile" }
  ] as const;
  const archived: {
    archivedSummaryFile?: string;
    archivedChangesFile?: string;
    archivedErrorsFile?: string;
    archivedPreparationFile?: string;
    archivedPartialPreparationFile?: string;
  } = {};

  for (const entry of entries) {
    const source = join(outputDir, `${outputPrefix}-${entry.suffix}.json`);
    const destination = join(runDir, `${providerId}-${entry.suffix}.json`);
    try {
      const metadata = await stat(source);
      if (metadata.mtimeMs < Date.parse(startedAt)) continue;
      await copyFile(source, destination);
      archived[entry.field] = destination;
    } catch (error) {
      if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") continue;
      throw error;
    }
  }
  return archived;
};

export const runProvider = async (
  scriptFile: string, providerId: string, outputDir: string, outputPrefix: string, runDir: string,
  progress: (event: ScrapeEvent) => void, signal: AbortSignal
): Promise<ProviderRun> => {
  const startedAt = timestamp();
  const logFile = join(runDir, `${providerId}.log`);
  const summaryFile = join(outputDir, `${outputPrefix}-summary.json`);
  const changesFile = join(outputDir, `${outputPrefix}-changes.json`);
  const details = { providerId, startedAt, outputDir, outputPrefix, logFile, summaryFile, changesFile };

  const failures: string[] = [];
  let archived: Pick<ProviderRun, "archivedSummaryFile" | "archivedChangesFile" | "archivedErrorsFile" | "archivedPreparationFile" | "archivedPartialPreparationFile"> = {};
  try {
    await mkdir(outputDir, { recursive: true });
    const exitCode = await executeProvider(scriptFile, providerId, outputDir, outputPrefix, logFile, (event) => {
      if (event.type === "failure" && failures.length === 0) failures.push(`${event.stage} | ${event.resource}: ${event.reason}`);
      progress(event);
    }, signal);
    archived = await archiveReports(providerId, outputDir, outputPrefix, runDir, startedAt);
    if (exitCode !== 0) {
      const diagnostic = failures.length ? ` | ${failures[0]}` : "";
      throw new Error(`El scraper finalizó con código ${exitCode}${diagnostic}`);
    }
    const statistics = await readPublicationStats(summaryFile, changesFile, startedAt);
    const endedAt = timestamp();
    return { ...details, ...archived, status: "complete", endedAt, durationMs: Date.parse(endedAt) - Date.parse(startedAt), ...statistics };
  } catch (error) {
    archived = await archiveReports(providerId, outputDir, outputPrefix, runDir, startedAt).catch(() => archived);
    const endedAt = timestamp();
    return {
      ...details, ...archived, status: "failed", endedAt, durationMs: Date.parse(endedAt) - Date.parse(startedAt),
      error: error instanceof Error ? error.message : String(error)
    };
  }
};

