import assert from "node:assert/strict";
import test from "node:test";
import { runInNewContext } from "node:vm";
import { extractManainSaleProductLinks, normalizeManainSaleProductUrl, parseManainListingResult } from "../listing.js";
import { buildManainListingScript } from "../listing-script.js";
import { discoverManainSaleCatalog } from "../browser.js";

const catalogUrl = "https://manain.com/catalogo/venta/";
const product = (slug: string): string => `https://manain.com/producto/venta-${slug}/`;

test("Manain: enlaces canónicos de venta sin categorías, alquiler, tracking ni tarjetas relacionadas", () => {
  const html = `<header><a href="${product("cabecera")}">Menú</a></header>
    <main><a href="/producto/venta-sinoboom-0608me/?utm_campaign=uno#foto">Equipo 1</a>
    <a href="https://www.manain.com/producto/venta-sinoboom-0608me">Duplicado móvil</a>
    <a href="/producto/venta-sinoboom-0608me-2/">Mismo modelo, otra máquina</a>
    <a href="/producto/venda-elevacio-tisores-jlg-530lrt/">Producto catalán</a>
    <a href="/catalogo-de-productos-alquiler/">Alquiler</a>
    <a href="/producto/alquiler-genie/">Alquiler</a>
    <a href="https://otro-dominio.example/producto/venta-espuria/">Externa</a>
    <div class="related"><a href="${product("relacionada")}">Relacionada</a></div></main>`;
  assert.deepEqual(extractManainSaleProductLinks(catalogUrl, html), [
    product("sinoboom-0608me"), product("sinoboom-0608me-2"),
    "https://manain.com/producto/venda-elevacio-tisores-jlg-530lrt/"
  ]);
  assert.equal(normalizeManainSaleProductUrl("https://manain.com/producto/venda-elevacio-tisores-jlg-530lrt/", catalogUrl),
    "https://manain.com/producto/venda-elevacio-tisores-jlg-530lrt/");
  assert.equal(normalizeManainSaleProductUrl("javascript:alert(1)", catalogUrl), null);
  assert.equal(normalizeManainSaleProductUrl("http://manain.com/producto/venta-sinoboom/", catalogUrl), null);
});

test("Manain: valida los resultados del navegador sin inventar totales", () => {
  assert.deepEqual(parseManainListingResult({
    urls: [product("a"), `${product("a")}?track=1`, product("b")], pagesVisited: 2,
    complete: true, endReason: "control-exhausted"
  }), { urls: [product("a"), product("b")], pagesVisited: 2, complete: true, endReason: "control-exhausted" });
  assert.throws(() => parseManainListingResult({
    urls: [product("a")], pagesVisited: 2, complete: true, endReason: "page-limit"
  }), /inconsistente/);
  assert.throws(() => parseManainListingResult({
    urls: ["https://manain.com/producto/alquiler-a/"], pagesVisited: 1,
    complete: false, endReason: "unverified-single-page"
  }), /ajena/);
});

type MockAnchor = {
  readonly href: string;
  closest(selector: string): object | null;
};

const simulate = async (
  pages: readonly (readonly string[])[], maxPages: number,
  behavior: "normal" | "stall" | "missing-button" = "normal"
): Promise<unknown> => {
  let current = 0;
  let fakeTime = 0;
  const anchors = (): MockAnchor[] => pages.slice(0, current + 1).flat().map((slug) => ({
    href: slug.startsWith("https://") ? slug : product(slug), closest: () => null
  }));
  const button = {
    textContent: "Cargar más",
    disabled: false,
    classList: { contains: () => false },
    hasAttribute: () => false,
    getAttribute: () => null,
    getClientRects: () => [{}],
    closest: () => null,
    click: () => { if (behavior !== "stall") current += 1; }
  };
  const document = {
    location: { href: catalogUrl },
    querySelectorAll: (selector: string): readonly unknown[] => {
      if (selector === "a[href]") return anchors();
      if (selector === 'button, a, [role="button"]') {
        return behavior !== "missing-button" && current < pages.length - 1 ? [button] : [];
      }
      return [];
    }
  };
  return runInNewContext(buildManainListingScript(maxPages, 1500, 0), {
    document, URL,
    Date: class extends Date { static override now(): number { return fakeTime; } },
    console: { debug: () => {} },
    setTimeout: (callback: () => void, milliseconds: number) => {
      fakeTime += milliseconds;
      setImmediate(callback);
    }
  });
};

test("Manain: botón Cargar más, paginación y deduplicación conservando modelos repetidos", async () => {
  const result = parseManainListingResult(await simulate([
    ["sinoboom-0608me", "sinoboom-0608me-2", "https://manain.com/producto/venda-elevacio-tisores-jlg-530lrt/"],
    ["sinoboom-0608me", "epiroc-sb-102"],
    ["ausad-151", "sinoboom-0608me-2"]
  ], 5));
  assert.deepEqual(result, {
    urls: [product("sinoboom-0608me"), product("sinoboom-0608me-2"),
      "https://manain.com/producto/venda-elevacio-tisores-jlg-530lrt/", product("epiroc-sb-102"), product("ausad-151")],
    pagesVisited: 3, complete: true, endReason: "control-exhausted"
  });
});

test("Manain: límite de navegación no se confunde con fin de catálogo", async () => {
  const result = parseManainListingResult(await simulate([["a"], ["b"], ["c"]], 2));
  assert.equal(result.complete, false);
  assert.equal(result.pagesVisited, 2);
  assert.equal(result.endReason, "page-limit");
});

test("Manain: ausencia de control desde el inicio nunca acredita cobertura", async () => {
  const result = parseManainListingResult(await simulate([["a"]], 5, "missing-button"));
  assert.equal(result.complete, false);
  assert.equal(result.endReason, "unverified-single-page");
});

test("Manain: un Cargar más que no avanza falla expresamente", async () => {
  await assert.rejects(simulate([["a"], ["b"]], 5, "stall"), /no incorporó fichas nuevas/);
});

test("Manain: HTML sin fichas de venta falla y no produce inventario vacío válido", async () => {
  await assert.rejects(simulate([[]], 5, "missing-button"), /sin enlaces de venta/);
});

test("Manain: rechaza orígenes fuera del catálogo de venta antes de abrir navegador", async () => {
  const options = { outDir: "", outPrefix: "", maxPages: 5, stallStopAfter: 2,
    concurrencyPages: 1, concurrencyProducts: 1, timeoutMs: 1000, delayMs: 0, userAgent: "test" };
  await assert.rejects(discoverManainSaleCatalog("https://manain.com/catalogo-de-productos-alquiler/", options), /origen no autorizado/);
  await assert.rejects(discoverManainSaleCatalog("https://otro-dominio.example/catalogo/venta/", options), /origen no autorizado/);
});
