import assert from "node:assert/strict";
import test from "node:test";
import type { ProductRecord } from "../../../../contracts/catalog.js";
import { resolveEditorialSource, verifiedUnbrandedEditorialSource } from "../domain/editorial-source.js";
import { verifiedEditorialUrl } from "../domain/editorial-source-url.js";
import {
  controlledGamForklift, controlledGomarizPlatform, controlledMercaelevaForklift
} from "./editorial-contract-records.js";

const factories = [controlledGamForklift, controlledGomarizPlatform, controlledMercaelevaForklift];

test("las tres procedencias admiten sus rutas legítimas sin cruzar proveedores", () => {
  for (const factory of factories) {
    const record = factory();
    assert.ok(resolveEditorialSource(record), record.providerId);
    const changed: ProductRecord = { ...record, providerId: record.providerId === "gam" ? "gomariz" : "gam" };
    assert.equal(resolveEditorialSource(changed), null);
  }
});

test("las URLs editoriales rechazan credenciales, esquemas, puertos y parámetros no acreditados", () => {
  for (const factory of factories) {
    const record = factory();
    const url = new URL(record.url);
    const username = new URL(url);
    username.username = "invitado";
    const password = new URL(url);
    password.username = "invitado";
    password.password = "clave";
    const port = new URL(url);
    port.port = "8443";
    for (const sourceUrl of [
      url.href.replace(/^https:/u, "http:"),
      username.href,
      password.href,
      port.href,
      `${url.href}?origen=otro`,
      `${url.href}#fragmento`,
      url.href.replace(url.hostname, "example.invalid"),
      `https://${url.hostname}.example.invalid${url.pathname}`
    ]) {
      assert.equal(resolveEditorialSource({ ...record, url: sourceUrl }), null, `${record.providerId} | ${sourceUrl}`);
    }
  }
  assert.equal(verifiedEditorialUrl("no es una url", ["online.gamrentals.com"]), null);
});

test("la referencia de unidad debe coincidir con la ruta del anuncio en GAM y Mercaeleva", () => {
  for (const source of [controlledGamForklift(), controlledMercaelevaForklift()]) {
    assert.ok(resolveEditorialSource(source));
    assert.equal(resolveEditorialSource({ ...source, reference: "OTRO-IDENTIFICADOR" }), null);
    assert.ok(resolveEditorialSource({ ...source, reference: "NUEVA-UNIDAD",
      url: source.url.replace(source.reference ?? "", "NUEVA-UNIDAD") }));
  }
});

test("el slug de Gomariz distingue modelos vecinos y admite separadores equivalentes", () => {
  const record = controlledGomarizPlatform();
  assert.ok(resolveEditorialSource(record));
  assert.equal(resolveEditorialSource({ ...record, url: record.url.replace("modelo10", "modelo100") }), null);
  assert.equal(resolveEditorialSource({ ...record, url: record.url.replace("modelo10", "xmodelo10") }), null);
  assert.ok(resolveEditorialSource({ ...record, url: record.url.replace("modelo10", "modelo-10") }));
  assert.ok(resolveEditorialSource({ ...record, url: record.url.replace("modelo10", "modelo_10") }));
  assert.equal(resolveEditorialSource({ ...record, url: record.url.replace("modelo10", "modelo10x") }), null);
  const electricModel = { ...record, model: "AS1212", title: "Plataforma de tijera eléctrica MARCA AS1212",
    url: "https://www.gomarizrent.com/elevacion-y-trabajos-en-altura/elevador-tijera/marca-as1212e-1/" };
  assert.ok(resolveEditorialSource(electricModel));
  assert.equal(resolveEditorialSource({ ...electricModel, specs: { ...electricModel.specs, Motor: "Diésel" } }), null);
  const gluedFamily = { ...record, model: "SS0507E", title: "Plataforma de tijera eléctrica MARCA SS0507E",
    url: "https://www.gomarizrent.com/venta/elevacion-y-trabajos-en-altura/elevador-tijera/marca-ss0507etijera-electrica/" };
  assert.ok(resolveEditorialSource(gluedFamily));
  const next = { ...record, model: "MODELO11", title: "Plataforma de tijera eléctrica MARCA MODELO11",
    url: record.url.replace("modelo10", "modelo11"), specs: { ...record.specs, Modelo: "MODELO11" } };
  assert.ok(resolveEditorialSource(next));
});

test("las unidades sin marca conservan su procedencia estricta y no heredan otra referencia", () => {
  for (const factory of [controlledGamForklift, controlledMercaelevaForklift]) {
    const branded = factory();
    const originalUrl = branded.providerId === "mercaeleva"
      ? branded.url.replace(`equipo-${branded.reference}`, branded.reference ?? "") : branded.url;
    const source = { ...branded, url: originalUrl, title: "Equipo de ocasión", brand: null, model: null };
    assert.equal(verifiedUnbrandedEditorialSource(source), true, source.providerId);
    assert.equal(verifiedUnbrandedEditorialSource({ ...source, reference: "REFERENCIA-DIFERENTE" }), false);
    assert.equal(verifiedUnbrandedEditorialSource({ ...source, url: `${source.url}?otra=unidad` }), false);
    assert.equal(verifiedUnbrandedEditorialSource({ ...source, url: `https://usuario@${new URL(source.url).host}${new URL(source.url).pathname}` }), false);
  }
});
