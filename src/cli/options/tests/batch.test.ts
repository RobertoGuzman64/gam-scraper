import assert from "node:assert/strict";
import test from "node:test";
import { describeBatch } from "../../../pipeline/batch/run.js";
import { parseBatchOptions } from "../batch.js";
import { listProviders } from "../../../scraping/registry.js";

test("selecciona todos los proveedores registrados y usa sus prefijos reales", () => {
  const parsed = parseBatchOptions([]);
  assert.notEqual(parsed, "help");
  if (parsed === "help") return;
  assert.deepEqual(parsed.providerIds, listProviders());
  assert.deepEqual(describeBatch(parsed).map((provider) => provider.providerId), listProviders());
  assert.ok(describeBatch(parsed).every((provider) => provider.outputPrefix.length > 0));
});

test("permite un subconjunto ordenado sin alterar los proveedores disponibles", () => {
  const parsed = parseBatchOptions(["--providers", "gomariz,gam", "--outRoot", "outputs", "--historyDir", "runs"]);
  assert.notEqual(parsed, "help");
  if (parsed === "help") return;
  assert.deepEqual(parsed.providerIds, ["gomariz", "gam"]);
  assert.equal(parsed.outRoot, "outputs");
  assert.equal(parsed.historyDir, "runs");
});

test("rechaza proveedores inexistentes, repetidos y argumentos ambiguos", () => {
  assert.throws(() => parseBatchOptions(["--providers", "no-existe"]), /Proveedor no registrado/);
  assert.throws(() => parseBatchOptions(["--providers", "gam,gam"]), /duplicados/);
  assert.throws(() => parseBatchOptions(["--providers", "gam,"]), /requiere una lista/);
  assert.throws(() => parseBatchOptions(["--providers"]), /Falta valor/);
  assert.throws(() => parseBatchOptions(["--maxPages", "2"]), /no reconocido/);
  assert.throws(() => parseBatchOptions(["--dry-run", "--dry-run"]), /duplicado/);
  assert.equal(parseBatchOptions(["--help"]), "help");
});
