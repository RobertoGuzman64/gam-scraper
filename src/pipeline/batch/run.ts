import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { copyFile, mkdir, open, rm, stat } from "node:fs/promises";
import { basename, join, resolve } from "node:path";
import type { BatchOptions } from "./types.js";
import { getProvider } from "../../scraping/registry.js";
import { getBatchStatus, readPublicationStats, writeBatchReport } from "./report.js";
import type { BatchReport, ProviderRun } from "./report.js";

export type BatchResult = { readonly report: BatchReport; readonly reportFile: string };

const timestamp = (): string => new Date().toISOString();

export const describeBatch = (options: BatchOptions): readonly {
  readonly providerId: string;
  readonly outputDir: string;
  readonly outputPrefix: string;
}[] => options.providerIds.map((providerId) => ({
  providerId,
  outputDir: resolve(options.outRoot, providerId),
  outputPrefix: getProvider(providerId).defaultOptions.outPrefix
}));

const executeProvider = async (scriptFile: string, providerId: string, outDir: string, outPrefix: string, logFile: string): Promise<number> => {
  const log = await open(logFile, "w");
  try {
    return await new Promise<number>((done, fail) => {
      const child = spawn(process.execPath, [
        scriptFile, "--provider", providerId, "--outDir", outDir, "--outPrefix", outPrefix
      ], { cwd: process.cwd(), stdio: ["ignore", log.fd, log.fd], windowsHide: true });
      child.once("error", fail);
      child.once("close", (code, signal) => done(signal === null ? (code ?? -1) : -1));
    });
  } finally {
    await log.close();
  }
};

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

const runProvider = async (
  scriptFile: string, providerId: string, outputDir: string, outputPrefix: string, runDir: string
): Promise<ProviderRun> => {
  const startedAt = timestamp();
  const logFile = join(runDir, `${providerId}.log`);
  const summaryFile = join(outputDir, `${outputPrefix}-summary.json`);
  const changesFile = join(outputDir, `${outputPrefix}-changes.json`);
  const details = { providerId, startedAt, outputDir, outputPrefix, logFile, summaryFile, changesFile };

  let archived: Pick<ProviderRun, "archivedSummaryFile" | "archivedChangesFile" | "archivedErrorsFile" | "archivedPreparationFile" | "archivedPartialPreparationFile"> = {};
  try {
    await mkdir(outputDir, { recursive: true });
    const exitCode = await executeProvider(scriptFile, providerId, outputDir, outputPrefix, logFile);
    archived = await archiveReports(providerId, outputDir, outputPrefix, runDir, startedAt);
    if (exitCode !== 0) throw new Error(`El scraper finalizó con código ${exitCode}; consultar ${basename(logFile)}`);
    const statistics = await readPublicationStats(summaryFile, changesFile, startedAt);
    const endedAt = timestamp();
    return { ...details, ...archived, status: "complete", endedAt, durationMs: Date.parse(endedAt) - Date.parse(startedAt), ...statistics };
  } catch (error) {
    const endedAt = timestamp();
    return {
      ...details, ...archived, status: "failed", endedAt, durationMs: Date.parse(endedAt) - Date.parse(startedAt),
      error: String(error)
    };
  }
};

export const runBatch = async (options: BatchOptions, scriptFile: string): Promise<BatchResult> => {
  if (options.dryRun) throw new Error("--dry-run no ejecuta lotes; utilizar describeBatch");
  const outRoot = resolve(options.outRoot);
  const historyDir = resolve(options.historyDir);
  const startedAt = timestamp();
  const runId = `${startedAt.replace(/[:.]/g, "-")}-${randomUUID().slice(0, 8)}`;
  const runDir = join(historyDir, runId);
  const reportFile = join(runDir, "run.json");
  await mkdir(outRoot, { recursive: true });
  const lockFile = join(outRoot, ".batch.lock");
  let lock;
  try {
    lock = await open(lockFile, "wx");
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "EEXIST") {
      throw new Error(`Ya hay una ejecución en curso o un bloqueo antiguo: ${lockFile}. Comprobar antes de eliminarlo.`);
    }
    throw error;
  }

  try {
    await lock.writeFile(`${JSON.stringify({ runId, pid: process.pid, startedAt })}\n`);
    await lock.close();
    await mkdir(runDir, { recursive: true });
    const completed: ProviderRun[] = [];
    const makeReport = (status: BatchReport["status"], endedAt: string | null): BatchReport => ({
      version: 1, runId, startedAt, endedAt, status, requestedProviders: options.providerIds, providers: [...completed]
    });
    await writeBatchReport(reportFile, makeReport("running", null));

    for (const provider of describeBatch(options)) {
      console.log(`[batch] start provider=${provider.providerId}`);
      const result = await runProvider(scriptFile, provider.providerId, provider.outputDir, provider.outputPrefix, runDir);
      completed.push(result);
      await writeBatchReport(reportFile, makeReport("running", null));
      console.log(`[batch] end provider=${provider.providerId} status=${result.status}${result.error ? ` error=${result.error}` : ` products=${result.products}`}`);
    }

    const report = makeReport(getBatchStatus(completed), timestamp());
    await writeBatchReport(reportFile, report);
    return { report, reportFile };
  } finally {
    await lock.close().catch(() => undefined);
    await rm(lockFile, { force: true });
  }
};
