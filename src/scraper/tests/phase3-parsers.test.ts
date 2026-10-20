import assert from "node:assert/strict";
import test from "node:test";
import {
  gamListingFixture, gamProductFixture, gomarizListingFixture, gomarizProductFixture,
  mercaelevaListingFixture, mercaelevaProductFixture
} from "./fixtures/catalogs.js";
import { extractProductLinksFromListing as extractGam, parseProductPage as parseGam } from "../providers/gam/parsers.js";
import { extractGomarizLinks, parseGomarizProduct } from "../providers/gomariz/parsers.js";
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
