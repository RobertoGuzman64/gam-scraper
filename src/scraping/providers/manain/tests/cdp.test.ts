import assert from "node:assert/strict";
import test from "node:test";
import { classifyManainCatalogState, parseManainListingProgressEvent, manainCdpPort, parseManainPageState, selectManainTarget } from "../cdp.js";

const port = 9227;
const catalog = "https://manain.com/catalogo/venta/";
const product = "https://manain.com/producto/venta-elevacion-mastil-lgmg-m0810je-3/";
const target = (id: string, url: string, endpoint = `ws://127.0.0.1:${port}/devtools/page/${id}`) => ({
  id, url, type: "page", webSocketDebuggerUrl: endpoint
});

test("Manain CDP: conecta únicamente con pestañas locales y limita la sesión a Manain", () => {
  const entries = [
    target("untrusted", catalog, "ws://192.168.1.10:9227/devtools/page/untrusted"),
    target("unrelated", "https://example.com/"),
    target("catalog", catalog),
    target("frame", catalog, `ws://127.0.0.1:${port}/devtools/page/frame`)
  ];
  assert.equal(selectManainTarget(entries, port).id, "catalog");
  assert.equal(selectManainTarget([target("challenge", "https://manain.com/cdn-cgi/challenge-platform/h/g/orchestrate/")], port).id, "challenge");
  assert.equal(selectManainTarget([target("catalog", product)], port, "catalog").url, product);
  assert.throws(() => selectManainTarget([target("catalog", "https://example.com/")], port, "catalog"), /cambió de sitio/);
  assert.throws(() => selectManainTarget([target("catalog", catalog, "ws://example.com:9227/devtools/page/catalog")], port), /Abre el catálogo/);
  assert.throws(() => selectManainTarget([], port), /Abre el catálogo/);
});

test("Manain CDP: solo acepta eventos de progreso válidos para el censo", () => {
  assert.deepEqual(parseManainListingProgressEvent({
    method: "Runtime.bindingCalled", params: { name: "__equipzillaManainListingProgress", payload: '{"pages":3,"found":27}' }
  }), { pages: 3, found: 27 });
  assert.equal(parseManainListingProgressEvent({
    method: "Runtime.bindingCalled", params: { name: "otraBinding", payload: '{"pages":3,"found":27}' }
  }), null);
  assert.equal(parseManainListingProgressEvent({
    method: "Runtime.bindingCalled", params: { name: "__equipzillaManainListingProgress", payload: '{"pages":0,"found":-1}' }
  }), null);
  assert.equal(parseManainListingProgressEvent({
    method: "Runtime.bindingCalled", params: { name: "__equipzillaManainListingProgress", payload: "no-json" }
  }), null);
});

test("Manain CDP: exige un puerto local explícito y válido", () => {
  const original = process.env.MANAIN_CDP_PORT;
  try {
    delete process.env.MANAIN_CDP_PORT;
    assert.equal(manainCdpPort(), null);
    process.env.MANAIN_CDP_PORT = "9227";
    assert.equal(manainCdpPort(), 9227);
    for (const invalid of ["https://127.0.0.1:9227", "0", "65536", "abc", "9227x"]) {
      process.env.MANAIN_CDP_PORT = invalid;
      assert.throws(() => manainCdpPort(), /puerto local válido/);
    }
  } finally {
    if (original === undefined) delete process.env.MANAIN_CDP_PORT;
    else process.env.MANAIN_CDP_PORT = original;
  }
});

test("Manain CDP: no da por cargada una ficha sin evidencia de SKU", () => {
  assert.deepEqual(parseManainPageState({ url: product, ready: true, hasSku: true, challenge: false }), {
    url: product, ready: true, hasSku: true, challenge: false
  });
  assert.deepEqual(parseManainPageState({ url: product, ready: true, hasSku: false, challenge: true }), {
    url: product, ready: true, hasSku: false, challenge: true
  });
  assert.throws(() => parseManainPageState({ url: product, ready: true }), /inválido/);
});

test("Manain CDP: espera la verificación aunque cambie temporalmente la URL", () => {
  const page = { url: catalog, ready: true, hasSku: false, challenge: false };
  assert.equal(classifyManainCatalogState(page), "ready");
  assert.equal(classifyManainCatalogState({ ...page, ready: false }), "loading");
  assert.equal(classifyManainCatalogState({ ...page, url: "about:blank" }), "loading");
  assert.equal(classifyManainCatalogState({ ...page, challenge: true }), "challenge");
  assert.equal(classifyManainCatalogState({ ...page, url: "https://manain.com/cdn-cgi/challenge-platform/h/g/orchestrate/" }), "challenge");
  assert.equal(classifyManainCatalogState({ ...page, url: "https://manain.com/otra-pagina/" }), "unexpected");
  assert.equal(classifyManainCatalogState({ ...page, url: "https://example.com/" }), "unexpected");
});
