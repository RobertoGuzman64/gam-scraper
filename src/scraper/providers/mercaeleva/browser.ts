import { spawn, type ChildProcess } from "node:child_process";
import { Readable, Writable } from "node:stream";
import { existsSync } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

type DevtoolsResponse = {
  readonly id?: number;
  readonly result?: Record<string, unknown>;
  readonly error?: { readonly message: string };
  readonly sessionId?: string;
};

type Pending = {
  readonly resolve: (value: Record<string, unknown>) => void;
  readonly reject: (reason: Error) => void;
};

class DevtoolsPipe {
  private readonly pending = new Map<number, Pending>();
  private nextId = 1;
  private buffer = "";

  constructor(private readonly child: ChildProcess, private readonly input: Writable, output: Readable) {
    output.setEncoding("utf8");
    output.on("data", (chunk: string) => {
      this.buffer += chunk;
      const frames = this.buffer.split("\0");
      this.buffer = frames.pop() ?? "";
      for (const frame of frames) {
        if (!frame) continue;
        const response: DevtoolsResponse = JSON.parse(frame);
        if (response.id === undefined) continue;
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
    .map((a) => a.href)
    .filter((href) => /^\/(?:es|en)\/for-sale\/machine\//i.test(new URL(href).pathname)))];
  const total = await deadline(() => {
    const match = document.body?.innerText.match(/Resultados?\s*:\s*(\d[\d.,]*)/i);
    const value = match ? Number(match[1].replace(/[^\d]/g, '')) : 0;
    return Number.isSafeInteger(value) && value > 0 ? value : null;
  }, 'el contador total de resultados');
  await deadline(() => links().length > 0, 'los productos de la primera página');
  const pages = [];
  const seen = new Set();
  for (let page = 1; page <= ${maxPages}; page += 1) {
    const current = links();
    if (current.length === 0) throw new Error('Mercaeleva: página vacía ' + page);
    pages.push(document.documentElement.outerHTML);
    for (const href of current) seen.add(href);
    if (seen.size >= total) break;
    const next = [...document.querySelectorAll('button')].find((button) => {
      const label = (button.getAttribute('aria-label') || button.title || '').toLowerCase();
      return /next page|página siguiente|pagina siguiente|pàgina següent|página próxima|siguiente/.test(label);
    });
    if (!next || next.disabled || next.getAttribute('aria-disabled') === 'true') {
      throw new Error('Mercaeleva: no hay página siguiente tras la página ' + page + ' (' + seen.size + '/' + total + ')');
    }
    next.click();
    await deadline(() => {
      const incoming = links();
      return incoming.length > 0 && incoming.some((href) => !seen.has(href));
    }, 'una página nueva después de la ' + page);
    if (${delayMs} > 0) await wait(${delayMs});
  }
  return { pages, expectedTotal: total };
})()
`;

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
  executable: string, profile: string, url: string, timeoutMs: number, maxPages: number, delayMs: number
): Promise<{ readonly pages: readonly string[]; readonly expectedTotal: number }> => {
  const flags = [
    "--headless", "--disable-gpu", "--disable-extensions", "--no-first-run", "--no-default-browser-check",
    "--disable-dev-shm-usage", "--window-size=1600,2400", "--remote-debugging-pipe", `--user-data-dir=${profile}`, "about:blank"
  ];
  if (process.platform === "linux" && process.getuid?.() === 0) flags.unshift("--no-sandbox");
  const child = spawn(executable, flags, { stdio: ["ignore", "ignore", "pipe", "pipe", "pipe"] });
  let diagnostics = "";
  child.stderr?.on("data", (chunk: Buffer) => {
    if (diagnostics.length < 3000) diagnostics += chunk.toString("utf8").slice(0, 3000 - diagnostics.length);
  });
  const input = child.stdio[3];
  const output = child.stdio[4];
  if (!(input instanceof Writable) || !(output instanceof Readable)) {
    child.kill();
    throw new Error("Chrome no abrió los canales de depuración");
  }
  const devtools = new DevtoolsPipe(child, input, output);
  const timer = setTimeout(() => child.kill(), Math.max(timeoutMs, 20000) * (maxPages + 1));
  try {
    await new Promise<void>((resolve, reject) => {
      if (child.pid) { resolve(); return; }
      child.once("spawn", () => resolve());
      child.once("error", reject);
    });
    const target = await devtools.send("Target.createTarget", { url: "about:blank" });
    if (typeof target.targetId !== "string") throw new Error("Chrome no creó la pestaña de catálogo");
    const attached = await devtools.send("Target.attachToTarget", { targetId: target.targetId, flatten: true });
    if (typeof attached.sessionId !== "string") throw new Error("Chrome no abrió una sesión de catálogo");
    const sessionId = attached.sessionId;
    await devtools.send("Page.enable", {}, sessionId);
    await devtools.send("Runtime.enable", {}, sessionId);
    const navigation = await devtools.send("Page.navigate", { url }, sessionId);
    if (typeof navigation.errorText === "string") {
      throw new Error(`Chrome no pudo abrir ${url}: ${navigation.errorText}`);
    }
    let loaded = false;
    for (let attempt = 0; attempt < Math.ceil(timeoutMs / 200); attempt += 1) {
      const state = await devtools.send("Runtime.evaluate", {
        expression: "location.href + '|' + document.readyState", returnByValue: true
      }, sessionId);
      const result = state.result;
      const value = result && typeof result === "object" && "value" in result ? result.value : null;
      if (typeof value === "string" && value.endsWith("|complete")) {
        const actual = new URL(value.slice(0, value.lastIndexOf("|")));
        const expected = new URL(url);
        if (actual.origin === expected.origin && actual.pathname.replace(/\/+$/, "") === expected.pathname.replace(/\/+$/, "")) {
          loaded = true;
          break;
        }
      }
      await new Promise((resolve) => setTimeout(resolve, 200));
    }
    if (!loaded) throw new Error(`Mercaeleva no terminó de abrir ${url}`);
    const evaluation = await devtools.send("Runtime.evaluate", {
      expression: buildMercaelevaCatalogScript(maxPages, timeoutMs, delayMs), awaitPromise: true, returnByValue: true
    }, sessionId);
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
    throw new Error(`Navegador ${executable}: ${String(error)}${detail ? `; stderr: ${detail}` : ""}`);
  } finally {
    clearTimeout(timer);
    if (child.exitCode === null && child.signalCode === null) {
      const exit = new Promise<void>((resolve) => child.once("exit", () => resolve()));
      child.kill();
      await Promise.race([exit, new Promise<void>((resolve) => setTimeout(resolve, 2000))]);
    }
  }
};

export const renderMercaelevaCatalog = async (
  url: string, timeoutMs: number, maxPages: number, delayMs: number
): Promise<{ readonly pages: readonly string[]; readonly expectedTotal: number }> => {
  const failures: string[] = [];
  for (const executable of candidateBrowsers()) {
    if ((executable.includes("/") || executable.includes("\\")) && !existsSync(executable)) continue;
    const profile = await mkdtemp(join(tmpdir(), "mercaeleva-chrome-"));
    try {
      return await renderWithBrowser(executable, profile, url, timeoutMs, maxPages, delayMs);
    } catch (error) {
      const message = String(error);
      failures.push(message);
      if (!/Chrome finalizó durante la navegación|Chrome no abrió|Chrome no creó|spawn |EPIPE|ECONNRESET|ENOENT/i.test(message)) {
        throw error;
      }
    } finally {
      await rm(profile, { recursive: true, force: true, maxRetries: 10, retryDelay: 150 });
    }
  }
  throw new Error(`No se pudo iniciar Chrome/Edge para Mercaeleva. Configura CHROME_PATH. ${failures.join(" | ")}`);
};
