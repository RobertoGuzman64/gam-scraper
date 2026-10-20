import { randomUUID } from "node:crypto";
import { mkdir, readFile, rename, rm, stat, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

export type ProviderRun = {
  readonly providerId: string;
  readonly status: "complete" | "failed";
  readonly startedAt: string;
  readonly endedAt: string;
  readonly durationMs: number;
  readonly outputDir: string;
  readonly outputPrefix: string;
  readonly logFile: string;
  readonly summaryFile: string;
  readonly changesFile: string;
  readonly archivedSummaryFile?: string;
  readonly archivedChangesFile?: string;
  readonly archivedErrorsFile?: string;
  readonly archivedPreparationFile?: string;
  readonly archivedPartialPreparationFile?: string;
  readonly products?: number;
  readonly failures?: number;
  readonly added?: number;
  readonly updated?: number;
  readonly suspectedMissing?: number;
  readonly error?: string;
};

export type BatchReport = {
  readonly version: 1;
  readonly runId: string;
  readonly startedAt: string;
  readonly endedAt: string | null;
  readonly status: "running" | "complete" | "partial" | "failed";
  readonly requestedProviders: readonly string[];
  readonly providers: readonly ProviderRun[];
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const isStringArray = (value: unknown): value is readonly string[] =>
  Array.isArray(value) && value.every((entry: unknown) => typeof entry === "string");

export type PublicationStats = {
  readonly products: number;
  readonly failures: number;
  readonly added: number;
  readonly updated: number;
  readonly suspectedMissing: number;
};

export const readPublicationStats = async (
  summaryFile: string,
  changesFile: string,
  earliestStart: string
): Promise<PublicationStats> => {
  const summaryRaw: unknown = JSON.parse(await readFile(summaryFile, "utf8"));
  if (!isRecord(summaryRaw) || typeof summaryRaw.startedAt !== "string" ||
    !Number.isFinite(Date.parse(summaryRaw.startedAt)) ||
    Date.parse(summaryRaw.startedAt) < Date.parse(earliestStart) ||
    !isRecord(summaryRaw.quality) || summaryRaw.quality.status !== "complete" ||
    summaryRaw.quality.published !== true || !isRecord(summaryRaw.totals) ||
    !Number.isSafeInteger(summaryRaw.totals.scrapedProducts) ||
    !Number.isSafeInteger(summaryRaw.totals.failures) ||
    Number(summaryRaw.totals.scrapedProducts) < 1 || Number(summaryRaw.totals.failures) !== 0) {
    throw new Error("El resumen no confirma una extracción completa de esta ejecución");
  }

  const changesMeta = await stat(changesFile);
  if (changesMeta.mtimeMs < Date.parse(earliestStart) - 1000) {
    throw new Error("El informe de cambios no pertenece a esta ejecución");
  }
  const changesRaw: unknown = JSON.parse(await readFile(changesFile, "utf8"));
  if (!isRecord(changesRaw) || changesRaw.status !== "comparable" ||
    !isStringArray(changesRaw.added) || !isStringArray(changesRaw.updated) ||
    !isStringArray(changesRaw.suspectedMissing)) {
    throw new Error("Informe de cambios incompleto o inválido");
  }
  return {
    products: Number(summaryRaw.totals.scrapedProducts),
    failures: Number(summaryRaw.totals.failures),
    added: changesRaw.added.length,
    updated: changesRaw.updated.length,
    suspectedMissing: changesRaw.suspectedMissing.length
  };
};

export const writeBatchReport = async (file: string, report: BatchReport): Promise<void> => {
  await mkdir(dirname(file), { recursive: true });
  const temp = `${file}.${randomUUID()}.tmp`;
  await writeFile(temp, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  try {
    await rename(temp, file);
  } catch (error) {
    await rm(temp, { force: true });
    throw error;
  }
};

export const getBatchStatus = (runs: readonly ProviderRun[]): BatchReport["status"] => {
  const successes = runs.filter((run) => run.status === "complete").length;
  return successes === runs.length && runs.length > 0 ? "complete" : successes === 0 ? "failed" : "partial";
};
