import assert from "node:assert/strict";
import test from "node:test";
import { parsePrepareOptions } from "../prepare.js";

const valid = ["gam", "--source", "storage/scraped/gam/scrape-gam-catalog.json"];

test("prepare conserva parámetros explícitos y resuelve salida offline por defecto", () => {
  const parsed = parsePrepareOptions(valid);
  assert.equal(parsed.providerId, "gam");
  assert.match(parsed.out, /storage[/\\]prepared[/\\]gam[/\\]scrape-gam-preparation\.json$/);
  assert.equal(parsed.dryRun, false);
  assert.equal(parsed.compare, null);
  const compared = parsePrepareOptions([...valid, "--dry-run", "--compare", "old-preparation.json"]);
  assert.equal(compared.dryRun, true);
  assert.match(compared.compare ?? "", /old-preparation\.json$/);
});

test("prepare rechaza flags repetidos, fuentes no canónicas y salidas inválidas", () => {
  assert.throws(() => parsePrepareOptions(["gam"]), /--source/);
  assert.throws(() => parsePrepareOptions(["gam", "--source", "listado.csv"]), /--source/);
  assert.throws(() => parsePrepareOptions([...valid, "--dry-run", "--dry-run"]), /repetido/);
  assert.throws(() => parsePrepareOptions([...valid, "--source", "otro-catalog.json"]), /repetida/);
  assert.throws(() => parsePrepareOptions([...valid, "--compare", "other.json"]), /--compare/);
  assert.throws(() => parsePrepareOptions([...valid, "--out", "bad.txt"]), /--out/);
  assert.throws(() => parsePrepareOptions([...valid, "--foo"]), /desconocida/);
});
