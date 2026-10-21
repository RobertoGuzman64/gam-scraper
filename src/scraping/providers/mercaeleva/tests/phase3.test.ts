import assert from "node:assert/strict";
import test from "node:test";
import { extractEmbeddedMachineMetadata } from "../embedded-machine.js";
import { parseMercaelevaProduct } from "../parsers.js";

const url = "https://sales.mercaeleva.com/es/for-sale/machine/MB-ESL122-M288-9739";
const original = "https://files2.machineric.com/clients/mercaeleva/machines/M288-9739/public/equipo.jpg";
const medium = "https://files2.machineric.com/clients/mercaeleva/machines/M288-9739/public/medium/equipo.jpg";
const thumbnail = "https://files2.machineric.com/clients/mercaeleva/machines/M288-9739/public/thumbnail/equipo.jpg";
const state = JSON.stringify({
  location: { city: "Barcelona", countryCode: "ES", state: "Vilafranca del Penedès", zipCode: "08720" },
  machineSiteSettings: [],
  machinericId: "M288-9739",
  pictures: [{ big: original, medium, small: thumbnail, orderNumber: 1 }],
  prices: []
});

test("Mercaeleva: recupera la ubicación y la fotografía grande del estado real", () => {
  const result = extractEmbeddedMachineMetadata(state, "M288-9739");
  assert.equal(result.location, "Barcelona · Vilafranca del Penedès · 08720");
  assert.equal(result.country, "ES");
  assert.deepEqual(result.images, [original]);
});

test("Mercaeleva: no mezcla los datos de otras máquinas ni inventa los ausentes", () => {
  assert.deepEqual(extractEmbeddedMachineMetadata(state, "M000-0000"), { location: null, country: null, images: [] });
});

test("Mercaeleva: usa la imagen grande y ubicación del JSON de su propia ficha", () => {
  const html = `<html><body><h1>MB ESL122 Apilador Eléctrico</h1>
    <div class="machine-gallery"><img src="${medium}"><img src="${thumbnail}"></div>
    <h2>General information</h2><dl><dt>Marca</dt><dd>MB</dd></dl>
    <script type="application/json">${state}</script>
  </body></html>`;
  const product = parseMercaelevaProduct(html, url);
  assert.equal(product.location, "Barcelona · Vilafranca del Penedès · 08720");
  assert.equal(product.country, "ES");
  assert.equal(product.image, original);
  assert.deepEqual(product.images, [original]);
});

test("Mercaeleva: prioriza medium sobre miniatura si no hay imagen original publicada", () => {
  const html = `<html><body><h1>MB ESL122 Apilador Eléctrico</h1>
    <div class="machine-gallery"><img src="${thumbnail}"><img src="${medium}"></div>
  </body></html>`;
  const product = parseMercaelevaProduct(html, url);
  assert.deepEqual(product.images, [medium]);
});
