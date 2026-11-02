import { createHash } from "node:crypto";
import { lstat, open, readFile, readdir, rm, unlink } from "node:fs/promises";
import { basename, dirname, join, resolve } from "node:path";
import type { RetentionCandidate } from "../catalog/catalog-retention.js";
import { isReferenceProviderSet } from "../../../contracts/campaign-providers.js";

const runPattern = /^\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-\d{3}Z-[\da-f]{8}$/;
const providerPattern = /^[a-z0-9_-]+$/;
const references = [
  "storage/campaigns", "storage/interventions", "storage/providers", "storage/prepared",
  "storage/scraped/campaigns", "catalogs/campaigns", "catalogs/providers"
] as const;
const referenceText = /\.(json|jsonl|log|txt|csv|ts|md)$/i;
const permittedFile = /^(?:run\.json|[a-z0-9_-]+\.log|[a-z0-9_-]+-(?:summary|changes|errors|preparation|partial-preparation)\.json)$/;

type CompletedRun = { readonly name: string; readonly providers: readonly string[] };
type FileFingerprint = { readonly name: string; readonly digest: string; readonly bytes: number };

const isMissing = (error: unknown): boolean =>
  typeof error === "object" && error !== null && "code" in error && error.code === "ENOENT";

const regularDirectory = async (path: string): Promise<boolean> => {
  const info = await lstat(path);
  return info.isDirectory() && !info.isSymbolicLink();
};

const readCompletedRun = async (dir: string, name: string): Promise<CompletedRun | null> => {
  try {
    const reportPath = join(dir, name, "run.json");
    const info = await lstat(reportPath);
    if (!info.isFile() || info.isSymbolicLink() || info.nlink !== 1) return null;
    const report: unknown = JSON.parse(await readFile(reportPath, "utf8"));
    if (typeof report !== "object" || report === null || !("runId" in report) || report.runId !== name ||
      !("version" in report) || report.version !== 1 ||
      !("status" in report) || report.status !== "complete" ||
      !("endedAt" in report) || typeof report.endedAt !== "string" ||
      !Number.isFinite(Date.parse(report.endedAt)) ||
      !("requestedProviders" in report) || !Array.isArray(report.requestedProviders) ||
      report.requestedProviders.length === 0 ||
      !report.requestedProviders.every((id: unknown) => typeof id === "string" && providerPattern.test(id)) ||
      new Set(report.requestedProviders).size !== report.requestedProviders.length) return null;
    return { name, providers: report.requestedProviders };
  } catch { return null; }
};

const fingerprintFiles = async (dir: string): Promise<readonly FileFingerprint[] | null> => {
  if (!await regularDirectory(dir)) return null;
  const entries = await readdir(dir, { withFileTypes: true });
  if (!entries.some((entry) => entry.name === "run.json") ||
    !entries.every((entry) => entry.isFile() && permittedFile.test(entry.name))) return null;
  const fingerprints: FileFingerprint[] = [];
  for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
    const path = join(dir, entry.name);
    const info = await lstat(path);
    if (!info.isFile() || info.isSymbolicLink() || info.nlink !== 1) return null;
    fingerprints.push({ name: entry.name,
      digest: createHash("sha256").update(await readFile(path)).digest("hex"), bytes: info.size });
  }
  return fingerprints;
};

const protectedRunIds = async (historyDir: string, ids: readonly string[]): Promise<ReadonlySet<string>> => {
  if (ids.length === 0) return new Set();
  const normalized = resolve(historyDir);
  const storage = dirname(normalized);
  if (basename(normalized) !== "runs" || basename(storage) !== "storage") return new Set(ids);
  const workspace = dirname(storage);
  const protectedIds = new Set<string>();
  let uncertain = false;
  const inspect = async (path: string): Promise<void> => {
    let entries;
    try { entries = await readdir(path, { withFileTypes: true }); }
    catch (error) {
      if (isMissing(error)) return;
      uncertain = true;
      return;
    }
    for (const entry of entries) {
      const file = join(path, entry.name);
      if (entry.isSymbolicLink()) { uncertain = true; continue; }
      if (entry.isDirectory()) { await inspect(file); continue; }
      if (!entry.isFile() || !referenceText.test(entry.name)) { uncertain = true; continue; }
      try {
        const contents = (await readFile(file, "utf8")).toLowerCase();
        for (const id of ids) if (contents.includes(id.toLowerCase())) protectedIds.add(id);
      } catch { uncertain = true; }
    }
  };
  for (const path of references) {
    const directory = join(workspace, path);
    try {
      if (!await regularDirectory(directory)) { uncertain = true; continue; }
      await inspect(directory);
    } catch (error) {
      if (!isMissing(error)) uncertain = true;
    }
  }
  return uncertain ? new Set(ids) : protectedIds;
};

export const batchRunExcess = async (historyDir: string): Promise<readonly RetentionCandidate[]> => {
  let entries;
  try {
    if (!await regularDirectory(historyDir)) return [];
    entries = await readdir(historyDir, { withFileTypes: true });
  } catch (error) {
    if (isMissing(error)) return [];
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
    if (run.providers.some((provider) => (counts.get(provider) ?? 0) < 2)) {
      for (const provider of run.providers) counts.set(provider, (counts.get(provider) ?? 0) + 1);
    } else expired.push(run.name);
  }
  const protectedIds = await protectedRunIds(historyDir, expired);
  const removable: RetentionCandidate[] = [];
  for (const name of expired) {
    if (protectedIds.has(name)) continue;
    const path = join(historyDir, name);
    const fingerprints = await fingerprintFiles(path);
    if (fingerprints === null) continue;
    removable.push({ path, bytes: fingerprints.reduce((sum, file) => sum + file.bytes, 0) });
  }
  return removable;
};

export const cleanBatchExcess = async (historyDir: string, dryRun: boolean): Promise<readonly RetentionCandidate[]> => {
  if (dryRun) return batchRunExcess(historyDir);
  const planned = await batchRunExcess(historyDir);
  if (planned.length === 0) return [];
  const lockPath = join(historyDir, ".retention-runs.lock");
  const lock = await open(lockPath, "wx", 0o600);
  const removed: RetentionCandidate[] = [];
  try {
    const current = await batchRunExcess(historyDir);
    if (planned.length !== current.length || planned.some((item, index) =>
      item.path !== current[index]?.path || item.bytes !== current[index]?.bytes)) {
      throw new Error("Las versiones de ejecuciones cambiaron antes de la limpieza");
    }
    for (const candidate of current) {
      const before = await fingerprintFiles(candidate.path);
      if (before === null) throw new Error(`Conjunto no verificable: ${candidate.path}`);
      const recalculated = await batchRunExcess(historyDir);
      if (!recalculated.some((item) => item.path === candidate.path && item.bytes === candidate.bytes)) {
        throw new Error(`Referencias o cuota modificadas: ${candidate.path}`);
      }
      const after = await fingerprintFiles(candidate.path);
      if (after === null || before.length !== after.length || before.some((item, index) =>
        item.name !== after[index]?.name || item.digest !== after[index]?.digest ||
        item.bytes !== after[index]?.bytes)) {
        throw new Error(`Ejecución modificada antes de eliminar: ${candidate.path}`);
      }
      await rm(candidate.path, { recursive: true });
      try {
        await lstat(candidate.path);
        throw new Error(`La ejecución reapareció tras eliminarla: ${candidate.path}`);
      } catch (error) {
        if (!isMissing(error)) throw error;
      }
      removed.push(candidate);
    }
    return removed;
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    throw new Error(`Retención de ejecuciones incompleta: ${removed.length} conjuntos eliminados y confirmados; ${detail}`);
  } finally {
    await lock.close();
    await unlink(lockPath);
  }
};
