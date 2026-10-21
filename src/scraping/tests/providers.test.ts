import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { resolveCliSelection } from "../../cli/options/scrape.js";
import { writeOutputs } from "../../pipeline/publication/publish.js";
import type { ScraperProvider } from "../provider.js";
import { buildGomarizPageUrl, isGomarizProductUrl } from "../providers/gomariz/parsers.js";
import { buildMercaelevaPageUrl, extractMercaelevaReference, isMercaelevaProductUrl } from "../providers/mercaeleva/parsers.js";
import { getProvider } from "../registry.js";
import { scrapeCategory } from "../engine/scrape-category.js";

const gomarizPage = "https://www.gomarizrent.com/venta/";
const mercaPage = "https://sales.mercaeleva.com/es/for-sale";

test("nuevos proveedores registrados con salidas independientes y categoría de venta", () => {
  for (const id of ["gomariz", "mercaeleva"]) {
    const selected = resolveCliSelection(["--provider", id]);
    assert.equal(selected.provider, getProvider(id));
    assert.equal(selected.provider.categories.length, 1);
    assert.match(selected.options.outDir, new RegExp(`/${id}$`));
    assert.equal(selected.provider.categories[0]?.key, "venta");
  }
  assert.equal(resolveCliSelection([]).provider.id, "gam");
});

test("Gomariz pagina la venta sin usar enlaces de alquiler ni navegación", () => {
  assert.equal(buildGomarizPageUrl(gomarizPage, 1), gomarizPage);
  assert.equal(buildGomarizPageUrl(gomarizPage, 2), `${gomarizPage}page/2/`);
  assert.equal(buildGomarizPageUrl(`${gomarizPage}page/2/`, 3), `${gomarizPage}page/3/`);
  assert.ok(isGomarizProductUrl(`${gomarizPage}elevacion-y-trabajos-en-altura/elevador-tijera/lgmg-s0812ii-3/`));
  assert.ok(!isGomarizProductUrl(`${gomarizPage}page/2/`));
  assert.ok(!isGomarizProductUrl("https://www.gomarizrent.com/alquiler/elevador-tijera/lgmg/"));
  assert.ok(!isGomarizProductUrl("https://attacker.example/venta/producto/lgmg/"));
});

test("Mercaeleva reconoce las fichas sin confundir las categorías", () => {
  assert.equal(buildMercaelevaPageUrl(mercaPage, 1), mercaPage);
  assert.equal(buildMercaelevaPageUrl(mercaPage, 2), `${mercaPage}?page=2`);
  assert.ok(isMercaelevaProductUrl(`${mercaPage}/machine/JLG-450-AJ-M571-2568`));
  assert.ok(!isMercaelevaProductUrl(mercaPage));
  assert.ok(!isMercaelevaProductUrl("https://sales.mercaeleva.com/en/about-us"));
  assert.equal(extractMercaelevaReference(`${mercaPage}/machine/JLG-450-AJ-M571-2568`), "M571-2568");
  assert.equal(extractMercaelevaReference(`${mercaPage}/machine/JLG-450-AJ-M976-1043`), "M976-1043");
  assert.equal(extractMercaelevaReference(mercaPage), null);
});

test("el motor acepta referencias provenientes de HTML y carga personalizada del listado", async () => {
  const category = { key: "venta", name: "Venta", url: "https://example.test/list" };
  let listingReads = 0;
  const base = getProvider("gam");
  const testProvider: ScraperProvider = {
    ...base,
    id: "supplier-test",
    categories: [category],
    loadListingHtml: async () => { listingReads += 1; return "<html></html>"; },
    extractProductLinksFromListing: () => ["https://example.test/product/unique"],
    parseProductPage: () => ({
      reference: "INV-123", title: "Máquina", brand: null, model: null, year: null,
      price: null, shortDescription: null, longDescription: null, location: null,
      country: null, horometer: null, serialNumber: null, image: null, specs: {}
    }),
    extractReference: () => null
  };
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response("<html></html>", { status: 200 });
  try {
    const scraped = await scrapeCategory(category, { ...base.defaultOptions, maxPages: 1, concurrencyPages: 1, concurrencyProducts: 1, delayMs: 0 }, testProvider);
    assert.equal(listingReads, 1);
    assert.equal(scraped.products[0]?.reference, "INV-123");
    assert.equal(scraped.products[0]?.providerId, "supplier-test");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("dos unidades Gomariz del mismo modelo mantienen identidades diferentes", async () => {
  const folder = await mkdtemp(join(tmpdir(), "gomariz-provider-"));
  try {
    const base = {
      providerId: "gomariz", categoryKey: "venta", categoryName: "Venta",
      title: "LGMG AS0812", shortDescription: null, longDescription: null,
      price: null, brand: "LGMG", model: "AS0812", year: "2024",
      location: null, country: null, horometer: null, serialNumber: null, image: null, specs: {}
    };
    const products = [
      { ...base, reference: "TE1617", url: `${gomarizPage}elevacion/tijera/lgmg-as0812-1/` },
      { ...base, reference: "TE1618", url: `${gomarizPage}elevacion/tijera/lgmg-as0812-2/` }
    ];
    await writeOutputs(folder, "test", [{ category: { key: "venta", name: "Venta", url: gomarizPage }, products, discoveredProductUrls: 2, failures: [] }], "2026-01-01T00:00:00Z", "2026-01-01T00:00:01Z");
    const summary = JSON.parse(await readFile(join(folder, "test-summary.json"), "utf8")) as { totals: { scrapedProducts: number } };
    assert.equal(summary.totals.scrapedProducts, 2);
  } finally {
    await rm(folder, { recursive: true, force: true });
  }
});

test("Gomariz lee identidad, descripción, precio no publicado y especificaciones", async (t) => {
  const { load } = await import("cheerio");
  try { load("<html></html>"); } catch { t.skip("La instalación local solo incluye declaraciones de Cheerio"); return; }
  const { extractGomarizLinks, parseGomarizProduct } = await import("../providers/gomariz/parsers.js");
  const url = `${gomarizPage}elevacion-y-trabajos-en-altura/elevador-tijera/lgmg-s0812ii-3/`;
  const listing = `<a href="${url}">Unidad A</a><a href="${gomarizPage}page/2/">Siguiente</a>`;
  assert.deepEqual(extractGomarizLinks(gomarizPage, listing), [url]);
  const html = `<html><main><h1>LGMG S0812II</h1><p>Referencia: TE1617 Categoría: Elevación y trabajos en altura Año: 2024 Marca: LGMG Ver precio Contactar</p><h2>Descripción</h2><p>Máquina de ocasión revisada.</p><h2>Dimensiones</h2><p>Altura de trabajo: 10 m Peso: 2395 kg</p><h2>Especificaciones técnicas</h2><p>Motor: Eléctrico Capacidad: 450 kg</p><p>Ver ficha técnica</p><div class="product-gallery"><img src="https://www.gomarizrent.com/wp-content/uploads/te1617.jpg" /></div></main></html>`;
  const parsed = parseGomarizProduct(html, url);
  assert.equal(parsed.reference, "TE1617");
  assert.equal(parsed.year, "2024");
  assert.equal(parsed.brand, "LGMG");
  assert.equal(parsed.price, null);
  assert.equal(parsed.specs?.["Motor"], "Eléctrico");
  assert.equal(parsed.specs?.["Capacidad"], "450 kg");
  assert.match(parsed.image ?? "", /te1617\.jpg/);
});

test("Mercaeleva lee datos de maquinaria y mantiene el ID de publicación", async (t) => {
  const { load } = await import("cheerio");
  try { load("<html></html>"); } catch { t.skip("La instalación local solo incluye declaraciones de Cheerio"); return; }
  const { extractMercaelevaLinks, parseMercaelevaProduct } = await import("../providers/mercaeleva/parsers.js");
  const url = `${mercaPage}/machine/JLG-450-AJ-M571-2568`;
  assert.deepEqual(extractMercaelevaLinks(mercaPage, `<a href="${url}">Máquina</a><a href="/es/about-us">Empresa</a>`), [url]);
  const html = `<html><body><h1>JLG 450 AJ PLATAFORMA ARTICULADA DIESEL 16 MT</h1><p>23 500 EUR IVA Excluido</p><h2>Machine description</h2><p>Ref. 541 PLATAFORMA ARTICULADA</p><div><span>Marca</span><span>JLG</span></div><div><span>Modelo</span><span>450 AJ</span></div><div><span>Año de fabricación</span><span>2015</span></div><div><span>Horas laborales</span><span>2857 h</span></div><img alt="JLG Imagen 1 / 11" src="https://files2.machineric.com/photos/jlg.jpg" /></body></html>`;
  const parsed = parseMercaelevaProduct(html, url);
  assert.equal(parsed.reference, "M571-2568");
  assert.equal(parsed.brand, "JLG");
  assert.equal(parsed.model, "450 AJ");
  assert.equal(parsed.year, "2015");
  assert.equal(parsed.horometer, "2857");
  assert.match(parsed.price ?? "", /23 500 EUR/);
  assert.match(parsed.image ?? "", /jlg\.jpg/);
});
