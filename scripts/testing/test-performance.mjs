import { randomUUID } from "node:crypto";
import { existsSync, lstatSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { relative, resolve } from "node:path";

const PROFILE_VERSION = 1;
const PROFILE_PATH = resolve("dist", ".test-runner-durations.json");
const canonical = (path) => relative(process.cwd(), resolve(path)).replaceAll("\\", "/");

export const recommendedTestConcurrency = (parallelism) => Math.min(12, Math.max(1, parallelism));

const validDurations = (value) => value !== null && typeof value === "object" && !Array.isArray(value)
  ? new Map(Object.entries(value).filter(([path, milliseconds]) =>
    (path.startsWith("dist/") || path.startsWith("scripts/")) &&
    typeof milliseconds === "number" && Number.isFinite(milliseconds) && milliseconds > 0 && milliseconds <= 3_600_000))
  : null;

export const loadTestDurations = (concurrency) => {
  try {
    if (!existsSync(PROFILE_PATH) || !lstatSync(PROFILE_PATH).isFile() || lstatSync(PROFILE_PATH).isSymbolicLink()) return null;
    const profile = JSON.parse(readFileSync(PROFILE_PATH, "utf8"));
    if (profile?.version !== PROFILE_VERSION || profile.platform !== process.platform) return null;
    const matching = profile.profiles?.[String(concurrency)] ??
      (profile.concurrency === concurrency ? profile.durations : null);
    return validDurations(matching);
  } catch {
    return null;
  }
};

const estimatedLaneTime = (files, workers, previous) => {
  const slots = Array.from({ length: workers }, () => 0);
  for (const duration of files.map((file) => previous.get(canonical(file))).sort((left, right) => right - left)) {
    const slot = slots.indexOf(Math.min(...slots));
    slots[slot] += duration;
  }
  return Math.max(...slots);
};

const balancedConcurrency = (intensive, remaining, concurrency, previous) => {
  const standard = Math.min(4, Math.max(2, Math.floor(concurrency / 3)));
  if (!previous || intensive.length < 6 || remaining.length < 10 ||
    [...intensive, ...remaining].some((file) => !previous.has(canonical(file)))) return standard;
  const baseline = Math.max(
    estimatedLaneTime(intensive, standard, previous),
    estimatedLaneTime(remaining, concurrency - standard, previous)
  );
  let chosen = standard;
  let best = baseline;
  for (let intensiveWorkers = 2; intensiveWorkers <= Math.min(6, concurrency - 4); intensiveWorkers += 1) {
    const estimate = Math.max(
      estimatedLaneTime(intensive, intensiveWorkers, previous),
      estimatedLaneTime(remaining, concurrency - intensiveWorkers, previous)
    );
    if (estimate < best) {
      best = estimate;
      chosen = intensiveWorkers;
    }
  }
  return best <= baseline * 0.9 ? chosen : standard;
};

export const planTestLanes = (files, concurrency, previous, defaults) => {
  if (files.length === 0) return [];
  const single = [{ name: "general", files, concurrency }];
  if (concurrency < 8 || files.length < 20) return single;
  const defaultSet = new Set(defaults.map((file) => `dist/${file}`));
  const intensive = [];
  const remaining = [];
  for (const file of files) {
    const name = canonical(file);
    const measured = previous?.get(name);
    if (measured === undefined ? defaultSet.has(name) : measured >= 16_000) intensive.push(file);
    else remaining.push(file);
  }
  if (intensive.length < 2 || remaining.length === 0) return single;
  const intensiveConcurrency = balancedConcurrency(intensive, remaining, concurrency, previous);
  return [
    { name: "intensiva", files: intensive, concurrency: intensiveConcurrency },
    { name: "general", files: remaining, concurrency: concurrency - intensiveConcurrency }
  ];
};

export const orderTestsByDuration = (files, previous, preferred) => files.sort((left, right) => {
  const leftPath = canonical(left);
  const rightPath = canonical(right);
  const leftDuration = previous?.get(leftPath);
  const rightDuration = previous?.get(rightPath);
  if (leftDuration !== undefined && rightDuration !== undefined && leftDuration !== rightDuration) {
    return rightDuration - leftDuration;
  }
  const leftPriority = preferred.get(leftPath.replace(/^dist\//, "")) ?? preferred.size;
  const rightPriority = preferred.get(rightPath.replace(/^dist\//, "")) ?? preferred.size;
  const leftNewCritical = leftDuration === undefined && leftPriority < preferred.size;
  const rightNewCritical = rightDuration === undefined && rightPriority < preferred.size;
  if (leftNewCritical !== rightNewCritical) return leftNewCritical ? -1 : 1;
  if (leftDuration !== undefined && rightDuration === undefined) return -1;
  if (rightDuration !== undefined && leftDuration === undefined) return 1;
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
    let profiles = {};
    if (existsSync(PROFILE_PATH)) {
      if (!lstatSync(PROFILE_PATH).isFile() || lstatSync(PROFILE_PATH).isSymbolicLink()) {
        throw new Error("El perfil de rendimiento no es un archivo regular");
      }
      try {
        const previous = JSON.parse(readFileSync(PROFILE_PATH, "utf8"));
        if (previous?.version === PROFILE_VERSION && previous.platform === process.platform) {
          if (previous.profiles !== null && typeof previous.profiles === "object" &&
            !Array.isArray(previous.profiles)) {
            profiles = Object.fromEntries(Object.entries(previous.profiles).filter(([key, value]) =>
              /^(?:[1-9]|[1-5]\d|6[0-4])$/.test(key) && validDurations(value) !== null));
          }
          if (Number.isSafeInteger(previous.concurrency) && previous.concurrency >= 1 &&
            previous.concurrency <= 64 && validDurations(previous.durations) !== null &&
            !Object.hasOwn(profiles, String(previous.concurrency))) {
            profiles[String(previous.concurrency)] = previous.durations;
          }
        }
      } catch {}
    }
    profiles[String(concurrency)] = durations;
    writeFileSync(next, JSON.stringify({ version: PROFILE_VERSION, platform: process.platform, concurrency, durations, profiles }));
    renameSync(next, PROFILE_PATH);
  } finally {
    rmSync(next, { force: true });
  }
};
