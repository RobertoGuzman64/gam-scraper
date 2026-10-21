import assert from "node:assert/strict";
import test from "node:test";
import { extractEmbeddedMachinePrice } from "../embedded-machine.js";
import { parseMercaelevaProduct } from "../parsers.js";

const reference = "M288-9739";
const url = `https://sales.mercaeleva.com/es/for-sale/machine/MB-ESL122-${reference}`;

const state = (prices: readonly unknown[], currentReference = reference): string => JSON.stringify({
  machinericId: currentReference,
  pictures: [],
  prices,
  rentable: false
});

const published = { currency: "EUR", isStrikethroughPrice: false, priceExcludingVat: 4950, priceIncludingVat: 5989.5 };

test("Mercaeleva: recupera precio publicado sin IVA desde su JSON interno cuando no está visible", () => {
  assert.equal(extractEmbeddedMachinePrice(state([published]), reference), "4950");
  const result = parseMercaelevaProduct(`<html><body><h1>MB ESL122 Apilador Eléctrico</h1>
    <script type="application/json">${state([published])}</script></body></html>`, url);
  assert.equal(result.price, "4950");
});

test("Mercaeleva: respeta el precio visible y no mezcla estados de otras máquinas", () => {
  const result = parseMercaelevaProduct(`<html><body><h1>MB ESL122 Apilador Eléctrico</h1>
    <p>4.800,00 EUR</p><script type="application/json">${state([published])}</script></body></html>`, url);
  assert.equal(result.price, "4.800,00 EUR");
  assert.equal(extractEmbeddedMachinePrice(state([published], "M000-0001"), reference), null);
  assert.equal(extractEmbeddedMachinePrice(`${state([], "M000-0001")} ${state([published])}`, "M000-0001"), null);
});

test("Mercaeleva: no recupera precios tachados, sin moneda EUR o no positivos", () => {
  assert.equal(extractEmbeddedMachinePrice(state([{ ...published, isStrikethroughPrice: true }]), reference), null);
  assert.equal(extractEmbeddedMachinePrice(state([{ ...published, currency: "GBP" }]), reference), null);
  assert.equal(extractEmbeddedMachinePrice(state([{ ...published, priceExcludingVat: 0 }]), reference), null);
  assert.equal(extractEmbeddedMachinePrice(state([{ ...published, priceExcludingVat: null }]), reference), null);
  assert.equal(extractEmbeddedMachinePrice(state([{ ...published, priceExcludingVat: "4950" }]), reference), null);
  assert.equal(extractEmbeddedMachinePrice(state([]), reference), null);
});

test("Mercaeleva: recupera altura de elevación, mástil y capacidad etiquetadas en ficha", () => {
  const result = parseMercaelevaProduct(`<html><body><h1>MB ESL122 Apilador Eléctrico</h1>
    <h2>Sales information</h2>
    <div><span>Altura de elevación</span><span>5 m</span></div>
    <div><span>Tipo de mástil</span><span>Tríplex</span></div>
    <div><span>Capacidad de carga</span><span>1200 kg</span></div>
  </body></html>`, url);
  assert.equal(result.specs?.["Altura de elevación"], "5 m");
  assert.equal(result.specs?.["Tipo de mástil"], "Tríplex");
  assert.equal(result.specs?.["Capacidad de carga"], "1200 kg");
});

test("Mercaeleva: conserva medidas etiquetadas en información de venta", () => {
  const result = parseMercaelevaProduct(`<html><body><h1>MB ESL122 Apilador Eléctrico</h1>
    <h2>Información de venta</h2>
    <div><span>Altura de elevación</span><span>5 m</span></div>
    <div><span>Tipo de mástil</span><span>Tríplex</span></div>
    <div><span>Capacidad de carga</span><span>1200 kg</span></div>
    <div><span>Departamento</span><span>Ventas</span></div>
  </body></html>`, url);
  assert.equal(result.specs?.["Altura de elevación"], "5 m");
  assert.equal(result.specs?.["Tipo de mástil"], "Tríplex");
  assert.equal(result.specs?.["Capacidad de carga"], "1200 kg");
  assert.equal(result.specs?.["Departamento"], undefined);
});

test("Mercaeleva: en información de venta solo recupera medidas técnicas explícitas", () => {
  const result = parseMercaelevaProduct(`<html><body><h1>MB ESL122 Apilador Eléctrico</h1>
    <h2>Sales information</h2>
    <div><span>Altura de elevación</span><span>Consulte precio</span></div>
    <div><span>Tipo de mástil</span><span>Ventas</span></div>
    <div><span>Capacidad de carga</span><span>Solicite información</span></div>
    <h2>Contacto</h2>
    <div><span>Altura de elevación</span><span>5 m</span></div>
    <div><span>Tipo de mástil</span><span>Tríplex</span></div>
    <div><span>Capacidad de carga</span><span>1200 kg</span></div>
  </body></html>`, url);
  assert.equal(result.specs?.["Altura de elevación"], undefined);
  assert.equal(result.specs?.["Tipo de mástil"], undefined);
  assert.equal(result.specs?.["Capacidad de carga"], undefined);
});

test("Mercaeleva: no duplica una descripción única ni inventa datos ausentes", () => {
  const result = parseMercaelevaProduct(`<html><body><h1>MB ESL122 Apilador Eléctrico</h1>
    <h2>Machine description</h2><p>Apilador eléctrico revisado.</p></body></html>`, url);
  assert.equal(result.longDescription, "Apilador eléctrico revisado.");
  assert.equal(result.shortDescription, null);
  assert.equal(result.specs?.["Altura de elevación"], undefined);
  assert.equal(result.price, null);
});
