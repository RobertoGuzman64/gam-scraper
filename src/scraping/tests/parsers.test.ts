import assert from "node:assert/strict";
import test from "node:test";
import {
  gamListingFixture, gamProductFixture, gomarizListingFixture, gomarizProductFixture,
  mercaelevaListingFixture, mercaelevaProductFixture
} from "./fixtures/catalogs.js";
import { extractProductLinksFromListing as extractGam, parseProductPage as parseGam } from "../providers/gam/parsers.js";
import { extractGomarizLinks, parseGomarizProduct } from "../providers/gomariz/parsers.js";
import { identifyWordPressImage } from "../parsing/image-gallery.js";
import { extractMercaelevaLinks, parseMercaelevaProduct } from "../providers/mercaeleva/parsers.js";

const gamUrl = "https://online.gamrentals.com/es/8-plataformas-elevadoras-segunda-mano/1234-plataforma-segunda-mano.html";
const gomarizUrl = "https://www.gomarizrent.com/venta/elevacion-y-trabajos-en-altura/elevador-tijera/lgmg-s0812ii-3/";
const mercaelevaUrl = "https://sales.mercaeleva.com/es/for-sale/machine/JLG-450-AJ-M571-2568";

const requireRealCheerio = async (t: { skip(message: string): void }): Promise<boolean> => {
  const { load } = await import("cheerio");
  try { load("<html></html>"); return true; }
  catch { t.skip("Se necesita instalar Cheerio real para ejecutar los tests HTML"); return false; }
};

test("fixture GAM: listado y ficha técnica estable", async (t) => {
  if (!await requireRealCheerio(t)) return;
  assert.deepEqual(extractGam("https://online.gamrentals.com/es/8-plataformas-elevadoras-segunda-mano", gamListingFixture), [gamUrl]);
  const parsed = parseGam(gamProductFixture, gamUrl);
  assert.equal(parsed.title, "Plataforma HAULOTTE 2021");
  assert.equal(parsed.brand, "Haulotte");
  assert.equal(parsed.model, "Compact 10");
  assert.equal(parsed.year, "2021");
  assert.equal(parsed.price, "16000");
  assert.match(parsed.image ?? "", /plataforma\.jpg/);
  assert.equal(parsed.images?.length, 2);
});

test("fixture Gomariz: solo venta e identidad de unidad", async (t) => {
  if (!await requireRealCheerio(t)) return;
  assert.deepEqual(extractGomarizLinks("https://www.gomarizrent.com/venta/", gomarizListingFixture), [gomarizUrl]);
  const parsed = parseGomarizProduct(gomarizProductFixture, gomarizUrl);
  assert.equal(parsed.reference, "TE1617");
  assert.equal(parsed.year, "2024");
  assert.equal(parsed.price, null);
  assert.equal(parsed.specs?.["Motor"], "Eléctrico");
  assert.equal(parsed.images?.length, 2);
});

test("variantes WordPress: misma foto entre tamaños, preferencia original y fotografías independientes", () => {
  const base = "https://www.gomarizrent.com/wp-content/uploads/2026/08/TE1858-LGMG-SS0507E-";
  const thumbnail = identifyWordPressImage(`${base}22-300x169.jpg`);
  const medium = identifyWordPressImage(`${base}22-768x432.jpg`);
  const original = identifyWordPressImage(`${base}22.jpg`);
  const otherPhoto = identifyWordPressImage(`${base}14.jpg`);
  assert.equal(thumbnail.identity, medium.identity);
  assert.equal(medium.identity, original.identity);
  assert.notEqual(original.identity, otherPhoto.identity);
  assert.ok(original.rank > medium.rank);
  assert.ok(medium.rank > thumbnail.rank);
  assert.notEqual(identifyWordPressImage(`https://example.com/${base.split("/").at(-1)}22.jpg`).identity, original.identity);
});

test("Gomariz: deduplica variantes WordPress y conserva originales de fotografías distintas", async (t) => {
  if (!await requireRealCheerio(t)) return;
  const folder = "https://www.gomarizrent.com/wp-content/uploads/2026/08/";
  const html = `<html><main><h1>LGMG SS0507E</h1><p>Referencia: TE1858 Marca: LGMG Ver precio</p>
    <div class="woocommerce-product-gallery">
      <a href="${folder}TE1858-LGMG-SS0507E-22-300x169.jpg">
        <img src="${folder}TE1858-LGMG-SS0507E-22-600x338.jpg"
          srcset="${folder}TE1858-LGMG-SS0507E-22-768x432.jpg 768w, ${folder}TE1858-LGMG-SS0507E-22.jpg 1920w" />
      </a>
      <a href="${folder}TE1858-LGMG-SS0507E-14-300x169.jpg">
        <img data-large_image="${folder}TE1858-LGMG-SS0507E-14.jpg" src="${folder}TE1858-LGMG-SS0507E-14-600x338.jpg" />
      </a>
    </div></main></html>`;
  const parsed = parseGomarizProduct(html, gomarizUrl);
  assert.deepEqual(parsed.images, [
    `${folder}TE1858-LGMG-SS0507E-22.jpg`,
    `${folder}TE1858-LGMG-SS0507E-14.jpg`
  ]);
  assert.equal(parsed.image, `${folder}TE1858-LGMG-SS0507E-22.jpg`);
  assert.equal(parsed.price, null);
});

test("Gomariz: el texto Ver precio no se convierte en una marca", async (t) => {
  if (!await requireRealCheerio(t)) return;
  const html = `<html><main><h1>LGMG AS0607WE</h1><p>Referencia: TE1814 Marca: Ver precio Año: 2024</p></main></html>`;
  const parsed = parseGomarizProduct(html, gomarizUrl);
  assert.equal(parsed.brand, null);
  assert.equal(parsed.model, null);
  assert.equal(parsed.price, null);
});

test("Gomariz: sin original elige la variante de mayor resolución, sin mezclar fotos", async (t) => {
  if (!await requireRealCheerio(t)) return;
  const folder = "https://www.gomarizrent.com/wp-content/uploads/2026/08/";
  const html = `<html><main><h1>LGMG SS0507E</h1><p>Referencia: TE1858 Marca: LGMG Ver precio</p>
    <div class="woocommerce-product-gallery">
      <img src="${folder}TE1858-LGMG-SS0507E-22-300x169.jpg" srcset="${folder}TE1858-LGMG-SS0507E-22-768x432.jpg 768w, ${folder}TE1858-LGMG-SS0507E-22-600x338.jpg 600w" />
      <img src="${folder}TE1858-LGMG-SS0507E-14-600x338.jpg" />
    </div></main></html>`;
  const parsed = parseGomarizProduct(html, gomarizUrl);
  assert.deepEqual(parsed.images, [
    `${folder}TE1858-LGMG-SS0507E-22-768x432.jpg`,
    `${folder}TE1858-LGMG-SS0507E-14-600x338.jpg`
  ]);
});

test("fixture Mercaeleva: listado y referencia de publicación", async (t) => {
  if (!await requireRealCheerio(t)) return;
  assert.deepEqual(extractMercaelevaLinks("https://sales.mercaeleva.com/es/for-sale", mercaelevaListingFixture), [mercaelevaUrl]);
  const parsed = parseMercaelevaProduct(mercaelevaProductFixture, mercaelevaUrl);
  assert.equal(parsed.reference, "M571-2568");
  assert.equal(parsed.model, "450 AJ");
  assert.equal(parsed.year, "2015");
  assert.equal(parsed.horometer, "2857");
  assert.equal(parsed.images?.length, 2);
});

test("GAM ignora tabs con href vacío y mantiene las descripciones válidas", async (t) => {
  if (!await requireRealCheerio(t)) return;
  const html = `
    <html>
      <head><title>Plataforma</title></head>
      <body>
        <h1>Plataforma Genie S-65</h1>
        <a href="#">Descripción</a>
        <button data-bs-target="#descrip#cion" role="tab">Descripción</button>
        <div id="descrip#cion"><p>Descripción técnica extraída correctamente.</p></div>
      </body>
    </html>`;
  const parsed = parseGam(html, gamUrl);
  assert.equal(parsed.longDescription, "Descripción técnica extraída correctamente.");
});

test("GAM ignora tabs sin destino y recupera la descripción de metadatos", async (t) => {
  if (!await requireRealCheerio(t)) return;
  const html = `
    <html>
      <head><meta property="og:description" content="Descripción de la ficha."></head>
      <body><h1>Plataforma Genie S-65</h1><a href="#">Descripción</a></body>
    </html>`;
  const parsed = parseGam(html, gamUrl);
  assert.equal(parsed.longDescription, "Descripción de la ficha.");
});
