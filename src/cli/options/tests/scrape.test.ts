import assert from "node:assert/strict";
import test from "node:test";
import { getProvider } from "../../../scraping/registry.js";
import { parseArgs, resolveCliSelection } from "../scrape.js";

test("permite nombres cortos sin alterar la configuración del proveedor", () => {
  const parsed = resolveCliSelection(["gomariz", "--category", "venta", "--pages", "2", "--prefix", "prueba-gomariz"]);
  assert.equal(parsed.provider, getProvider("gomariz"));
  assert.equal(parsed.options.maxPages, 2);
  assert.equal(parsed.options.outPrefix, "prueba-gomariz");
  assert.equal(parsed.mode, "config");
  if (parsed.mode === "config") assert.equal(parsed.categories.length, 1);
});

test("mantiene argumentos largos anteriores y GAM por defecto", () => {
  assert.equal(resolveCliSelection([]).provider.id, "gam");
  assert.equal(resolveCliSelection(["--provider", "gam", "--maxPages", "5"]).options.maxPages, 5);
  assert.equal(parseArgs(["--discoverTree", "false"]).discoverTree, false);
});

test("rechaza errores tipográficos y ambigüedades antes de ejecutar", () => {
  assert.throws(() => resolveCliSelection(["gam", "--pagse", "2"]), /desconocida/);
  assert.throws(() => resolveCliSelection(["gam", "--pages", "abc"]), /entero/);
  assert.throws(() => resolveCliSelection(["gam", "--pages", "0"]), /entero/);
  assert.throws(() => resolveCliSelection(["gam", "--prefix", "uno", "--outPrefix", "dos"]), /duplicada/);
  assert.throws(() => resolveCliSelection(["gam", "gomariz"]), /no reconocido/);
  assert.throws(() => resolveCliSelection(["gam", "--rootUrl", "https://example.com"]), /requiere --discoverTree/);
});
