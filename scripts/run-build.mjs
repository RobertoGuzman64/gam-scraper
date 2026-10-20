import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

const quiet = process.argv.includes("--quiet");
const startedAt = Date.now();
const interactive = process.stdout.isTTY === true && process.env.CI !== "true" && process.env.TERM !== "dumb";
const frames = ["|", "/", "-", "\\"];
const script = resolve("node_modules/typescript/bin/tsc");
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
  console.error(`BUILD | ERROR | No existe ${script}; ejecutar npm ci`);
  process.exitCode = 1;
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
  if (result.error) console.error(`BUILD | ERROR | ${result.error.stack ?? result.error.message}`);
  if (!quiet || result.code !== 0) {
    console.log(`BUILD | ${result.code === 0 ? "OK" : "ERROR"} | ${duration()} | código ${result.code}`);
  }
  process.exitCode = result.code;
}
