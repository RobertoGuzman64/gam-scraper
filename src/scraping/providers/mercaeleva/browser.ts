import { spawn } from "node:child_process";
import { Readable, Writable } from "node:stream";
import { existsSync } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DevtoolsPipe, DevtoolsWebSocket, withTimeout, waitForDebuggingPort, openDebugSocket } from "../../../infrastructure/browser/devtools.js";
import type { DevtoolsResponse } from "../../../infrastructure/browser/devtools.js";
import { buildMercaelevaCatalogScript, buildMercaelevaReadinessScript } from "./listing-script.js";
import { extractMercaelevaLinks } from "./parsers.js";
import { buildMercaelevaPageUrl } from "./page-url.js";

export { waitForDebuggingPort } from "../../../infrastructure/browser/devtools.js";
export { buildMercaelevaCatalogScript, buildMercaelevaReadinessScript } from "./listing-script.js";

const candidateBrowsers = (): readonly string[] => {
  const candidates = [process.env.CHROME_PATH, process.env.CHROMIUM_PATH];
  if (process.platform === "win32") {
    for (const home of [process.env.PROGRAMFILES, process.env["PROGRAMFILES(X86)"], process.env.LOCALAPPDATA]) {
      if (home) candidates.push(`${home}\\Google\\Chrome\\Application\\chrome.exe`, `${home}\\Microsoft\\Edge\\Application\\msedge.exe`);
    }
  }
  candidates.push("chromium", "chromium-browser", "google-chrome", "google-chrome-stable", "chrome", "msedge");
  return [...new Set(candidates.filter((value): value is string => !!value))];
};

const asCatalog = (value: unknown): { readonly pages: readonly string[]; readonly expectedTotal: number } => {
  if (!value || typeof value !== "object" || !("pages" in value) || !Array.isArray(value.pages)
    || !value.pages.every((page: unknown) => typeof page === "string")
    || !("expectedTotal" in value) || typeof value.expectedTotal !== "number"
    || !Number.isSafeInteger(value.expectedTotal) || value.expectedTotal <= 0) {
    throw new Error("Mercaeleva devolvió una respuesta de navegación inválida");
  }
  return { pages: value.pages, expectedTotal: value.expectedTotal };
};

const renderWithBrowser = async (
  executable: string, profile: string, url: string, timeoutMs: number, maxPages: number, delayMs: number,
  onProgress?: (pages: number, found: number, stage: string) => void
): Promise<{ readonly pages: readonly string[]; readonly expectedTotal: number }> => {
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
    detached: true,
    windowsHide: true
  });
  let diagnostics = "";
  let stage = "arranque";
  let lastState = "sin respuesta de la web";
  let lastNetwork = "sin respuesta HTTP del documento";
  let documentRequest: string | null = null;
  const reportStage = (value: string): void => {
    if (stage === value) return;
    stage = value;
    onProgress?.(0, 0, value);
  };
  const handleEvent = (event: DevtoolsResponse): void => {
    if (event.method === "Network.requestWillBeSent" && event.params?.type === "Document") {
      documentRequest = event.params.requestId ?? null;
    }
    if (event.method === "Network.responseReceived" && event.params?.type === "Document") {
      documentRequest = event.params.requestId ?? documentRequest;
      lastNetwork = `HTTP ${String(event.params.response?.status ?? "desconocido")}`;
    }
    if (event.method === "Network.loadingFailed" && event.params?.requestId === documentRequest && event.params.errorText) {
      lastNetwork = event.params.errorText;
    }
  };
  child.stderr?.on("data", (chunk: Buffer) => {
    if (diagnostics.length < 3000) diagnostics += chunk.toString("utf8").slice(0, 3000 - diagnostics.length);
  });
  const commandTimeoutMs = Math.min(timeoutMs, 10000);
  const navigationTimeoutMs = Math.min(timeoutMs, 12000);
  const catalogTimeoutMs = Math.max(120000, Math.min(900000, maxPages * (navigationTimeoutMs + commandTimeoutMs)));
  const timer = setTimeout(() => child.kill(), catalogTimeoutMs + navigationTimeoutMs + commandTimeoutMs * 3);
  let socket: WebSocket | null = null;
  let devtools: DevtoolsPipe | DevtoolsWebSocket | null = null;
  try {
    await new Promise<void>((resolve, reject) => {
      if (child.pid) { resolve(); return; }
      child.once("spawn", () => resolve());
      child.once("error", reject);
    });
    if (windows) {
      reportStage("abriendo depuración de Chrome");
      const endpoint = await waitForDebuggingPort(profile, child, commandTimeoutMs);
      reportStage("conectando con Chrome");
      socket = await openDebugSocket(endpoint, commandTimeoutMs);
      devtools = new DevtoolsWebSocket(socket, handleEvent);
    } else {
      const input = child.stdio[3];
      const output = child.stdio[4];
      if (!(input instanceof Writable) || !(output instanceof Readable)) {
        throw new Error("Chrome no abrió los canales de depuración");
      }
      devtools = new DevtoolsPipe(child, input, output, handleEvent);
    }
    if (!devtools) throw new Error("No se inicializó el canal de depuración");
    const channel = devtools;
    const send = (
      operation: string, method: string, params: Record<string, unknown> = {}, sessionId?: string,
      deadlineMs = commandTimeoutMs
    ): Promise<Record<string, unknown>> => {
      reportStage(operation);
      return withTimeout(channel.send(method, params, sessionId), deadlineMs, `${operation} (${method})`);
    };
    const target = await send("crear pestaña", "Target.createTarget", { url: "about:blank" });
    if (typeof target.targetId !== "string") throw new Error("Chrome no creó la pestaña de catálogo");
    const attached = await send("conectar pestaña", "Target.attachToTarget", { targetId: target.targetId, flatten: true });
    if (typeof attached.sessionId !== "string") throw new Error("Chrome no abrió una sesión de catálogo");
    const sessionId = attached.sessionId;
    await send("activar página", "Page.enable", {}, sessionId);
    await send("activar JavaScript", "Runtime.enable", {}, sessionId);
    await send("activar red", "Network.enable", {}, sessionId);
    const pages: string[] = [];
    const seen = new Set<string>();
    let expectedTotal: number | null = null;
    let pageSize: number | null = null;
    for (let page = 1; page <= maxPages; page += 1) {
      const pageUrl = buildMercaelevaPageUrl(url, page);
      const expected = new URL(pageUrl);
      let content: { readonly pages: readonly string[]; readonly expectedTotal: number } | null = null;
      for (let attempt = 0; attempt < 2 && !content; attempt += 1) {
        const navigation = await send("abrir página " + page, "Page.navigate", { url: pageUrl }, sessionId, navigationTimeoutMs);
        if (typeof navigation.errorText === "string") {
          throw new Error(`Chrome no pudo abrir ${pageUrl}: ${navigation.errorText}`);
        }
        const openedAt = Date.now();
        let loaded = false;
        while (Date.now() - openedAt < navigationTimeoutMs) {
          try {
            const state = await send("esperando página " + page, "Runtime.evaluate", {
              expression: buildMercaelevaReadinessScript(), returnByValue: true
            }, sessionId);
            if (state.exceptionDetails) {
              throw new Error(`Mercaeleva: error JavaScript en ${pageUrl}: ${JSON.stringify(state.exceptionDetails).slice(0, 400)}`);
            }
            const result = state.result;
            const value = result && typeof result === "object" && "value" in result ? result.value : null;
            if (value && typeof value === "object" && "href" in value && typeof value.href === "string") {
              const actual = new URL(value.href);
              lastState = `url=${actual.toString()}, ready=${"ready" in value ? String(value.ready) : "?"}, ` +
                `title=${"title" in value ? String(value.title) : "?"}, ` +
                `resultados=${"count" in value ? String(value.count) : "?"}, ` +
                `enlaces=${"links" in value ? String(value.links) : "?"}`;
              if (actual.origin === expected.origin &&
                actual.pathname.replace(/\/+$/, "") === expected.pathname.replace(/\/+$/, "") &&
                actual.searchParams.get("pageIndex") === expected.searchParams.get("pageIndex") &&
                "count" in value && typeof value.count === "string" &&
                "links" in value && typeof value.links === "number" && value.links > 0 &&
                (("ready" in value && value.ready === "complete") || Date.now() - openedAt >= 2500)) {
                loaded = true;
                break;
              }
            }
          } catch (error) {
            if (!/Inspected target navigated or closed|Execution context was destroyed|Cannot find context with specified id/i.test(String(error))) {
              throw error;
            }
          }
          await new Promise<void>((resolve) => setTimeout(resolve, 250));
        }
        if (!loaded) {
          if (attempt === 0) continue;
          throw new Error(`Mercaeleva: página ${page} sin productos tras navegación directa a ${pageUrl} (${lastState})`);
        }
        const evaluation = await send("leer página " + page, "Runtime.evaluate", {
          expression: buildMercaelevaCatalogScript(1, timeoutMs, 0), awaitPromise: true, returnByValue: true
        }, sessionId, commandTimeoutMs);
        if (evaluation.exceptionDetails) {
          throw new Error(`Mercaeleva: no se pudo leer la página ${page}: ${JSON.stringify(evaluation.exceptionDetails).slice(0, 400)}`);
        }
        content = asCatalog(evaluation.result && typeof evaluation.result === "object" && "value" in evaluation.result
          ? evaluation.result.value : null);
      }
      if (!content) throw new Error(`Mercaeleva: no se pudo recuperar la página ${page}`);
      if (expectedTotal !== null && content.expectedTotal !== expectedTotal) {
        throw new Error(`Mercaeleva: el total cambió en la página ${page} (${expectedTotal}/${content.expectedTotal})`);
      }
      expectedTotal = content.expectedTotal;
      const html = content.pages[0];
      if (!html) throw new Error(`Mercaeleva: página ${page} sin HTML`);
      const links = extractMercaelevaLinks(pageUrl, html);
      if (links.length === 0) throw new Error(`Mercaeleva: página ${page} sin referencias válidas`);
      if (links.some((href) => seen.has(href))) {
        throw new Error(`Mercaeleva: página ${page} repite referencias de páginas anteriores`);
      }
      if (pageSize !== null && links.length > pageSize) {
        throw new Error(`Mercaeleva: tamaño de página inesperado en la página ${page} (${links.length}/${pageSize})`);
      }
      pageSize ??= links.length;
      pages.push(html);
      for (const href of links) seen.add(href);
      onProgress?.(1, seen.size, "recorriendo páginas");
      if (seen.size >= expectedTotal) break;
      if (delayMs > 0) await new Promise<void>((resolve) => setTimeout(resolve, delayMs));
    }
    if (expectedTotal === null) throw new Error("Mercaeleva: catálogo sin resultados");
    return { pages, expectedTotal };
  } catch (error) {
    const detail = diagnostics.trim();
    const status = child.exitCode !== null ? `; exitCode=${child.exitCode}` : "";
    throw new Error(`Navegador ${executable} [${stage}]: ${String(error)}; estado=${lastState}; red=${lastNetwork}${status}${detail ? `; stderr: ${detail}` : ""}`);
  } finally {
    clearTimeout(timer);
    if (windows && devtools && socket?.readyState === WebSocket.OPEN) {
      try {
        await withTimeout(devtools.send("Browser.close"), 1200, "cerrar Chrome");
      } catch {}
    }
    socket?.close();
    if (child.exitCode === null && child.signalCode === null) {
      const exit = new Promise<void>((resolve) => child.once("exit", () => resolve()));
      child.kill();
      await Promise.race([exit, new Promise<void>((resolve) => setTimeout(resolve, 2000))]);
    }
  }
};

export const renderMercaelevaCatalog = async (
  url: string, timeoutMs: number, maxPages: number, delayMs: number,
  onProgress?: (pages: number, found: number, stage: string) => void
): Promise<{ readonly pages: readonly string[]; readonly expectedTotal: number }> => {
  const failures: string[] = [];
  for (const executable of candidateBrowsers()) {
    if ((executable.includes("/") || executable.includes("\\")) && !existsSync(executable)) continue;
    const profile = await mkdtemp(join(tmpdir(), "mercaeleva-chrome-"));
    try {
      return await renderWithBrowser(executable, profile, url, timeoutMs, maxPages, delayMs, onProgress);
    } catch (error) {
      const message = String(error);
      failures.push(message);
      if (!/Chrome finalizó|Chrome no abrió|Chrome no creó|Chrome cerró|puerto de depuración|conexión de depuración|spawn |EPIPE|ECONNRESET|ENOENT/i.test(message)) {
        throw error;
      }
    } finally {
      await rm(profile, { recursive: true, force: true, maxRetries: 10, retryDelay: 150 });
    }
  }
  throw new Error(`No se pudo iniciar Chrome/Edge para Mercaeleva. ${failures.join(" | ")}`);
};
