import { createHash, randomUUID } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, readdirSync, renameSync, rmSync, statSync, writeFileSync } from "node:fs";
import { join, relative, resolve } from "node:path";

const stampName = ".tooling-build.json";
const version = 2;

export const sourcePaths = (root) => {
  const files = [];
  const visit = (directory) => {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const path = join(directory, entry.name);
      if (entry.isDirectory()) visit(path);
      else if (entry.isFile() && entry.name.endsWith(".ts")) files.push(path);
    }
  };
  visit(join(root, "src"));
  return files.sort();
};

const dependencyPaths = (root) => [
  "tsconfig.json", "package.json", "package-lock.json", "scripts/run-build.mjs",
  "scripts/build-cache.mjs", "node_modules/typescript/package.json"
].map((path) => join(root, path));

export const buildInputs = (root, sources = sourcePaths(root)) => [...sources, ...dependencyPaths(root)];

export const fingerprint = (root, files) => {
  const hash = createHash("sha256");
  for (const path of files) {
    hash.update(relative(root, path));
    hash.update("\0");
    hash.update(readFileSync(path));
    hash.update("\0");
  }
  return hash.digest("hex");
};

export const snapshot = (root, files) => files.map((path) => {
  const info = statSync(path);
  return [relative(root, path), info.size, info.mtimeMs, info.ctimeMs, info.birthtimeMs, info.ino];
});

const compiled = (root, sources) => sources.every((path) => path.endsWith(".d.ts") ||
  existsSync(join(root, "dist", relative(join(root, "src"), path).replace(/\.ts$/, ".js"))));

export const loadStamp = (root) => {
  try {
    const value = JSON.parse(readFileSync(join(root, "dist", stampName), "utf8"));
    return value?.version === version && typeof value.fingerprint === "string" && Array.isArray(value.snapshot)
      ? value : null;
  } catch { return null; }
};

export const isCurrentBuild = (root, sources, inputs) => {
  const value = loadStamp(root);
  if (!value) return false;
  try {
    const currentSources = sources ?? sourcePaths(root);
    if (!compiled(root, currentSources)) return false;
    const current = snapshot(root, inputs ?? buildInputs(root, currentSources));
    return JSON.stringify(value.snapshot) === JSON.stringify(current);
  } catch { return false; }
};

export const saveStamp = (root, value, inputSnapshot) => {
  const path = join(root, "dist", stampName);
  mkdirSync(join(root, "dist"), { recursive: true });
  const stage = `${path}.${randomUUID()}.tmp`;
  try {
    writeFileSync(stage, JSON.stringify({ version, fingerprint: value, snapshot: inputSnapshot }));
    renameSync(stage, path);
  } finally {
    rmSync(stage, { force: true });
  }
};
