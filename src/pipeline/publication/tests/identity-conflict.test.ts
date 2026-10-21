import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { writeOutputs } from "../publish.js";
import type { ProductRecord } from "../../../contracts/catalog.js";

const category = { key: "venta", name: "Maquinaria en venta", url: "https://example.com/venta" };
const time = "2026-10-20T10:00:00Z";

const product = (reference: string, url: string): ProductRecord => ({
  providerId: "gomariz", categoryKey: "venta", categoryName: "Maquinaria en venta", url,
  title: "LGMG", shortDescription: null, longDescription: null, price: null,
  reference, brand: "LGMG", model: "S0812", year: null, location: null,
  country: null, horometer: null, serialNumber: null, image: null, specs: {}
});

const first = product("TE1000", "https://example.com/machine/a");
const second = product("TE1000", "https://example.com/machine/b");

test("una colisión bloquea la publicación y conserva CSV y snapshot anteriores", async () => {
  const dir = await mkdtemp(join(tmpdir(), "scraper-identity-conflict-"));
  try {
    await writeOutputs(dir, "lote", [{ category, discoveredProductUrls: 1, products: [first], failures: [] }], time, time);
    const previousCsv = await readFile(join(dir, "lote-all.csv"), "utf8");
    await assert.rejects(writeOutputs(dir, "lote", [{
      category, discoveredProductUrls: 2, products: [first, second], failures: []
    }], time, time), /Extracción blocked/);
    assert.equal(await readFile(join(dir, "lote-all.csv"), "utf8"), previousCsv);
    const errors: unknown = JSON.parse(await readFile(join(dir, "lote-errors.json"), "utf8"));
    assert.ok(errors !== null && typeof errors === "object" && "identityConflicts" in errors &&
      Array.isArray(errors.identityConflicts) && errors.identityConflicts.length === 1);
    const changes = await readFile(join(dir, "lote-changes.json"), "utf8");
    assert.match(changes, /not-comparable/);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});


test("serie compartida conserva ambas referencias y deja un aviso auditable sin bloquear catálogo", async () => {
  const dir = await mkdtemp(join(tmpdir(), "scraper-serial-"));
  try {
    const a = { ...first, providerId: "gam", serialNumber: "P177B10585U" };
    const b = { ...second, providerId: "gam", reference: "TE2000", serialNumber: "p177b10585u" };
    await writeOutputs(dir, "lote", [{ category, discoveredProductUrls: 2, products: [a, b], failures: [] }], time, time);
    const csv = await readFile(join(dir, "lote-all.csv"), "utf8");
    assert.match(csv, /TE1000/);
    assert.match(csv, /TE2000/);
    const summary = JSON.parse(await readFile(join(dir, "lote-summary.json"), "utf8"));
    assert.equal(summary.quality.status, "complete");
    assert.equal(summary.totals.scrapedProducts, 2);
    assert.equal(summary.quality.published, true);
    assert.equal(summary.quality.reasons.length, 1);
    const errors = JSON.parse(await readFile(join(dir, "lote-errors.json"), "utf8"));
    assert.deepEqual(errors.identityConflicts, []);
    assert.equal(errors.serialWarnings.length, 1);
    assert.match(errors.serialWarnings[0], /TE1000.*TE2000/);
    const prepared = JSON.parse(await readFile(join(dir, "lote-preparation.json"), "utf8"));
    assert.equal(prepared.totals.review, 2);
    assert.ok(prepared.products.every((product: { status: string; issues: string[] }) =>
      product.status === "review" && product.issues.some((issue) => issue.includes("Número de serie"))));
    assert.match(await readFile(join(dir, "lote-changes.json"), "utf8"), /comparable/);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
