import { buildMercaelevaCatalogScript, buildMercaelevaReadinessScript } from "./listing-script.js";
import { buildMercaelevaPageUrl } from "./page-url.js";

export type MercaelevaPageSend = (
  operation: string, method: string, params: Record<string, unknown>, sessionId: string,
  deadlineMs?: number
) => Promise<Record<string, unknown>>;

type MercaelevaPagination = {
  readonly send: MercaelevaPageSend;
  readonly sessionId: string;
  readonly url: string;
  readonly timeoutMs: number;
  readonly maxPages: number;
  readonly delayMs: number;
  readonly navigationTimeoutMs: number;
  readonly commandTimeoutMs: number;
  readonly extractLinks: (pageUrl: string, html: string) => readonly string[];
  readonly onState: (state: string) => void;
  readonly onProgress: ((pages: number, found: number, stage: string) => void) | undefined;
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

export const collectMercaelevaPages = async ({
  send, sessionId, url, timeoutMs, maxPages, delayMs, navigationTimeoutMs, commandTimeoutMs,
  extractLinks, onState, onProgress
}: MercaelevaPagination): Promise<{ readonly pages: readonly string[]; readonly expectedTotal: number }> => {
  let lastState = "sin respuesta de la web";
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
            onState(lastState);
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
    const links = extractLinks(pageUrl, html);
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
};
