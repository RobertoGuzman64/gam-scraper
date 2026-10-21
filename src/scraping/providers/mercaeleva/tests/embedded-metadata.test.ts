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

const commercialAddress = {
  city: "Barcelona", countryCode: "ES", state: "Vilafranca del Penedès",
  street: "Avinguda de Tarragona, 106", zipCode: "08720"
};

const sellerAddressState = JSON.stringify({
  location: commercialAddress,
  machinericId: "M288-9739",
  pictures: [{ big: original, medium }],
  prices: [],
  salesContacts: [{ location: commercialAddress, position: "Dpt Gestión Flota" }]
});

test("Mercaeleva: no confunde la dirección del contacto comercial con la ubicación de la máquina", () => {
  assert.deepEqual(extractEmbeddedMachineMetadata(sellerAddressState, "M288-9739"), {
    location: null, country: null, images: [original]
  });
  const html = `<html><body><h1>MB ESL122 Apilador Eléctrico</h1>
    <div><span>Ubicación</span><span>Avinguda de Tarragona, 106, 08720</span></div>
    <script type="application/json">${sellerAddressState}</script>
  </body></html>`;
  const product = parseMercaelevaProduct(html, url);
  assert.equal(product.location, null);
  assert.equal(product.country, null);
  assert.deepEqual(product.images, [original]);
});

test("Mercaeleva: conserva una ubicación diferente de la dirección del contacto", () => {
  const machineLocation = {
    city: "Madrid", countryCode: "ES", state: "Madrid", street: "Calle Mayor, 1", zipCode: "28013"
  };
  const source = JSON.stringify({
    location: machineLocation,
    machinericId: "M288-9739",
    pictures: [{ big: original }],
    prices: [],
    salesContacts: [{ location: commercialAddress }]
  });
  const result = extractEmbeddedMachineMetadata(source, "M288-9739");
  assert.equal(result.location, "Madrid · Madrid · 28013");
  assert.equal(result.country, "ES");
  assert.deepEqual(result.images, [original]);
});

test("Mercaeleva: no atribuye la ubicación de otra referencia a una ficha sin ubicación", () => {
  const source = `${state},{"machinericId":"M288-9740","pictures":[],"prices":[]}`;
  assert.deepEqual(extractEmbeddedMachineMetadata(source, "M288-9740"), {
    location: null, country: null, images: []
  });
});

test("Mercaeleva: no descarta una ubicación diferente aunque comparta municipio y código postal", () => {
  const source = JSON.stringify({
    location: { ...commercialAddress, street: "Carrer de la Indústria, 20" },
    machinericId: "M288-9739",
    pictures: [{ big: original }],
    salesContacts: [{ location: commercialAddress }]
  });
  assert.equal(extractEmbeddedMachineMetadata(source, "M288-9739").location, "Barcelona · Vilafranca del Penedès · 08720");
});
