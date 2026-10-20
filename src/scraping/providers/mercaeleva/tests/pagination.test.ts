import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { runInNewContext } from "node:vm";
import { writeOutputs } from "../../../../pipeline/publication/publish.js";
import { assessCatalogQuality } from "../../../../catalog/quality.js";
import { scrapeCategory } from "../../../engine/scrape-category.js";
import { buildMercaelevaCatalogScript, buildMercaelevaReadinessScript } from "../browser.js";
import { extractMercaelevaLinks } from "../parsers.js";
import type { ScraperProvider } from "../../../provider.js";
import type { CategoryConfig, ScrapeOptions } from "../../../../contracts/scraping.js";

import type { ProductRecord } from "../../../../contracts/catalog.js";

const category: CategoryConfig = { key: "venta", name: "Maquinaria en venta", url: "https://sales.mercaeleva.com/es/for-sale" };
const options: ScrapeOptions = {
  outDir: "", outPrefix: "test", maxPages: 12, stallStopAfter: 2,
  concurrencyPages: 1, concurrencyProducts: 1, timeoutMs: 1000, delayMs: 0, userAgent: "test"
};
const baseUrl = "https://sales.mercaeleva.com/es/for-sale/machine/";
const product = (id: string): ProductRecord => ({
  providerId: "mercaeleva", categoryKey: category.key, categoryName: category.name,
  url: `${baseUrl}${id}`, reference: id, title: `Máquina ${id}`, shortDescription: "Máquina usada",
  longDescription: "Máquina usada", price: "1000", brand: "JLG", model: "450 AJ", year: "2015",
  location: null, country: null, horometer: null, serialNumber: null, image: `${baseUrl}${id}.jpg`
});

const providerFor = (ids: readonly string[], expectedTotal: number): ScraperProvider => ({
  id: "mercaeleva", categories: [category], defaultOptions: options,
  buildPagedUrl: (url) => url, extractProductLinksFromListing: () => [],
  parseProductPage: (_html, url) => ({ ...product(url.slice(baseUrl.length)) }),
  extractReference: (url) => url.slice(baseUrl.length),
  discoverCategoryTree: async () => [category],
  discoverListing: async () => ({ urls: ids.map((id) => `${baseUrl}${id}`), expectedTotal })
});

const withFetch = async (operation: () => Promise<void>): Promise<void> => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response("<html></html>", { status: 200 });
  try { await operation(); } finally { globalThis.fetch = originalFetch; }
};

test("Mercaeleva: no publica un catálogo de 20 referencias si anuncia 221", async () => {
  await withFetch(async () => {
    const ids = Array.from({ length: 20 }, (_, i) => `M${i}`);
    const result = await scrapeCategory(category, options, providerFor(ids, 221));
    assert.equal(result.discoveredProductUrls, 20);
    assert.equal(result.expectedProductUrls, 221);
    assert.equal(result.products.length, 20);
    assert.match(result.failures[0]?.error ?? "", /20 de 221/);
    const quality = assessCatalogQuality([result], result.products, null);
    assert.equal(quality.status, "partial");
    assert.equal(quality.published, false);
    assert.ok(quality.reasons.some((reason) => reason.includes("20 de 221")));
  });
});

test("Mercaeleva: una extracción completa publica y una repetida conserva el CSV anterior", async () => {
  await withFetch(async () => {
    const dir = await mkdtemp(join(tmpdir(), "merca-pagination-"));
    try {
      const complete = await scrapeCategory(category, options, providerFor(["M1", "M2", "M3"], 3));
      assert.deepEqual(complete.failures, []);
      assert.equal(assessCatalogQuality([complete], complete.products, null).status, "complete");
      await writeOutputs(dir, "catalogo", [complete], "2026-10-20T10:00:00Z", "2026-10-20T10:01:00Z");
      const csv = await readFile(join(dir, "catalogo-all.csv"), "utf8");
      const incomplete = await scrapeCategory(category, options, providerFor(["M1", "M2"], 3));
      await assert.rejects(
        writeOutputs(dir, "catalogo", [incomplete], "2026-10-20T10:02:00Z", "2026-10-20T10:03:00Z"),
        /Extracción partial/
      );
      assert.equal(await readFile(join(dir, "catalogo-all.csv"), "utf8"), csv);
      const summary: unknown = JSON.parse(await readFile(join(dir, "catalogo-summary.json"), "utf8"));
      assert.ok(summary && typeof summary === "object" && "categories" in summary && Array.isArray(summary.categories));
      assert.equal(summary.categories[0]?.expectedProductUrls, 3);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});

type PageFixture = {
  readonly body: { readonly innerText: string };
  readonly documentElement: { readonly outerHTML: string };
  querySelectorAll(selector: string): readonly {
    readonly href?: string;
    readonly disabled?: boolean;
    readonly textContent?: string;
    getAttribute?(name: string): string | null;
    querySelectorAll?(selector: string): readonly { readonly textContent?: string; getAttribute(name: string): string | null }[];
    click?(): void;
  }[];
};

type SimulationOptions = {
  readonly totals?: readonly number[];
  readonly delayedNextMs?: number;
  readonly delayedPaginationMs?: number;
  readonly nextButtonTextOnly?: boolean;
  readonly numericPagination?: boolean;
  readonly disabledNextOnPage?: number;
  readonly disabledNumberOnPage?: number;
  readonly stallsOnSequentialLastPage?: boolean;
  readonly stallsOnDirectLastPage?: boolean;
  readonly pageSizeOptions?: readonly number[];
  readonly onNext?: () => void;
  readonly onProgress?: (pages: number, found: number) => void;
};

const simulateCatalog = async (
  pages: readonly (readonly string[])[], announced: number, maxPages = 10, simulation?: SimulationOptions
): Promise<unknown> => {
  let current = 0;
  const initialSize = pages[0]?.length ?? 0;
  const allIds = pages.flat();
  let pageSize = initialSize;
  const visiblePages = (): readonly (readonly string[])[] => simulation?.pageSizeOptions && pageSize > initialSize
    ? Array.from({ length: Math.ceil(allIds.length / pageSize) }, (_, index) =>
      allIds.slice(index * pageSize, (index + 1) * pageSize)) : pages;
  const paginationAvailableAt = Date.now() + (simulation?.delayedPaginationMs ?? 0);
  const advance = (): void => {
    simulation?.onNext?.();
    if (simulation?.delayedNextMs) setTimeout(() => { current += 1; }, simulation.delayedNextMs);
    else current += 1;
  };
  const goTo = (page: number): void => {
    simulation?.onNext?.();
    if (simulation?.stallsOnSequentialLastPage && current === 10 && page === 12) return;
    if (simulation?.stallsOnDirectLastPage && current === 0 && page === 12) return;
    current = page - 1;
  };
  const button = (label: string, text: string, disabled: boolean, click: () => void) => ({
    disabled,
    textContent: text,
    getAttribute: (key: string) => key === "aria-label" ? label || null : null,
    querySelectorAll: () => [],
    click
  });
  const document: PageFixture = {
    body: { get innerText() { return `Resultados: ${simulation?.totals?.[current] ?? announced}`; } },
    documentElement: { get outerHTML() { return `<html data-page="${current + 1}"></html>`; } },
    querySelectorAll(selector) {
      if (selector === "a[href]") return (visiblePages()[current] ?? []).map((id) =>
        ({ href: id.startsWith("https://") ? id : `${baseUrl}${id}` }));
      if (selector === 'select, [role="combobox"], button[aria-haspopup="listbox"]' && simulation?.pageSizeOptions) {
        return [{
          tagName: "SELECT",
          get value() { return String(pageSize); },
          set value(value: string) { pageSize = Number(value); current = 0; },
          options: simulation.pageSizeOptions.map((size) => ({ textContent: String(size), value: String(size) })),
          textContent: "", getAttribute: (name: string) => name === "aria-label" ? "Elementos por página" : null,
          querySelectorAll: () => [],
          dispatchEvent: () => {}
        }];
      }
      if (selector === 'button, [role="button"]') {
        if (Date.now() < paginationAvailableAt) return [];
        if (simulation?.numericPagination) {
          const page = current + 1;
          return [
            ...(simulation.disabledNextOnPage === page ? [button("Next page", "", true, advance)] : []),
            ...(simulation.stallsOnSequentialLastPage && page > 1 ? [button("", "1", false, () => goTo(1))] : []),
            button("", String(page), false, () => {}),
            button("", String(page + 1), simulation.disabledNumberOnPage === page, () => goTo(page + 1)),
            ...(simulation.stallsOnSequentialLastPage && page === 1 ? [button("", "12", false, () => goTo(12))] : [])
          ];
        }
        return [button(simulation?.nextButtonTextOnly ? "" : "Next page",
          simulation?.nextButtonTextOnly ? "Next page" : "", current >= visiblePages().length - 1, advance)];
      }
      return [];
    }
  };
  return runInNewContext(buildMercaelevaCatalogScript(maxPages, 1000, 0), {
    document, URL, Event: class { constructor(readonly type: string) {} }, setTimeout: (callback: () => void) => setTimeout(callback, 1),
    console: { debug: (tag: string, pages: number, found: number) => {
      if (tag === "__EQUIPZILLA_MERCA_PROGRESS__") simulation?.onProgress?.(pages, found);
    } }
  });
};

test("Mercaeleva: recorre primera, intermedia y última página mediante botones", async () => {
  const result = await simulateCatalog([["M1", "M2"], ["M3", "M4"], ["M5"]], 5);
  assert.deepEqual(JSON.parse(JSON.stringify(result)), {
    pages: ["<html data-page=\"1\"></html>", "<html data-page=\"2\"></html>", "<html data-page=\"3\"></html>"],
    expectedTotal: 5
  });
});

test("Mercaeleva: informa cada página antes de completar el catálogo", async () => {
  const progress: { pages: number; found: number }[] = [];
  const result = await simulateCatalog([["M1", "M2"], ["M3", "M4"], ["M5"]], 5, 12, {
    onProgress: (pages, found) => progress.push({ pages, found })
  });
  assert.ok(result);
  assert.deepEqual(progress, [
    { pages: 1, found: 2 }, { pages: 2, found: 4 }, { pages: 3, found: 5 }
  ]);
});

test("Mercaeleva: encuentra el botón de paginación aunque se renderice después de los productos", async () => {
  const result = await simulateCatalog([["M1", "M2"], ["M3", "M4"]], 4, 2, {
    delayedPaginationMs: 25
  });
  assert.ok(result && typeof result === "object" && "pages" in result && Array.isArray(result.pages));
  assert.equal(result.pages.length, 2);
});

test("Mercaeleva: reconoce Next page como texto del botón sin aria-label", async () => {
  const result = await simulateCatalog([["M1", "M2"], ["M3", "M4"]], 4, 2, {
    nextButtonTextOnly: true
  });
  assert.ok(result && typeof result === "object" && "pages" in result && Array.isArray(result.pages));
  assert.equal(result.pages.length, 2);
});

test("Mercaeleva: puede avanzar usando botones numéricos de paginación", async () => {
  const result = await simulateCatalog([["M1", "M2"], ["M3", "M4"]], 4, 2, {
    numericPagination: true
  });
  assert.ok(result && typeof result === "object" && "pages" in result && Array.isArray(result.pages));
  assert.equal(result.pages.length, 2);
});

test("Mercaeleva: pasa de la página 11 a la 12 si Next page está deshabilitado pero el 12 está disponible", async () => {
  const pages = Array.from({ length: 12 }, (_, index) => {
    const first = index < 10 ? index * 20 + 1 : index === 10 ? 201 : 202;
    return Array.from({ length: index === 10 ? 1 : 20 }, (_, offset) => `M${first + offset}`);
  });
  const progress: { pages: number; found: number }[] = [];
  let clicks = 0;
  const result = await simulateCatalog(pages, 221, 12, {
    numericPagination: true,
    disabledNextOnPage: 11,
    onNext: () => { clicks += 1; },
    onProgress: (count, found) => progress.push({ pages: count, found })
  });
  assert.ok(result && typeof result === "object" && "pages" in result && Array.isArray(result.pages));
  assert.equal(result.pages.length, 12);
  assert.equal(clicks, 11);
  assert.deepEqual(progress[10], { pages: 11, found: 201 });
  assert.deepEqual(progress[11], { pages: 12, found: 221 });
});

test("Mercaeleva: no pulsa un botón deshabilitado ni simula cobertura si la página siguiente no es accesible", async () => {
  let clicks = 0;
  await assert.rejects(simulateCatalog([["M1", "M2"], ["M3", "M4"]], 4, 10, {
    numericPagination: true,
    disabledNextOnPage: 1,
    disabledNumberOnPage: 1,
    onNext: () => { clicks += 1; }
  }), /no hay página siguiente/);
  assert.equal(clicks, 0);
});

test("Mercaeleva: detecta página repetida y paginación sin botón siguiente", async () => {
  await assert.rejects(simulateCatalog([["M1", "M2"], ["M1", "M2"]], 5, 2), /no hay página siguiente|tiempo agotado/);
  await assert.rejects(simulateCatalog([["M1", "M2"]], 5, 2), /no hay página siguiente/);
});

test("Mercaeleva: al llegar al límite de páginas no confunde la cobertura incompleta con una extracción completa", async () => {
  const result: unknown = await simulateCatalog([["M1", "M2"], ["M3", "M4"], ["M5"]], 5, 2);
  assert.ok(result && typeof result === "object" && "pages" in result && Array.isArray(result.pages));
  assert.equal(result.pages.length, 2);
});


test("Mercaeleva: espera el cambio real de enlaces tras una transición asíncrona", async () => {
  const result = await simulateCatalog([["M1", "M2"], ["M3", "M4"]], 4, 10, { delayedNextMs: 20 });
  assert.deepEqual(JSON.parse(JSON.stringify(result)), {
    pages: ["<html data-page=\"1\"></html>", "<html data-page=\"2\"></html>"],
    expectedTotal: 4
  });
});

test("Mercaeleva: no avanza más allá del máximo de páginas", async () => {
  let clicks = 0;
  const result = await simulateCatalog([["M1", "M2"], ["M3", "M4"]], 4, 1, {
    onNext: () => { clicks += 1; }
  });
  assert.equal(clicks, 0);
  assert.ok(result && typeof result === "object" && "pages" in result && Array.isArray(result.pages));
  assert.equal(result.pages.length, 1);
});

test("Mercaeleva: detecta cambios del total mientras navega", async () => {
  await assert.rejects(
    simulateCatalog([["M1", "M2"], ["M3", "M4"]], 4, 10, { totals: [4, 5] }),
    /contador cambió/
  );
});

test("Mercaeleva: normaliza URLs repetidas y rechaza enlaces ajenos", async () => {
  const result = await simulateCatalog([
    ["M1?src=grid", "M1#details", "https://externo.com/es/for-sale/machine/M2", "M2/"],
    ["M3", "M4"]
  ], 4);
  assert.ok(result && typeof result === "object" && "pages" in result && Array.isArray(result.pages));
  assert.equal(result.pages.length, 2);
});


test("Mercaeleva: el parser aplica la misma identidad de URL sin query ni barra final", () => {
  const html = `<a href="${baseUrl}M1?origen=lista">M1</a>
    <a href="${baseUrl}M1/#detalles">M1</a>
    <a href="https://externo.com/es/for-sale/machine/OTRA">Otra web</a>
    <a href="https://sales.mercaeleva.com/ca/for-sale/machine/M2">M2</a>`;
  assert.deepEqual(extractMercaelevaLinks(category.url, html), [
    `${baseUrl}M1`, "https://sales.mercaeleva.com/ca/for-sale/machine/M2"
  ]);
});


test("Mercaeleva: reduce el número de páginas si el selector admite más elementos", async () => {
  const pages = Array.from({ length: 12 }, (_, index) =>
    Array.from({ length: index === 11 ? 1 : 20 }, (_, offset) => `M${index * 20 + offset + 1}`));
  const result = await simulateCatalog(pages, 221, 12, {
    pageSizeOptions: [20, 50, 100], numericPagination: true
  });
  assert.ok(result && typeof result === "object" && "pages" in result && Array.isArray(result.pages));
  assert.equal(result.pages.length, 3);
});

test("Mercaeleva: recupera la última página desde la primera cuando falla el salto desde la 11", async () => {
  const pages = Array.from({ length: 12 }, (_, index) =>
    Array.from({ length: index === 10 ? 1 : 20 }, (_, offset) =>
      `M${index < 10 ? index * 20 + offset + 1 : index === 10 ? 201 : offset + 202}`));
  const result = await simulateCatalog(pages, 221, 12, {
    numericPagination: true, stallsOnSequentialLastPage: true
  });
  assert.ok(result && typeof result === "object" && "pages" in result && Array.isArray(result.pages));
  assert.equal(result.pages.length, 12);
});

test("Mercaeleva: bloquea el catálogo si tampoco responde el salto directo a la última página", async () => {
  const pages = Array.from({ length: 12 }, (_, index) =>
    Array.from({ length: index === 10 ? 1 : 20 }, (_, offset) =>
      `M${index < 10 ? index * 20 + offset + 1 : index === 10 ? 201 : offset + 202}`));
  await assert.rejects(simulateCatalog(pages, 221, 12, {
    numericPagination: true, stallsOnSequentialLastPage: true, stallsOnDirectLastPage: true
  }), /reintento directo desde la primera página/);
});

test("Mercaeleva: detecta el listado antes de completar las cargas externas", () => {
  const script = buildMercaelevaReadinessScript();
  const state = runInNewContext(script, {
    location: { href: category.url },
    document: {
      readyState: "interactive",
      title: "En venta | Merca-Eleva",
      body: { innerText: "Resultados: 221 Filtros" },
      querySelectorAll: (selector: string) => selector === 'a[href*="/for-sale/machine/"]' ? Array.from({ length: 20 }) : []
    }
  });
  assert.deepEqual(JSON.parse(JSON.stringify(state)), {
    href: category.url,
    ready: "interactive",
    title: "En venta | Merca-Eleva",
    count: "221",
    links: 20
  });
});

test("Mercaeleva: no confunde una página vacía con un catálogo cargado", () => {
  const state = runInNewContext(buildMercaelevaReadinessScript(), {
    location: { href: category.url },
    document: {
      readyState: "loading",
      title: "En venta | Merca-Eleva",
      body: { innerText: "Cargando..." },
      querySelectorAll: () => []
    }
  });
  assert.equal(state.count, null);
  assert.equal(state.links, 0);
});
