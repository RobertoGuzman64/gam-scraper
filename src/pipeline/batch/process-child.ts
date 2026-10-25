import { spawn, type ChildProcess } from "node:child_process";
import { open } from "node:fs/promises";
import type { ScrapeEvent } from "../../contracts/progress.js";
import { isScrapeMessage } from "../../contracts/progress.js";

const terminateTree = (child: ChildProcess): void => {
  if (child.exitCode !== null || child.signalCode !== null || !child.pid) return;
  if (process.platform === "win32") {
    const killer = spawn("taskkill", ["/PID", String(child.pid), "/T", "/F"], { stdio: "ignore", windowsHide: true });
    killer.once("error", () => child.kill());
  } else {
    child.kill("SIGTERM");
  }
};

export const executeProvider = async (
  scriptFile: string, providerId: string, outDir: string, outPrefix: string, logFile: string,
  progress: (event: ScrapeEvent) => void, signal: AbortSignal
): Promise<number> => {
  if (signal.aborted) throw new Error("Lote cancelado antes de ejecutar el proveedor");
  const log = await open(logFile, "w");
  try {
    return await new Promise<number>((done, fail) => {
      const child = spawn(process.execPath, [
        scriptFile, "--provider", providerId, "--outDir", outDir, "--outPrefix", outPrefix
      ], { cwd: process.cwd(), stdio: ["ignore", log.fd, log.fd, "ipc"], windowsHide: true });
      const cancel = (): void => terminateTree(child);
      const cleanup = (): void => signal.removeEventListener("abort", cancel);
      signal.addEventListener("abort", cancel, { once: true });
      if (signal.aborted) cancel();
      child.on("message", (message: unknown) => {
        if (isScrapeMessage(message)) progress(message.event);
      });
      child.once("error", (error) => { cleanup(); fail(error); });
      child.once("close", (code, childSignal) => {
        cleanup();
        if (signal.aborted) fail(new Error("Lote cancelado por señal; proceso hijo detenido"));
        else done(childSignal === null ? (code ?? -1) : -1);
      });
    });
  } finally {
    await log.close();
  }
};

