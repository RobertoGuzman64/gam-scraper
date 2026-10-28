import { readFile, stat } from "node:fs/promises";
import type { PublicationStats } from "../../contracts/batch-report.js";

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const isStringArray = (value: unknown): value is readonly string[] =>
  Array.isArray(value) && value.every((entry: unknown) => typeof entry === "string");

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

