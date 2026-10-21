import assert from "node:assert/strict";
import test from "node:test";
import { loadImportCatalog } from "../../../../catalog/import/catalog-loader.js";
import { prepareProduct } from "../../../../catalog/import/prepare.js";
import type { ProductRecord } from "../../../../contracts/catalog.js";
import { parseMercaelevaProduct } from "../parsers.js";

const reference = "M044-4093";
const url = `https://sales.mercaeleva.com/es/for-sale/machine/JLG-450-AJ-SII-${reference}`;
const original = `https://files2.machineric.com/clients/mercaeleva/machines/${reference}/public/445.jpg`;
const commercialAddress = {
  city: "Barcelona", countryCode: "ES", state: "Vilafranca del Penedès",
  street: "Avinguda de Tarragona, 106", zipCode: "08720"
};
const metadata = JSON.stringify({
  location: commercialAddress,
  machinericId: reference,
  pictures: [{ big: original }],
  prices: [{ currency: "EUR", isStrikethroughPrice: false, priceExcludingVat: 20500 }],
  salesContacts: [{ location: commercialAddress, position: "Dpt Gestión Flota" }]
});
const row = (name: string, value: string): string => `<div class="field"><span>${name}</span><span>${value}</span></div>`;

const html = `<html><body>
  <h1>JLG 450 AJ SII PLATAFORMA ARTICULADA DIESEL 16 MT</h1>
  <h2>Machine description</h2>
  <p>Ref.445 PLATAFORMA ARTICULADA DIESEL ALTURA DE TRABAJO 16 MT JLG 450 AJ SII HORAS: 3666 AÑO DE FABRICACIÓN 2013</p>
  <h2>Información general</h2>
  ${row("Marca", "JLG")}${row("Modelo", "450 AJ SII")}${row("Altura de trabajo", "16 m")}
  ${row("Horas laborales", "3666 h")}${row("Estado", "Usado")}
  ${row("¡Haz una oferta!", "Contáctenos y haga su oferta.")}
  ${row("Dpt Gestión Flota", "Teléfono: +34633666089")}
  <script type="application/json">${metadata}</script>
</body></html>`;

test("Mercaeleva: la ficha mantiene precio, galería y técnica sin publicar datos comerciales ni forzar ready", async () => {
  const parsed = parseMercaelevaProduct(html, url);
  assert.equal(parsed.reference, reference);
  assert.equal(parsed.price, "20500");
  assert.deepEqual(parsed.images, [original]);
  assert.equal(parsed.location, null);
  assert.equal(parsed.country, null);
  assert.equal(parsed.specs?.["Altura de trabajo"], "16 m");
  assert.equal(parsed.specs?.["¡Haz una oferta!"], undefined);
  assert.equal(parsed.specs?.["Dpt Gestión Flota"], undefined);
  assert.equal(parsed.shortDescription, null);

  const record: ProductRecord = {
    ...parsed, providerId: "mercaeleva", categoryKey: "venta",
    categoryName: "Maquinaria en venta", url, reference: parsed.reference ?? null
  };
  const prepared = prepareProduct(record, await loadImportCatalog());
  assert.equal(prepared.status, "review");
  assert.equal(prepared.product.price, 20500);
  assert.deepEqual(prepared.product.images, [original]);
  assert.equal(prepared.product.description, null);
  assert.equal(prepared.product.description_general, parsed.longDescription);
  assert.ok(prepared.issues.some((issue) => issue.includes("Descripción corta ausente")));
  assert.equal(prepared.product.categorySellID, 29);
  assert.ok(!prepared.issues.some((issue) => issue.includes("Categoría Equipzilla")));
});
