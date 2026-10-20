import { spawn, type ChildProcess } from "node:child_process";
import { Readable, Writable } from "node:stream";
import { existsSync } from "node:fs";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

type DevtoolsResponse = {
  readonly method?: string;
  readonly params?: {
    readonly type?: string;
    readonly args?: readonly { readonly value?: unknown }[];
    readonly errorText?: string;
    readonly requestId?: string;
    readonly response?: { readonly status?: number };
  };
  readonly id?: number;
  readonly result?: Record<string, unknown>;
  readonly error?: { readonly message: string };
  readonly sessionId?: string;
};

const withTimeout = async <T>(operation: Promise<T>, timeoutMs: number, detail: string): Promise<T> => {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      operation,
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error(`Tiempo agotado (${timeoutMs} ms): ${detail}`)), timeoutMs);
      })
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
};

type Pending = {
  readonly resolve: (value: Record<string, unknown>) => void;
  readonly reject: (reason: Error) => void;
};

class DevtoolsPipe {
  private readonly pending = new Map<number, Pending>();
  private nextId = 1;
  private buffer = "";

  constructor(
    private readonly child: ChildProcess, private readonly input: Writable, output: Readable,
    private readonly onEvent?: (message: DevtoolsResponse) => void
  ) {
    output.setEncoding("utf8");
    output.on("data", (chunk: string) => {
      this.buffer += chunk;
      const frames = this.buffer.split("\0");
      this.buffer = frames.pop() ?? "";
      for (const frame of frames) {
        if (!frame) continue;
        const response: DevtoolsResponse = JSON.parse(frame);
        if (response.id === undefined) { this.onEvent?.(response); continue; }
        const pending = this.pending.get(response.id);
        if (!pending) continue;
        this.pending.delete(response.id);
        if (response.error) pending.reject(new Error(response.error.message));
        else pending.resolve(response.result ?? {});
      }
    });
    child.on("error", (error) => this.fail(error));
    child.on("exit", (code) => this.fail(new Error(`Chrome finalizó durante la navegación (código ${String(code)})`)));
  }

  private fail(error: Error): void {
    for (const pending of this.pending.values()) pending.reject(error);
    this.pending.clear();
  }

  send(method: string, params: Record<string, unknown> = {}, sessionId?: string): Promise<Record<string, unknown>> {
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      const message = { id, method, params, ...(sessionId ? { sessionId } : {}) };
      this.input.write(`${JSON.stringify(message)}\0`, (error?: Error | null) => {
        if (!error) return;
        this.pending.delete(id);
        reject(error);
      });
    });
  }
}

class DevtoolsWebSocket {
  private readonly pending = new Map<number, Pending>();
  private nextId = 1;

  constructor(private readonly socket: WebSocket, private readonly onEvent?: (message: DevtoolsResponse) => void) {
    socket.addEventListener("message", (event) => {
      if (typeof event.data !== "string") return;
      let response: DevtoolsResponse;
      try {
        response = JSON.parse(event.data);
      } catch {
        this.fail(new Error("Chrome devolvió un mensaje de depuración inválido"));
        return;
      }
      if (response.id === undefined) { this.onEvent?.(response); return; }
      const pending = this.pending.get(response.id);
      if (!pending) return;
      this.pending.delete(response.id);
      if (response.error) pending.reject(new Error(response.error.message));
      else pending.resolve(response.result ?? {});
    });
    socket.addEventListener("close", () => this.fail(new Error("Chrome cerró la conexión de depuración")));
    socket.addEventListener("error", () => this.fail(new Error("Error en la conexión de depuración de Chrome")));
  }

  private fail(error: Error): void {
    for (const pending of this.pending.values()) pending.reject(error);
    this.pending.clear();
  }

  send(method: string, params: Record<string, unknown> = {}, sessionId?: string): Promise<Record<string, unknown>> {
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      try {
        this.socket.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }));
      } catch (error) {
        this.pending.delete(id);
        reject(error instanceof Error ? error : new Error(String(error)));
      }
    });
  }
}

export const waitForDebuggingPort = async (
  profile: string, child: Pick<ChildProcess, "exitCode" | "signalCode">, timeoutMs: number
): Promise<string> => {
  const path = join(profile, "DevToolsActivePort");
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    let content: string | null = null;
    try {
      content = await readFile(path, "utf8");
    } catch (error) {
      if (!error || typeof error !== "object" || !("code" in error) || error.code !== "ENOENT") throw error;
    }
    if (content !== null) {
      const [portText, browserPath] = content.trim().split(/\r?\n/);
      const port = Number(portText);
      if (!Number.isInteger(port) || port < 1 || port > 65535 || !browserPath ||
        !/^\/devtools\/browser\/[a-z0-9-]+$/i.test(browserPath)) {
        throw new Error("Chrome devolvió un endpoint de depuración inválido");
      }
      return `ws://127.0.0.1:${port}${browserPath}`;
    }
    if ((child.exitCode !== null && child.exitCode !== 0) || child.signalCode !== null) {
      throw new Error(`Chrome terminó sin abrir la depuración (código ${String(child.exitCode)}, señal ${String(child.signalCode)})`);
    }
    await new Promise<void>((resolve) => setTimeout(resolve, 100));
  }
  if (child.exitCode !== null || child.signalCode !== null) {
    throw new Error(`Chrome terminó sin publicar DevToolsActivePort (código ${String(child.exitCode)}, señal ${String(child.signalCode)})`);
  }
  throw new Error(`Chrome no publicó DevToolsActivePort tras ${timeoutMs} ms`);
};

const openDebugSocket = async (url: string, timeoutMs: number): Promise<WebSocket> => {
  if (typeof WebSocket === "undefined") {
    throw new Error("La depuración de Chrome en Windows requiere Node.js 22 o posterior");
  }
  const socket = new WebSocket(url);
  try {
    await withTimeout(new Promise<void>((resolve, reject) => {
      const onOpen = (): void => { cleanup(); resolve(); };
      const onError = (): void => { cleanup(); reject(new Error("No se pudo conectar con el puerto de depuración de Chrome")); };
      const onClose = (): void => { cleanup(); reject(new Error("Chrome cerró el puerto de depuración antes de conectar")); };
      const cleanup = (): void => {
        socket.removeEventListener("open", onOpen);
        socket.removeEventListener("error", onError);
        socket.removeEventListener("close", onClose);
      };
      socket.addEventListener("open", onOpen);
      socket.addEventListener("error", onError);
      socket.addEventListener("close", onClose);
    }), timeoutMs, "conexión de Chrome con DevTools");
  } catch (error) {
    socket.close();
    throw error;
  }
  return socket;
};

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

export const buildMercaelevaCatalogScript = (maxPages: number, timeoutMs: number, delayMs: number): string => String.raw`
(async () => {
  const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  const deadline = async (condition, detail) => {
    const start = Date.now();
    while (Date.now() - start < ${timeoutMs}) {
      const result = condition();
      if (result) return result;
      await wait(200);
    }
    throw new Error('Mercaeleva: tiempo agotado al esperar ' + detail);
  };
  const links = () => [...new Set([...document.querySelectorAll('a[href]')]
    .map((anchor) => {
      try {
        const url = new URL(anchor.href);
        if (url.hostname !== 'sales.mercaeleva.com' || !/^\/(?:es|en|ca)\/for-sale\/machine\/[^/]+\/?$/i.test(url.pathname)) return null;
        url.search = '';
        url.hash = '';
        url.pathname = url.pathname.replace(/\/$/, '');
        return url.toString();
      } catch {
        return null;
      }
    })
    .filter(Boolean))];
  const readTotal = () => {
    const match = document.body?.innerText.match(/(?:Resultados?|Resultats?|Results?)\s*:\s*(\d[\d.,]*)/i);
    const value = match ? Number(match[1].replace(/[^\d]/g, '')) : 0;
    return Number.isSafeInteger(value) && value > 0 ? value : null;
  };
  const settledLinks = async (detail, seen) => {
    let previous = '';
    let stable = 0;
    return deadline(() => {
      const current = links();
      if (!current.length || (seen && !current.some((href) => !seen.has(href)))) {
        stable = 0;
        previous = '';
        return null;
      }
      const fingerprint = [...current].sort().join('\n');
      stable = fingerprint === previous ? stable + 1 : 0;
      previous = fingerprint;
      return stable >= 2 ? current : null;
    }, detail);
  };
  const controlLabel = (element) => [
    element.getAttribute('aria-label'), element.getAttribute('title'),
    element.textContent,
    ...[...element.querySelectorAll('[aria-label], [title], svg title')].map((child) =>
      child.getAttribute('aria-label') || child.getAttribute('title') || child.textContent)
  ].filter(Boolean).join(' ').replace(/\s+/g, ' ').trim().toLowerCase();
  const controls = () => [...document.querySelectorAll('button, [role="button"]')];
  const disabled = (element) => element.disabled || element.getAttribute('disabled') !== null ||
    element.getAttribute('aria-disabled') === 'true';
  const nextControl = (page) => {
    const available = controls();
    const labelled = available.find((element) =>
      /(?:next(?:\s+\w+){0,2}\s+page|next|siguiente|següent|seguent|próxima|proxima)/i.test(controlLabel(element)));
    if (labelled) return labelled;
    const numbered = available.filter((element) => /^\d{1,3}$/.test((element.textContent || '').trim()));
    if (numbered.some((element) => element.textContent.trim() === String(page))) {
      return numbered.find((element) => element.textContent.trim() === String(page + 1)) || null;
    }
    return null;
  };
  const nextPage = async (page, count, total) => {
    const started = Date.now();
    const timeout = Math.min(${timeoutMs}, 8000);
    while (Date.now() - started < timeout) {
      const button = nextControl(page);
      if (button && !disabled(button)) return button;
      await wait(200);
    }
    const available = controls().slice(-16).map((element) =>
      controlLabel(element).slice(0, 80) + (disabled(element) ? ' [deshabilitado]' : '')).join(' | ');
    throw new Error('Mercaeleva: no hay página siguiente tras la página ' + page +
      ' (' + count + '/' + total + '); ready=' + document.readyState +
      '; botones=' + (available || 'ninguno'));
  };
  const total = await deadline(readTotal, 'el contador total de resultados');
  const pages = [];
  const seen = new Set();
  let current = await settledLinks('los productos de la primera página', null);
  for (let page = 1; page <= ${maxPages}; page += 1) {
    const reportedTotal = readTotal();
    if (reportedTotal !== total) {
      throw new Error('Mercaeleva: el contador cambió durante la extracción (' + total + ' / ' + reportedTotal + ')');
    }
    pages.push(document.documentElement.outerHTML);
    for (const href of current) seen.add(href);
    console.debug("__EQUIPZILLA_MERCA_PROGRESS__", pages.length, seen.size);
    if (seen.size >= total || page === ${maxPages}) break;
    const next = await nextPage(page, seen.size, total);
    next.click();
    current = await settledLinks('referencias nuevas después de la página ' + page + ' (' + seen.size + '/' + total + ')', seen);
    if (${delayMs} > 0) await wait(${delayMs});
  }
  return { pages, expectedTotal: total };
})()
`;

export const buildMercaelevaReadinessScript = (): string => String.raw`(() => ({
  href: location.href,
  ready: document.readyState,
  title: document.title,
  count: (document.body?.innerText ?? '').match(/(?:Resultados?|Resultats?|Results?)\s*:\s*(\d[\d.,]*)/i)?.[1] ?? null,
  links: document.querySelectorAll('a[href*="/for-sale/machine/"]').length
}))()`;

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
  let lastProgressPages = 0;
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
    if (event.method !== "Runtime.consoleAPICalled" || event.params?.type !== "debug") return;
    const values = event.params.args?.map((arg) => arg.value) ?? [];
    if (values[0] !== "__EQUIPZILLA_MERCA_PROGRESS__") return;
    const pages = values[1];
    const found = values[2];
    if (typeof pages !== "number" || typeof found !== "number" || !Number.isSafeInteger(pages) ||
      !Number.isSafeInteger(found) || pages <= lastProgressPages || found < 0) return;
    onProgress?.(pages - lastProgressPages, found, "recorriendo páginas");
    lastProgressPages = pages;
  };
  child.stderr?.on("data", (chunk: Buffer) => {
    if (diagnostics.length < 3000) diagnostics += chunk.toString("utf8").slice(0, 3000 - diagnostics.length);
  });
  const commandTimeoutMs = Math.min(timeoutMs, 10000);
  const navigationTimeoutMs = Math.min(timeoutMs, 12000);
  const catalogTimeoutMs = Math.min(120000, Math.max(timeoutMs, 10000) + Math.min(maxPages, 12) * 6000);
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
    const navigation = await send("abrir listado", "Page.navigate", { url }, sessionId, navigationTimeoutMs);
    if (typeof navigation.errorText === "string") {
      throw new Error(`Chrome no pudo abrir ${url}: ${navigation.errorText}`);
    }
    const expected = new URL(url);
    const openedAt = Date.now();
    let loaded = false;
    reportStage("esperando resultados de Mercaeleva");
    while (Date.now() - openedAt < navigationTimeoutMs) {
      const state = await send("esperando resultados de Mercaeleva", "Runtime.evaluate", {
        expression: buildMercaelevaReadinessScript(), returnByValue: true
      }, sessionId);
      const result = state.result;
      const value = result && typeof result === "object" && "value" in result ? result.value : null;
      if (state.exceptionDetails) {
        throw new Error(`La página devolvió un error JavaScript: ${JSON.stringify(state.exceptionDetails).slice(0, 400)}`);
      }
      if (value && typeof value === "object" && "href" in value && typeof value.href === "string") {
        const actual = new URL(value.href);
        lastState = `url=${actual.toString()}, ready=${"ready" in value ? String(value.ready) : "?"}, ` +
          `title=${"title" in value ? String(value.title) : "?"}, ` +
          `resultados=${"count" in value ? String(value.count) : "?"}, ` +
          `enlaces=${"links" in value ? String(value.links) : "?"}`;
        if (actual.origin === expected.origin &&
          actual.pathname.replace(/\/+$/, "") === expected.pathname.replace(/\/+$/, "") &&
          "count" in value && typeof value.count === "string" &&
          "links" in value && typeof value.links === "number" && value.links > 0) {
          loaded = true;
          break;
        }
      }
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
    if (!loaded) throw new Error(`No se encontraron productos en ${url} tras ${navigationTimeoutMs} ms (${lastState})`);
    const evaluation = await send("recorrer páginas", "Runtime.evaluate", {
      expression: buildMercaelevaCatalogScript(maxPages, timeoutMs, delayMs), awaitPromise: true, returnByValue: true
    }, sessionId, catalogTimeoutMs);
    if (evaluation.exceptionDetails) {
      const details = evaluation.exceptionDetails;
      if (details && typeof details === "object" && "text" in details) {
        const description = "exception" in details && details.exception && typeof details.exception === "object"
          && "description" in details.exception ? details.exception.description : details.text;
        throw new Error(`Mercaeleva: fallo en navegación: ${String(description)}`);
      }
      throw new Error("Mercaeleva: error de navegación en el navegador");
    }
    const result = evaluation.result;
    if (!result || typeof result !== "object" || !("value" in result)) {
      throw new Error("Chrome no devolvió el catálogo de Mercaeleva");
    }
    return asCatalog(result.value);
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
