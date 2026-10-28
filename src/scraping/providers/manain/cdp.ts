import type { ScrapeOptions } from "../../../contracts/scraping.js";
import { DevtoolsWebSocket, openDebugSocket, withTimeout } from "../../../infrastructure/browser/devtools.js";
import { buildManainListingScript, MANAIN_LISTING_PROGRESS_BINDING } from "./listing-script.js";
import type { DevtoolsResponse } from "../../../infrastructure/browser/devtools.js";
import { normalizeManainSaleProductUrl, parseManainListingResult } from "./listing.js";
import type { ManainListingResult } from "./listing.js";

type BrowserTarget = {
  readonly id: string;
  readonly type: "page";
  readonly url: string;
  readonly webSocketDebuggerUrl: string;
};

type PageState = {
  readonly url: string;
  readonly ready: boolean;
  readonly hasSku: boolean;
  readonly challenge: boolean;
};

let managedCdpPort: number | null = null;
let selectedTarget: { readonly port: number; readonly id: string } | null = null;
let pendingRead: Promise<void> = Promise.resolve();

export const setManagedManainCdpPort = (port: number | null): void => {
  managedCdpPort = port;
};

export const manainCdpPort = (): number | null => {
  const raw = process.env.MANAIN_CDP_PORT;
  if (raw === undefined || raw === "") return managedCdpPort;
  const port = Number(raw);
  if (!/^\d+$/.test(raw) || !Number.isSafeInteger(port) || port < 1024 || port > 65535) {
    throw new Error("MANAIN_CDP_PORT debe indicar un puerto local válido entre 1024 y 65535");
  }
  return port;
};

const isManainCatalog = (value: string): boolean => {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && ["manain.com", "www.manain.com"].includes(url.hostname.toLowerCase()) &&
      url.pathname === "/catalogo/venta/";
  } catch {
    return false;
  }
};

const isManainChallenge = (value: string): boolean => {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && ["manain.com", "www.manain.com"].includes(url.hostname.toLowerCase()) &&
      /^\/cdn-cgi\/(?:challenge-platform|challenge)(?:\/|$)/.test(url.pathname);
  } catch {
    return false;
  }
};

export const classifyManainCatalogState = (state: PageState): "ready" | "challenge" | "loading" | "unexpected" => {
  if (state.challenge || isManainChallenge(state.url)) return "challenge";
  if (state.url === "about:blank") return "loading";
  if (isManainCatalog(state.url)) return state.ready ? "ready" : "loading";
  return state.ready ? "unexpected" : "loading";
};

const describePageLocation = (value: string): string => {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:" ? `${url.origin}${url.pathname}` : url.href;
  } catch {
    return "dirección desconocida";
  }
};

export const parseManainListingProgressEvent = (event: DevtoolsResponse): { readonly pages: number; readonly found: number } | null => {
  if (event.method !== "Runtime.bindingCalled" || event.params?.name !== MANAIN_LISTING_PROGRESS_BINDING ||
    typeof event.params.payload !== "string") return null;
  let payload: unknown;
  try { payload = JSON.parse(event.params.payload); } catch { return null; }
  if (!payload || typeof payload !== "object" ||
    !("pages" in payload) || typeof payload.pages !== "number" || !Number.isSafeInteger(payload.pages) || payload.pages < 1 ||
    !("found" in payload) || typeof payload.found !== "number" || !Number.isSafeInteger(payload.found) || payload.found < 1) {
    return null;
  }
  return { pages: payload.pages, found: payload.found };
};

export const selectManainTarget = (value: unknown, port: number, id?: string): BrowserTarget => {
  if (!Array.isArray(value)) throw new Error("Chrome devolvió un listado CDP inválido");
  const targets: BrowserTarget[] = [];
  for (const candidate of value) {
    if (!candidate || typeof candidate !== "object" ||
      !("id" in candidate) || typeof candidate.id !== "string" ||
      !("type" in candidate) || candidate.type !== "page" ||
      !("url" in candidate) || typeof candidate.url !== "string" ||
      !("webSocketDebuggerUrl" in candidate) || typeof candidate.webSocketDebuggerUrl !== "string") continue;
    let ws: URL;
    try { ws = new URL(candidate.webSocketDebuggerUrl); } catch { continue; }
    if (ws.protocol !== "ws:" || ws.hostname !== "127.0.0.1" || Number(ws.port) !== port ||
      !ws.pathname.startsWith("/devtools/page/")) continue;
    targets.push({ id: candidate.id, type: "page", url: candidate.url, webSocketDebuggerUrl: candidate.webSocketDebuggerUrl });
  }
  const match = id ? targets.find((target) => target.id === id) :
    targets.find((target) => isManainCatalog(target.url) || isManainChallenge(target.url));
  if (!match || (id && !isManainCatalog(match.url) && normalizeManainSaleProductUrl(match.url, "https://manain.com/") === null)) {
    throw new Error(id ? "La pestaña CDP de Manain se cerró o cambió de sitio" :
      "Abre el catálogo de venta de Manain en Chrome visible y completa manualmente cualquier verificación antes de extraer");
  }
  return match;
};

const getTarget = async (port: number, timeoutMs: number, id?: string): Promise<BrowserTarget> => {
  const response = await withTimeout(fetch(`http://127.0.0.1:${port}/json/list`), timeoutMs, "listado CDP de Chrome");
  if (!response.ok) throw new Error(`Chrome CDP respondió HTTP ${response.status}`);
  const data: unknown = await withTimeout(response.json(), timeoutMs, "pestañas CDP de Chrome");
  return selectManainTarget(data, port, id);
};

const resultValue = (response: Record<string, unknown>, detail: string): unknown => {
  if (response.exceptionDetails) throw new Error(`${detail}: Chrome produjo una excepción de JavaScript`);
  const result = response.result;
  if (!result || typeof result !== "object" || !("value" in result)) {
    throw new Error(`${detail}: Chrome no devolvió un valor`);
  }
  return result.value;
};

const pageStateExpression = `(() => ({
  url: location.href,
  ready: document.readyState === 'complete',
  hasSku: !!document.querySelector('.product_meta .sku'),
  challenge: /just a moment|un momento/i.test(document.title) ||
    !!document.querySelector('.cf-turnstile, #challenge-running, #challenge-form, iframe[src*="challenges.cloudflare.com"]')
}))()`;

export const parseManainPageState = (value: unknown): PageState => {
  if (!value || typeof value !== "object" ||
    !("url" in value) || typeof value.url !== "string" ||
    !("ready" in value) || typeof value.ready !== "boolean" ||
    !("hasSku" in value) || typeof value.hasSku !== "boolean" ||
    !("challenge" in value) || typeof value.challenge !== "boolean") {
    throw new Error("Manain: estado de ficha inválido desde Chrome");
  }
  return { url: value.url, ready: value.ready, hasSku: value.hasSku, challenge: value.challenge };
};

const withPage = async <T>(
  target: BrowserTarget, timeoutMs: number, action: (send: (
    method: string, params?: Record<string, unknown>, durationMs?: number
  ) => Promise<Record<string, unknown>>) => Promise<T>,
  onEvent?: (event: DevtoolsResponse) => void
): Promise<T> => {
  const socket = await openDebugSocket(target.webSocketDebuggerUrl, timeoutMs);
  const devtools = new DevtoolsWebSocket(socket, onEvent);
  const send = (method: string, params: Record<string, unknown> = {}, durationMs = timeoutMs) =>
    withTimeout(devtools.send(method, params), durationMs, `Manain CDP: ${method}`);
  try {
    return await action(send);
  } finally {
    socket.close();
  }
};

export const discoverManainViaCdp = async (
  port: number, options: ScrapeOptions,
  onProgress?: (pages: number, found: number, stage?: string) => void
): Promise<ManainListingResult> => {
  const timeoutMs = Math.max(options.timeoutMs, 1000);
  const target = await getTarget(port, timeoutMs);
  selectedTarget = { port, id: target.id };
  const listing = await withPage(target, timeoutMs, async (send) => {
    const state = parseManainPageState(resultValue(await send("Runtime.evaluate", {
      expression: pageStateExpression, returnByValue: true
    }), "estado del catálogo"));
    const deadline = Date.now() + 120000;
    let current = state;
    while (true) {
      const status = classifyManainCatalogState(current);
      if (status === "ready") break;
      if (status === "unexpected") {
        throw new Error(`La pestaña no muestra el catálogo de venta de Manain (${describePageLocation(current.url)})`);
      }
      if (Date.now() >= deadline) {
        throw new Error(status === "challenge"
          ? "Manain sigue mostrando una verificación humana sin completar; comprueba el acceso manual en Chrome"
          : current.url === "about:blank"
            ? "Manain: la pestaña sigue en about:blank; el catálogo no se ha cargado en Chrome"
            : "Manain: el catálogo de venta no terminó de cargar en Chrome");
      }
      await new Promise<void>((resolve) => setTimeout(resolve, 1000));
      current = parseManainPageState(resultValue(await send("Runtime.evaluate", {
        expression: pageStateExpression, returnByValue: true
      }), "estado de verificación"));
    }
    if (onProgress) {
      await send("Runtime.enable");
      await send("Runtime.addBinding", { name: MANAIN_LISTING_PROGRESS_BINDING });
    }
    const duration = Math.min(900000, timeoutMs * options.maxPages + 30000);
    const evaluation = await send("Runtime.evaluate", {
      expression: buildManainListingScript(options.maxPages, options.timeoutMs, options.delayMs),
      returnByValue: true, awaitPromise: true
    }, duration);
    return parseManainListingResult(resultValue(evaluation, "descubrimiento"));
  }, (event) => {
    const progress = parseManainListingProgressEvent(event);
    if (progress) onProgress?.(progress.pages, progress.found, "paginación");
  });
  onProgress?.(listing.pagesVisited, listing.urls.length, "catálogo obtenido desde Chrome CDP");
  return listing;
};

const readProduct = async (url: string, options: ScrapeOptions): Promise<string> => {
  const normalized = normalizeManainSaleProductUrl(url, "https://manain.com/");
  if (!normalized || normalized !== url) throw new Error(`Manain: URL de ficha inválida: ${url}`);
  const port = manainCdpPort();
  if (port === null || !selectedTarget || selectedTarget.port !== port) {
    throw new Error("Manain: primero hay que descubrir el catálogo en la sesión CDP de Chrome");
  }
  const timeoutMs = Math.max(options.timeoutMs, 1000);
  const target = await getTarget(port, timeoutMs, selectedTarget.id);
  return withPage(target, timeoutMs, async (send) => {
    await send("Page.enable");
    await send("Runtime.enable");
    const navigation = await send("Page.navigate", { url: normalized });
    if (typeof navigation.errorText === "string") throw new Error(`Manain: navegación fallida: ${navigation.errorText}`);
    const deadline = Date.now() + timeoutMs;
    let challengeObserved = false;
    while (Date.now() < deadline) {
      const snapshot = parseManainPageState(resultValue(await send("Runtime.evaluate", {
        expression: pageStateExpression, returnByValue: true
      }), "estado de ficha"));
      if (snapshot.challenge) challengeObserved = true;
      if (!snapshot.challenge && snapshot.url === normalized && snapshot.ready && snapshot.hasSku) {
        const html = resultValue(await send("Runtime.evaluate", {
          expression: "document.documentElement.outerHTML", returnByValue: true
        }), "HTML de ficha");
        if (typeof html !== "string" || !html.includes("product_meta")) {
          throw new Error("Manain: HTML de ficha incompleto");
        }
        return html;
      }
      await new Promise<void>((resolve) => setTimeout(resolve, 350));
    }
    throw new Error(challengeObserved
      ? "Manain sigue mostrando una verificación humana; complétala manualmente en Chrome"
      : `Manain: no se pudo acreditar la carga de la ficha: ${normalized}`);
  });
};

export const loadManainProductViaCdp = (url: string, options: ScrapeOptions): Promise<string> => {
  const pending = pendingRead.then(async () => {
    if (options.delayMs > 0) await new Promise<void>((resolve) => setTimeout(resolve, options.delayMs));
    return readProduct(url, options);
  });
  pendingRead = pending.then(() => undefined, () => undefined);
  return pending;
};
