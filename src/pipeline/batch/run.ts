import { spawn, type ChildProcess } from "node:child_process";
import { randomUUID } from "node:crypto";
import { copyFile, mkdir, open, rm, stat } from "node:fs/promises";
import { join, resolve } from "node:path";
import type { BatchOptions } from "./types.js";
import type { ScrapeEvent } from "../../contracts/progress.js";
import { isScrapeMessage } from "../../contracts/progress.js";
import { getProvider } from "../../scraping/registry.js";
import { getBatchStatus, readPublicationStats, writeBatchReport } from "./report.js";
import type { BatchReport, ProviderRun } from "./report.js";

export type BatchResult = { readonly report: BatchReport; readonly reportFile: string };
export type BatchObserver = {
  start(runDir: string, total: number): void;
  begin(providerId: string, position: number, count: number): void;
  progress(providerId: string, event: ScrapeEvent): void;
  end(result: ProviderRun): void;
  cancelled?(): void;
  stop?(): void;
};

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

const terminateTree = (child: ChildProcess): void => {
  if (child.exitCode !== null || child.signalCode !== null || !child.pid) return;
  if (process.platform === "win32") {
    const killer = spawn("taskkill", ["/PID", String(child.pid), "/T", "/F"], { stdio: "ignore", windowsHide: true });
    killer.once("error", () => child.kill());
  } else {
    child.kill("SIGTERM");
  }
};

const executeProvider = async (
  scriptFile: string, providerId: string, outDir: string, outPrefix: string, logFile: string,
  progress: (event: ScrapeEvent) => void, signal: AbortSignal
): Promise<number> => {
  if (signal.aborted) throw new Error("Lote cancelado antes de ejecutar el proveedor");
  const log = await open(logFile, "w");
  try {
    return await new Promise<number>((done, fail) => {
      const child = spawn(process.execPath, [
        scriptFile, "--provider", providerId, "--outDir", outDir, "--outPrefix", outPrefix
      ], { cwd: process.cwd(), stdio: ["ignore", log.fd, log.fd, "ipc"], windowsHide: true });
      const cancel = (): void => terminateTree(child);
      const cleanup = (): void => signal.removeEventListener("abort", cancel);
      signal.addEventListener("abort", cancel, { once: true });
      if (signal.aborted) cancel();
      child.on("message", (message: unknown) => {
        if (isScrapeMessage(message)) progress(message.event);
      });
      child.once("error", (error) => { cleanup(); fail(error); });
      child.once("close", (code, childSignal) => {
        cleanup();
        if (signal.aborted) fail(new Error("Lote cancelado por señal; proceso hijo detenido"));
        else done(childSignal === null ? (code ?? -1) : -1);
      });
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

export const runBatch = async (
  options: BatchOptions, scriptFile: string, observer?: BatchObserver, externalSignal?: AbortSignal
): Promise<BatchResult> => {
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

  const controller = new AbortController();
  const cancel = (): void => controller.abort();
  const cancelExternal = (): void => controller.abort();
  process.on("SIGINT", cancel);
  process.on("SIGTERM", cancel);
  externalSignal?.addEventListener("abort", cancelExternal, { once: true });
  if (externalSignal?.aborted) cancelExternal();
  try {
    await lock.writeFile(`${JSON.stringify({ runId, pid: process.pid, startedAt })}\n`);
    await lock.close();
    await mkdir(runDir, { recursive: true });
    const completed: ProviderRun[] = [];
    const makeReport = (status: BatchReport["status"], endedAt: string | null): BatchReport => ({
      version: 1, runId, startedAt, endedAt, status, requestedProviders: options.providerIds, providers: [...completed]
    });
    await writeBatchReport(reportFile, makeReport("running", null));
    observer?.start(runDir, options.providerIds.length);
    for (const provider of describeBatch(options)) {
      if (controller.signal.aborted) break;
      observer?.begin(provider.providerId, completed.length + 1, options.providerIds.length);
      const result = await runProvider(scriptFile, provider.providerId, provider.outputDir, provider.outputPrefix,
        runDir, (event) => observer?.progress(provider.providerId, event), controller.signal);
      completed.push(result);
      observer?.end(result);
      await writeBatchReport(reportFile, makeReport("running", null));
    }
    if (controller.signal.aborted) observer?.cancelled?.();
    const status = controller.signal.aborted ? (completed.some((run) => run.status === "complete") ? "partial" : "failed") : getBatchStatus(completed);
    const report = makeReport(status, timestamp());
    await writeBatchReport(reportFile, report);
    return { report, reportFile };
  } finally {
    observer?.stop?.();
    process.off("SIGINT", cancel);
    process.off("SIGTERM", cancel);
    externalSignal?.removeEventListener("abort", cancelExternal);
    await lock.close().catch(() => undefined);
    await rm(lockFile, { force: true });
  }
};
