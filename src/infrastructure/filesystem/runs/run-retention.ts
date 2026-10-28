import { readFile, readdir, rm, stat } from "node:fs/promises";
import { join } from "node:path";
import type { RetentionCandidate } from "../catalog/catalog-retention.js";
import { isReferenceProviderSet } from "../../../contracts/campaign-providers.js";

const runPattern = /^\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-\d{3}Z-[\da-f]{8}$/;

type CompletedRun = { readonly name: string; readonly providers: readonly string[] };

const readCompletedRun = async (dir: string, name: string): Promise<CompletedRun | null> => {
  try {
    const report: unknown = JSON.parse(await readFile(join(dir, name, "run.json"), "utf8"));
    if (typeof report !== "object" || report === null || !('runId' in report) || report.runId !== name ||
      !('version' in report) || report.version !== 1 ||
      !('status' in report) || !["complete", "partial", "failed"].includes(String(report.status)) ||
      !('endedAt' in report) || typeof report.endedAt !== "string" ||
      !('requestedProviders' in report) || !Array.isArray(report.requestedProviders) ||
      !report.requestedProviders.every((id: unknown) => typeof id === "string" && id.length > 0)) return null;
    return { name, providers: report.requestedProviders };
  } catch { return null; }
};

const sizeOf = async (path: string): Promise<number> => {
  let size = 0;
  for (const entry of await readdir(path, { withFileTypes: true })) {
    if (entry.isFile()) {
      size += (await stat(join(path, entry.name))).size;
    } else if (entry.isDirectory()) size += await sizeOf(join(path, entry.name));
  }
  return size;
};

export const batchRunExcess = async (historyDir: string): Promise<readonly RetentionCandidate[]> => {
  let entries;
  try { entries = await readdir(historyDir, { withFileTypes: true }); }
  catch (error) {
    if (typeof error === "object" && error !== null && "code" in error && error.code === "ENOENT") return [];
    throw error;
  }
  const runs: CompletedRun[] = [];
  for (const entry of entries) {
    if (entry.isDirectory() && runPattern.test(entry.name)) {
      const run = await readCompletedRun(historyDir, entry.name);
      if (run && !isReferenceProviderSet(run.providers)) runs.push(run);
    }
  }
  runs.sort((a, b) => b.name.localeCompare(a.name));
  const counts = new Map<string, number>();
  const expired: string[] = [];
  for (const run of runs) {
    const needed = run.providers.some((provider) => (counts.get(provider) ?? 0) < 3);
    if (needed) {
      for (const provider of run.providers) counts.set(provider, (counts.get(provider) ?? 0) + 1);
    } else expired.push(run.name);
  }
  const removable: RetentionCandidate[] = [];
  for (const name of expired) {
    const path = join(historyDir, name);
    const entries = await readdir(path, { withFileTypes: true });
    if (!entries.every((entry) => entry.isFile() &&
      (entry.name === "run.json" || /^[a-z0-9_-]+\.log$/.test(entry.name) ||
        /^[a-z0-9_-]+-(?:summary|changes|errors|preparation|partial-preparation)\.json$/.test(entry.name)))) continue;
    removable.push({ path, bytes: await sizeOf(path) });
  }
  return removable;
};

export const cleanBatchExcess = async (historyDir: string, dryRun: boolean): Promise<readonly RetentionCandidate[]> => {
  const candidates = await batchRunExcess(historyDir);
  if (!dryRun) for (const candidate of candidates) await rm(candidate.path, { recursive: true, force: true });
  return candidates;
};
