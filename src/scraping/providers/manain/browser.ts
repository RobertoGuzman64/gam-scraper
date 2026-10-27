import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Readable, Writable } from "node:stream";
import type { ScrapeOptions } from "../../../contracts/scraping.js";
import { DevtoolsPipe, DevtoolsWebSocket, openDebugSocket, waitForDebuggingPort, withTimeout } from "../../../infrastructure/browser/devtools.js";
import type { DevtoolsResponse } from "../../../infrastructure/browser/devtools.js";
import { parseManainListingResult } from "./listing.js";
import type { ManainListingResult } from "./listing.js";
import { buildManainListingScript } from "./listing-script.js";

const browsers = (): readonly string[] => {
  const paths = [process.env.CHROME_PATH, process.env.CHROMIUM_PATH];
  if (process.platform === "win32") {
    for (const home of [process.env.PROGRAMFILES, process.env["PROGRAMFILES(X86)"], process.env.LOCALAPPDATA]) {
      if (home) paths.push(`${home}\\Google\\Chrome\\Application\\chrome.exe`, `${home}\\Microsoft\\Edge\\Application\\msedge.exe`);
    }
  }
  paths.push("chromium", "chromium-browser", "google-chrome", "google-chrome-stable", "chrome", "msedge");
  return [...new Set(paths.filter((path): path is string => !!path))];
};

const runBrowser = async (
  executable: string, profile: string, url: string, options: ScrapeOptions,
  onProgress?: (pages: number, found: number, stage?: string) => void
): Promise<ManainListingResult> => {
  const windows = process.platform === "win32";
  const flags = [
    "--headless", "--disable-gpu", "--disable-extensions", "--no-first-run", "--no-default-browser-check",
    "--disable-dev-shm-usage", "--window-size=1600,2400",
    windows ? "--remote-debugging-port=0" : "--remote-debugging-pipe",
    `--user-data-dir=${profile}`, "about:blank"
  ];
  if (windows) flags.unshift("--remote-debugging-address=127.0.0.1");
  if (process.getuid?.() === 0) flags.unshift("--no-sandbox");
  const child = spawn(executable, flags, {
    stdio: windows ? ["ignore", "ignore", "pipe"] : ["ignore", "ignore", "pipe", "pipe", "pipe"],
    detached: true, windowsHide: true
  });
  const commandTimeoutMs = Math.min(options.timeoutMs, 10000);
  const navigationTimeoutMs = Math.min(options.timeoutMs, 15000);
  const catalogTimeoutMs = Math.min(900000, Math.max(options.timeoutMs, 1000) * options.maxPages + 30000);
  const timer = setTimeout(() => child.kill(), catalogTimeoutMs + navigationTimeoutMs + commandTimeoutMs * 3);
  let lastStatus: number | null = null;
  const onEvent = (event: DevtoolsResponse): void => {
    if (event.method === "Network.responseReceived" && event.params?.type === "Document") {
      lastStatus = event.params.response?.status ?? null;
    }
  };
  let stage = "iniciando Chrome";
  let diagnostics = "";
  let socket: WebSocket | null = null;
  let devtools: DevtoolsPipe | DevtoolsWebSocket | null = null;
  child.stderr?.on("data", (chunk: Buffer) => {
    if (diagnostics.length < 1200) diagnostics += chunk.toString("utf8").slice(0, 1200 - diagnostics.length);
  });
  try {
    await new Promise<void>((resolve, reject) => {
      if (child.pid) { resolve(); return; }
      child.once("spawn", () => resolve());
      child.once("error", reject);
    });
    if (windows) {
      stage = "abriendo depuración";
      const endpoint = await waitForDebuggingPort(profile, child, commandTimeoutMs);
      socket = await openDebugSocket(endpoint, commandTimeoutMs);
      devtools = new DevtoolsWebSocket(socket, onEvent);
    } else {
      const input = child.stdio[3];
      const output = child.stdio[4];
      if (!(input instanceof Writable) || !(output instanceof Readable)) throw new Error("Chrome no abrió la depuración");
      devtools = new DevtoolsPipe(child, input, output, onEvent);
    }
    if (!devtools) throw new Error("No se inicializó la depuración");
    const connection = devtools;
    const send = (method: string, params: Record<string, unknown> = {}, sessionId?: string, ms = commandTimeoutMs) =>
      withTimeout(connection.send(method, params, sessionId), ms, `${stage}: ${method}`);
    stage = "abriendo pestaña";
    const target = await send("Target.createTarget", { url: "about:blank" });
    if (typeof target.targetId !== "string") throw new Error("No se creó la pestaña");
    const attached = await send("Target.attachToTarget", { targetId: target.targetId, flatten: true });
    if (typeof attached.sessionId !== "string") throw new Error("No se creó la sesión");
    const sessionId = attached.sessionId;
    await send("Page.enable", {}, sessionId);
    await send("Runtime.enable", {}, sessionId);
    await send("Network.enable", {}, sessionId);
    stage = "abriendo listado de venta";
    const navigation = await send("Page.navigate", { url }, sessionId, navigationTimeoutMs);
    if (typeof navigation.errorText === "string") throw new Error(navigation.errorText);
    stage = "recorriendo listado";
    const evaluation = await send("Runtime.evaluate", {
      expression: buildManainListingScript(options.maxPages, options.timeoutMs, options.delayMs),
      returnByValue: true, awaitPromise: true
    }, sessionId, catalogTimeoutMs);
    if (evaluation.exceptionDetails) {
      const details = evaluation.exceptionDetails;
      const exception = details && typeof details === "object" && "exception" in details ? details.exception : null;
      const description = exception && typeof exception === "object" && "description" in exception
        ? String(exception.description) : JSON.stringify(details);
      throw new Error(`Error de listado: ${description}`);
    }
    if (lastStatus !== null && lastStatus >= 400) throw new Error(`El listado de venta respondió HTTP ${lastStatus}`);
    const result = evaluation.result;
    if (!result || typeof result !== "object" || !("value" in result)) throw new Error("Chrome no devolvió el listado");
    const listing = parseManainListingResult(result.value);
    onProgress?.(listing.pagesVisited, listing.urls.length, "listado de venta recorrido");
    return listing;
  } catch (error) {
    throw new Error(`Manain [${stage}]: ${String(error)}${lastStatus === null ? "" : `; HTTP ${lastStatus}`}${diagnostics ? `; Chrome: ${diagnostics.trim()}` : ""}`);
  } finally {
    clearTimeout(timer);
    if (windows && devtools && socket?.readyState === WebSocket.OPEN) {
      try { await withTimeout(devtools.send("Browser.close"), 1200, "cerrando Chrome"); } catch {}
    }
    socket?.close();
    if (child.exitCode === null && child.signalCode === null) {
      const exit = new Promise<void>((resolve) => child.once("exit", () => resolve()));
      child.kill();
      await Promise.race([exit, new Promise<void>((resolve) => setTimeout(resolve, 2000))]);
    }
  }
};

export const discoverManainSaleCatalog = async (
  url: string, options: ScrapeOptions,
  onProgress?: (pages: number, found: number, stage?: string) => void
): Promise<ManainListingResult> => {
  const entry = new URL(url);
  if (entry.protocol !== "https:" || !["manain.com", "www.manain.com"].includes(entry.hostname.toLowerCase()) ||
    !entry.pathname.startsWith("/catalogo/venta/")) throw new Error("Manain: origen no autorizado para descubrir venta");
  if (!Number.isSafeInteger(options.maxPages) || options.maxPages < 1 || options.timeoutMs < 1000 || options.delayMs < 0) {
    throw new Error("Manain: opciones de descubrimiento inválidas");
  }
  const failures: string[] = [];
  for (const executable of browsers()) {
    if ((executable.includes("/") || executable.includes("\\")) && !existsSync(executable)) continue;
    const profile = await mkdtemp(join(tmpdir(), "manain-chrome-"));
    try {
      return await runBrowser(executable, profile, entry.toString(), options, onProgress);
    } catch (error) {
      const message = String(error);
      failures.push(message);
      if (!/Chrome finalizó|Chrome no abrió|Chrome no creó|Chrome cerró|depuración|spawn |EPIPE|ECONNRESET|ENOENT/i.test(message)) {
        throw error;
      }
    } finally {
      await rm(profile, { recursive: true, force: true, maxRetries: 10, retryDelay: 150 });
    }
  }
  throw new Error(`No se pudo iniciar Chrome/Edge para Manain: ${failures.join(" | ")}`);
};
