import { randomUUID } from "node:crypto";
import { mkdir } from "node:fs/promises";
import { basename, join, resolve } from "node:path";
import type { BatchOptions } from "./types.js";
import type { ScrapeEvent } from "../../contracts/progress.js";
import { getProvider } from "../../scraping/registry.js";
import { getBatchStatus, writeBatchReport } from "./report.js";
import type { BatchReport, ProviderRun } from "./report.js";
import { acquireBatchLock } from "../../infrastructure/locking/batch-lock.js";
import { cleanBatchExcess } from "../../infrastructure/filesystem/runs/run-retention.js";
import { runProvider } from "./run-provider.js";

export type BatchResult = { readonly report: BatchReport; readonly reportFile: string };
export type BatchObserver = {
  start(runDir: string, total: number): void;
  begin(providerId: string, position: number, count: number): void;
  progress(providerId: string, event: ScrapeEvent): void;
  end(result: ProviderRun): void;
  recoveredLock?(pid: number): void;
  cancelled?(): void;
  stop?(): void;
};

const timestamp = (): string => new Date().toISOString();

export const createBatchRunId = (): string => `${timestamp().replace(/[:.]/g, "-")}-${randomUUID().slice(0, 8)}`;

export const describeBatch = (options: BatchOptions): readonly {
  readonly providerId: string;
  readonly outputDir: string;
  readonly outputPrefix: string;
}[] => options.providerIds.map((providerId) => ({
  providerId,
  outputDir: resolve(options.outRoot, providerId),
  outputPrefix: getProvider(providerId).defaultOptions.outPrefix
}));

export const runBatch = async (
  options: BatchOptions, scriptFile: string, observer?: BatchObserver, externalSignal?: AbortSignal, campaignRunId?: string
): Promise<BatchResult> => {
  if (options.dryRun) throw new Error("--dry-run no ejecuta lotes; utilizar describeBatch");
  const outRoot = resolve(options.outRoot);
  const historyDir = resolve(options.historyDir);
  const startedAt = timestamp();
  if (campaignRunId !== undefined && (!/^\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-\d{3}Z-[a-f0-9]{8}$/.test(campaignRunId) ||
    basename(outRoot) !== campaignRunId)) {
    throw new Error("Identificador de campaña y carpeta de extracción no coinciden");
  }
  const runId = campaignRunId ?? `${startedAt.replace(/[:.]/g, "-")}-${randomUUID().slice(0, 8)}`;
  const runDir = join(historyDir, runId);
  const reportFile = join(runDir, "run.json");
  const completed: ProviderRun[] = [];
  const makeReport = (status: BatchReport["status"], endedAt: string | null): BatchReport => ({
    version: 1, runId, startedAt, endedAt, status, requestedProviders: options.providerIds, providers: [...completed]
  });
  if (campaignRunId !== undefined) {
    await mkdir(runDir, { recursive: true });
    await writeBatchReport(reportFile, makeReport("running", null));
  }
  await mkdir(outRoot, { recursive: true });
  const lock = await acquireBatchLock(outRoot, { runId, pid: process.pid, startedAt });

  const controller = new AbortController();
  const cancel = (): void => controller.abort();
  const cancelExternal = (): void => controller.abort();
  process.on("SIGINT", cancel);
  process.on("SIGTERM", cancel);
  externalSignal?.addEventListener("abort", cancelExternal, { once: true });
  if (externalSignal?.aborted) cancelExternal();
  try {
    if (lock.recoveredPid !== null) observer?.recoveredLock?.(lock.recoveredPid);
    if (campaignRunId === undefined) {
      await mkdir(runDir, { recursive: true });
      await writeBatchReport(reportFile, makeReport("running", null));
    }
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
    try {
      await cleanBatchExcess(historyDir, false);
    } catch (error) {
      console.warn(`Aviso: historial pendiente de limpieza: ${error instanceof Error ? error.message : String(error)}`);
    }
    return { report, reportFile };
  } finally {
    observer?.stop?.();
    process.off("SIGINT", cancel);
    process.off("SIGTERM", cancel);
    externalSignal?.removeEventListener("abort", cancelExternal);
    await lock.release();
  }
};
