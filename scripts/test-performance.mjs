import { randomUUID } from "node:crypto";
import { existsSync, lstatSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { relative, resolve } from "node:path";

const PROFILE_VERSION = 1;
const PROFILE_PATH = resolve("dist", ".test-runner-durations.json");
const canonical = (path) => relative(process.cwd(), resolve(path)).replaceAll("\\", "/");

export const recommendedTestConcurrency = (parallelism) => Math.min(12, Math.max(1, parallelism));

export const loadTestDurations = (concurrency) => {
  try {
    if (!existsSync(PROFILE_PATH) || !lstatSync(PROFILE_PATH).isFile() || lstatSync(PROFILE_PATH).isSymbolicLink()) return null;
    const profile = JSON.parse(readFileSync(PROFILE_PATH, "utf8"));
    if (profile?.version !== PROFILE_VERSION || profile.platform !== process.platform ||
      profile.concurrency !== concurrency || typeof profile.durations !== "object" || profile.durations === null ||
      Array.isArray(profile.durations)) return null;
    return new Map(Object.entries(profile.durations).filter(([path, milliseconds]) =>
      (path.startsWith("dist/") || path.startsWith("scripts/")) &&
      typeof milliseconds === "number" && Number.isFinite(milliseconds) && milliseconds > 0 && milliseconds <= 3_600_000));
  } catch {
    return null;
  }
};

export const orderTestsByDuration = (files, previous, preferred) => files.sort((left, right) => {
  const leftPath = canonical(left);
  const rightPath = canonical(right);
  const leftDuration = previous?.get(leftPath);
  const rightDuration = previous?.get(rightPath);
  if (leftDuration !== undefined && rightDuration !== undefined && leftDuration !== rightDuration) {
    return rightDuration - leftDuration;
  }
  if (leftDuration !== undefined && rightDuration === undefined) return -1;
  if (rightDuration !== undefined && leftDuration === undefined) return 1;
  const leftPriority = preferred.get(leftPath.replace(/^dist\//, "")) ?? preferred.size;
  const rightPriority = preferred.get(rightPath.replace(/^dist\//, "")) ?? preferred.size;
  return leftPriority - rightPriority || leftPath.localeCompare(rightPath);
});

export const durationRegressions = (current, previous) => current.filter(({ file, milliseconds }) => {
  const baseline = previous?.get(canonical(file));
  return baseline !== undefined && milliseconds > Math.max(baseline * 2, baseline + 10000);
}).sort((left, right) => right.milliseconds - left.milliseconds);

export const saveTestDurations = (concurrency, entries) => {
  const durations = Object.fromEntries(entries.filter(({ milliseconds }) =>
    Number.isFinite(milliseconds) && milliseconds > 0 && milliseconds <= 3_600_000
  ).map(({ file, milliseconds }) => [canonical(file), milliseconds]));
  const next = `${PROFILE_PATH}.${randomUUID()}.tmp`;
  try {
    if (existsSync(PROFILE_PATH) && (!lstatSync(PROFILE_PATH).isFile() || lstatSync(PROFILE_PATH).isSymbolicLink())) {
      throw new Error("El perfil de rendimiento no es un archivo regular");
    }
    writeFileSync(next, JSON.stringify({ version: PROFILE_VERSION, platform: process.platform, concurrency, durations }));
    renameSync(next, PROFILE_PATH);
  } finally {
    rmSync(next, { force: true });
  }
};
