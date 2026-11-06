import assert from "node:assert/strict";
import test from "node:test";
import { collectMercaelevaPages } from "../browser-pagination.js";
import type { MercaelevaPageSend } from "../browser-pagination.js";

const categoryUrl = "https://sales.mercaeleva.com/es/for-sale";

type Page = { readonly links: readonly string[]; readonly total: number };

const simulate = (
  pages: readonly Page[],
  options?: {
    readonly onNavigate?: (url: string) => Record<string, unknown>;
    readonly onRead?: (page: number) => Record<string, unknown>;
    readonly onReadiness?: (url: string, attempt: number) => Record<string, unknown>;
    readonly navigationTimeoutMs?: number;
  }
) => {
  const visits: string[] = [];
  const progress: { readonly pages: number; readonly found: number; readonly stage: string }[] = [];
  const states: string[] = [];
  let pageUrl = categoryUrl;
  const currentPage = (): number => Number(new URL(pageUrl).searchParams.get("pageIndex") ?? "0");
  const send: MercaelevaPageSend = async (_operation, method, params) => {
    if (method === "Page.navigate") {
      const url = params.url;
      if (typeof url !== "string") throw new Error("URL de prueba inválida");
      pageUrl = url;
      visits.push(url);
      return options?.onNavigate?.(url) ?? {};
    }
    if (method === "Runtime.evaluate") {
      const index = currentPage();
      const page = pages[index];
      if (params.awaitPromise === true) return options?.onRead?.(index) ?? {
        result: { value: { pages: [(page?.links ?? []).join("|")], expectedTotal: page?.total ?? 0 } }
      };
      return options?.onReadiness?.(pageUrl, visits.length) ?? {
        result: { value: { href: pageUrl, ready: "complete", count: "Resultados", links: page?.links.length ?? 0 } }
      };
    }
    throw new Error(`Operación de prueba no prevista: ${method}`);
  };
  const run = () => collectMercaelevaPages({
    send, sessionId: "test-session", url: categoryUrl, timeoutMs: 500, maxPages: 10, delayMs: 0,
    navigationTimeoutMs: options?.navigationTimeoutMs ?? 500, commandTimeoutMs: 500,
    extractLinks: (_url, html) => html ? html.split("|") : [],
    onState: (state) => states.push(state),
    onProgress: (count, found, stage) => progress.push({ pages: count, found, stage })
  });
  return { run, visits, progress, states };
};

test("Mercaeleva: mantiene la paginación directa, el total y el progreso", async () => {
  const simulation = simulate([{ links: ["M1", "M2"], total: 3 }, { links: ["M3"], total: 3 }]);
  assert.deepEqual(await simulation.run(), { pages: ["M1|M2", "M3"], expectedTotal: 3 });
  assert.deepEqual(simulation.visits, [categoryUrl, `${categoryUrl}?pageIndex=1`]);
  assert.deepEqual(simulation.progress, [
    { pages: 1, found: 2, stage: "recorriendo páginas" },
    { pages: 1, found: 3, stage: "recorriendo páginas" }
  ]);
  assert.equal(simulation.states.length, 2);
});

test("Mercaeleva: rechaza cambios de total entre páginas", async () => {
  const simulation = simulate([{ links: ["M1"], total: 2 }, { links: ["M2"], total: 3 }]);
  await assert.rejects(simulation.run(), /el total cambió en la página 2 \(2\/3\)/);
});

test("Mercaeleva: rechaza la repetición de referencias y el crecimiento del tamaño de página", async () => {
  const repeated = simulate([{ links: ["M1", "M2"], total: 4 }, { links: ["M2", "M3"], total: 4 }]);
  await assert.rejects(repeated.run(), /repite referencias de páginas anteriores/);
  const growing = simulate([{ links: ["M1"], total: 4 }, { links: ["M2", "M3"], total: 4 }]);
  await assert.rejects(growing.run(), /tamaño de página inesperado/);
});

test("Mercaeleva: mantiene las validaciones de navegación y respuesta", async () => {
  const badNavigation = simulate([{ links: ["M1"], total: 1 }], { onNavigate: () => ({ errorText: "denied" }) });
  await assert.rejects(badNavigation.run(), /Chrome no pudo abrir .*denied/);
  const invalidResult = simulate([{ links: ["M1"], total: 1 }], { onRead: () => ({ result: { value: { pages: [], expectedTotal: 0 } } }) });
  await assert.rejects(invalidResult.run(), /respuesta de navegación inválida/);
  const emptyHtml = simulate([{ links: ["M1"], total: 1 }], { onRead: () => ({ result: { value: { pages: [""], expectedTotal: 1 } } }) });
  await assert.rejects(emptyHtml.run(), /página 1 sin HTML/);
});

test("Mercaeleva: preserva el error de evaluación JavaScript", async () => {
  const sim = simulate([{ links: ["M1"], total: 1 }], { onRead: () => ({ exceptionDetails: { text: "boom" } }) });
  await assert.rejects(sim.run(), /no se pudo leer la página 1/);
});

test("Mercaeleva: reintenta una navegación que no coincide con la URL esperada", async () => {
  const simulation = simulate([{ links: ["M1"], total: 1 }], {
    navigationTimeoutMs: 5,
    onReadiness: (url, attempt) => ({ result: { value: {
      href: attempt === 1 ? `${categoryUrl}/incorrecta` : url,
      ready: "complete", count: "Resultados", links: 1
    } } })
  });
  assert.deepEqual(await simulation.run(), { pages: ["M1"], expectedTotal: 1 });
  assert.equal(simulation.visits.length, 2);
});

test("Mercaeleva: limita a dos los intentos de una página que nunca queda lista", async () => {
  const simulation = simulate([{ links: ["M1"], total: 1 }], {
    navigationTimeoutMs: 5,
    onReadiness: () => ({ result: { value: {
      href: `${categoryUrl}/incorrecta`, ready: "complete", count: "Resultados", links: 1
    } } })
  });
  await assert.rejects(simulation.run(), /página 1 sin productos tras navegación directa/);
  assert.equal(simulation.visits.length, 2);
});
