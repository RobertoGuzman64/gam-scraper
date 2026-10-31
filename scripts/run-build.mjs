import { spawn } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, readdirSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { formatScriptStatus } from "./terminal.mjs";

const quiet = process.argv.includes("--quiet");
const ifNeeded = process.argv.includes("--if-needed");
const root = resolve(".");
const stampFile = resolve("dist/.tooling-build.json");
const sourcePaths = () => {
  const files = [];
  const visit = (directory) => {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const path = join(directory, entry.name);
      if (entry.isDirectory()) visit(path);
      else if (entry.isFile() && entry.name.endsWith(".ts")) files.push(path);
    }
  };
  visit(resolve("src"));
  return files.sort();
};
const fingerprint = (files) => {
  const hash = createHash("sha256");
  for (const path of [...files, resolve("tsconfig.json"), resolve("package.json"),
    resolve("package-lock.json"), resolve("scripts/run-build.mjs"),
    resolve("node_modules/typescript/package.json")]) {
    hash.update(relative(root, path));
    hash.update("\0");
    hash.update(readFileSync(path));
    hash.update("\0");
  }
  return hash.digest("hex");
};
const compiled = (files) => files.every((path) => path.endsWith(".d.ts") ||
  existsSync(resolve("dist", relative(resolve("src"), path).replace(/\.ts$/, ".js"))));
const saveStamp = (value) => {
  mkdirSync(resolve("dist"), { recursive: true });
  const stage = `${stampFile}.${randomUUID()}.tmp`;
  try {
    writeFileSync(stage, JSON.stringify({ version: 1, fingerprint: value }));
    renameSync(stage, stampFile);
  } finally {
    rmSync(stage, { force: true });
  }
};
const loadStamp = () => {
  try {
    const value = JSON.parse(readFileSync(stampFile, "utf8"));
    return value?.version === 1 && typeof value.fingerprint === "string" ? value.fingerprint : null;
  } catch { return null; }
};
const startedAt = Date.now();
const interactive = process.stdout.isTTY === true && process.env.CI !== "true" && process.env.TERM !== "dumb";
const frames = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];
const script = resolve("node_modules/typescript/bin/tsc");
let sources;
let sourceFingerprint;
try {
  sources = sourcePaths();
  sourceFingerprint = fingerprint(sources);
} catch (error) {
  console.error(formatScriptStatus("FAIL", `BUILD | ${error instanceof Error ? error.message : String(error)}`, process.stderr));
  process.exit(1);
}
let frame = 0;
let lastPrinted = 0;
let lineOpen = false;

const duration = () => `${Math.floor((Date.now() - startedAt) / 1000)}s`;
const clear = () => {
  if (!lineOpen) return;
  process.stdout.write("\r\x1b[2K");
  lineOpen = false;
};
const tick = () => {
  if (quiet) return;
  const content = `BUILD | compilando TypeScript | ${duration()}`;
  if (interactive) {
    const line = `${frames[frame++ % frames.length]} ${content}`;
    const width = Math.max(20, (process.stdout.columns ?? 100) - 1);
    clear();
    process.stdout.write(line.length > width ? `${line.slice(0, width - 1)}…` : line);
    lineOpen = true;
  } else if (Date.now() - lastPrinted >= 15_000) {
    lastPrinted = Date.now();
    console.log(content);
  }
};

if (!existsSync(script)) {
  console.error(formatScriptStatus("FAIL", `BUILD | No existe ${script}; ejecutar npm ci`, process.stderr));
  process.exitCode = 1;
} else if (ifNeeded && loadStamp() === sourceFingerprint && compiled(sources)) {
  if (!quiet) console.log(formatScriptStatus("PASS", "BUILD | sin cambios, compilación reutilizada"));
} else {
  const stdout = [];
  const stderr = [];
  const child = spawn(process.execPath, [script, "-p", "tsconfig.json"], { stdio: ["ignore", "pipe", "pipe"], windowsHide: true });
  child.stdout.setEncoding("utf8");
  child.stderr.setEncoding("utf8");
  child.stdout.on("data", (chunk) => stdout.push(chunk));
  child.stderr.on("data", (chunk) => stderr.push(chunk));
  tick();
  const interval = setInterval(tick, interactive ? 160 : 1000);
  const result = await new Promise((done) => {
    child.once("error", (error) => done({ code: 1, error }));
    child.once("close", (code, signal) => done({ code: signal ? 1 : (code ?? 1), error: null }));
  });
  clearInterval(interval);
  clear();
  if (stdout.length) process.stdout.write(stdout.join(""));
  if (stderr.length) process.stderr.write(stderr.join(""));
  if (result.error) console.error(formatScriptStatus("FAIL", `BUILD | ${result.error.stack ?? result.error.message}`, process.stderr));
  if (result.code === 0) {
    if (fingerprint(sourcePaths()) !== sourceFingerprint) {
      console.error(formatScriptStatus("FAIL", "BUILD | Los archivos cambiaron durante la compilación", process.stderr));
      result.code = 1;
    } else saveStamp(sourceFingerprint);
  }
  if (!quiet || result.code !== 0) {
    console.log(formatScriptStatus(result.code === 0 ? "PASS" : "FAIL", `BUILD | ${duration()} | código ${result.code}`));
  }
  process.exitCode = result.code;
}
