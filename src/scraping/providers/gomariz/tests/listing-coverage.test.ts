import assert from "node:assert/strict";
import test from "node:test";
import { discoverProductUrls } from "../../../engine/discover-listing.js";
import { gomarizProvider } from "../adapter.js";
import { GOMARIZ_CATEGORIES, GOMARIZ_OPTIONS } from "../config.js";
import { extractGomarizLastPage, extractGomarizLinks, isGomarizProductUrl } from "../parsers.js";

const root = "https://www.gomarizrent.com/venta/";
const legacy = "https://www.gomarizrent.com/producto/brazo-articulado-articulating-boom-lift-skayjack-sj85aj/";
const sale = "https://www.gomarizrent.com/venta/elevacion-y-trabajos-en-altura/elevador-tijera/lgmg-ss0507e-tijera-electrica-scissor-lift/";
const historical = "https://www.gomarizrent.com/elevacion-y-trabajos-en-altura/brazo-telescopico/jlg-1350sjp-2/";
const forklift = "https://www.gomarizrent.com/manipulacion-de-materiales/carretilla-industrial/toyota-7fbmf20/";

const card = (url: string, title: string): string => `<article class="product"><h3><a href="${url}">${title}</a></h3></article>`;

const document = (html: string, title = "Venta archivos - Gomariz Sistemas de Elevación S.L."): string =>
  `<html><head><title>${title}</title></head><body><main>${html}</main></body></html>`;

test("Gomariz descubre solo fichas enlazadas desde las tarjetas de venta, aunque tengan rutas antiguas", () => {
  const html = document([
    card(sale, "LGMG SS0507E"), card(legacy, "SKYJACK SJ85AJ"),
    card(historical, "JLG 1350SJP"), card(forklift, "Toyota 7FBMF20"),
    card("https://www.gomarizrent.com/alquiler/elevacion-y-trabajos-en-altura/elevador-tijera/lgmg-s0607e-2-1/", "LGMG S0607E"),
    card("https://www.gomarizrent.com/producto/__trashed-17/", "Archivo eliminado"),
    `<nav>${card("https://www.gomarizrent.com/producto/no-es-venta/", "Navegación")}</nav>`,
    `<nav>${card("https://www.gomarizrent.com/alquiler/elevacion-y-trabajos-en-altura/elevador-tijera/otro/", "Alquiler")}</nav>`,
    `<aside><a href="${legacy}?preview=1">Enlace lateral</a></aside>`,
    `<footer>${card("https://www.gomarizrent.com/producto/otra-maquina/", "Pie")}</footer>`,
    card("https://www.gomarizrent.com/elevacion-y-trabajos-en-altura/elevador-tijera/", "Categoría"),
    card("https://www.gomarizrent.com/venta/elevacion-y-trabajos-en-altura/elevador-tijera/", "Categoría de venta"),
    `<a href="https://www.gomarizrent.com/contacto/formulario/">Contacto</a>`,
    `<a href="${legacy}?ref=venta#foto">Imagen</a>`
  ].join(""));
  assert.deepEqual(extractGomarizLinks(root, html), [sale, legacy, historical, forklift,
    "https://www.gomarizrent.com/alquiler/elevacion-y-trabajos-en-altura/elevador-tijera/lgmg-s0607e-2-1/"]);
  assert.deepEqual(extractGomarizLinks("https://www.gomarizrent.com/alquiler/", html), []);
  assert.equal(isGomarizProductUrl(legacy), true);
  assert.equal(isGomarizProductUrl(historical), true);
  assert.equal(isGomarizProductUrl("https://www.gomarizrent.com/elevacion-y-trabajos-en-altura/elevador-tijera/"), false);
  assert.equal(isGomarizProductUrl("https://www.gomarizrent.com/venta/elevacion-y-trabajos-en-altura/elevador-tijera/"), false);
  assert.equal(isGomarizProductUrl("https://www.gomarizrent.com/alquiler/maquinaria/prueba/"), false);
  assert.equal(isGomarizProductUrl("https://www.gomarizrent.com/producto/__trashed-17/"), false);
  assert.equal(isGomarizProductUrl("https://example.com/producto/maquina/"), false);
});

test("Gomariz obtiene la última página desde la paginación acreditable del sitio", () => {
  assert.equal(extractGomarizLastPage(document("", "Venta archivos - Página 2 de 42 - Gomariz")), 42);
  assert.equal(extractGomarizLastPage(document("", "Venta archivos - Gomariz")), null);
  assert.equal(extractGomarizLastPage(document("", "Venta archivos - Página 2 de 1 - Gomariz")), 1);
  assert.equal(extractGomarizLastPage(document(`<nav class="pagination"><a class="page-numbers last" href="/venta/page/42/">42</a></nav>`)), 42);
});

test("Gomariz recorre todas las páginas declaradas aunque haya una página repetida", async () => {
  const pages: readonly string[] = [
    document(card(sale, "LGMG SS0507E")),
    document(card(legacy, "SKYJACK SJ85AJ"), "Venta archivos - Página 2 de 4 - Gomariz"),
    document(card(legacy, "SKYJACK SJ85AJ"), "Venta archivos - Página 3 de 4 - Gomariz"),
    document(card(forklift, "Toyota 7FBMF20"), "Venta archivos - Página 4 de 4 - Gomariz")
  ];
  const visited: string[] = [];
  const failures: string[] = [];
  const provider = {
    ...gomarizProvider,
    loadListingHtml: async (url: string): Promise<string> => {
      visited.push(url);
      const page = Number(/\/page\/(\d+)\//u.exec(url)?.[1] ?? "1");
      const html = pages[page - 1];
      if (!html) throw new Error("Página inesperada");
      return html;
    }
  };
  const category = GOMARIZ_CATEGORIES[0]!;
  const result = await discoverProductUrls(category, { ...GOMARIZ_OPTIONS, delayMs: 0, maxPages: 10 },
    provider, 1, (_stage, _url, message) => { failures.push(message); }, String, () => {});
  assert.deepEqual(visited, [root, `${root}page/2/`, `${root}page/3/`, `${root}page/4/`]);
  assert.deepEqual(result.urls, [sale, legacy, forklift]);
  assert.ok(failures.some((message) => /sin referencias nuevas/iu.test(message)));
});

test("Gomariz impide acreditar una extracción sin número de páginas o con una página vacía", async () => {
  const category = GOMARIZ_CATEGORIES[0]!;
  const failures: string[] = [];
  const run = (pages: readonly string[]) => discoverProductUrls(category,
    { ...GOMARIZ_OPTIONS, delayMs: 0, maxPages: pages.length }, {
      ...gomarizProvider,
      loadListingHtml: async (url: string): Promise<string> => {
        const page = Number(/\/page\/(\d+)\//u.exec(url)?.[1] ?? "1");
        return pages[page - 1] ?? "";
      }
    }, 1, (_stage, _url, message) => { failures.push(message); }, String, () => {});
  await run([document(card(sale, "LGMG SS0507E")), document(card(legacy, "SKYJACK SJ85AJ"))]);
  assert.ok(failures.some((message) => /No se pudo acreditar el número de páginas/iu.test(message)));
  failures.length = 0;
  await run([document(card(sale, "LGMG SS0507E")),
    document(card(legacy, "SKYJACK SJ85AJ"), "Venta archivos - Página 2 de 3 - Gomariz"),
    document("", "Venta archivos - Página 3 de 3 - Gomariz")]);
  assert.ok(failures.some((message) => /sin fichas detectadas/iu.test(message)));
});
