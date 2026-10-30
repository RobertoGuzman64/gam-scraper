import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";
import { discardedManainProductUrls } from "../../../catalog/preparation/evidence/providers/manain/discarded-urls.js";
import { toCsv } from "../../../shared/csv.js";
import { baseProductHeaders } from "../../publication/csv-serializer.js";
import { buildManainRecord } from "../manain-record.js";

const productUrl = "https://manain.com/producto/venta-elevacion-tijera-prueba/";
const rows: readonly Record<string, string>[] = [{
  providerId: "manain", categoryKey: "venta", categoryName: "Maquinaria en venta",
  url: productUrl, reference: "REF-1", title: "Plataforma de tijera", condition: "Segunda mano",
  specJson: JSON.stringify({ Marca: "Ejemplo", Peso: "2100 kg" }),
  imagesJson: "[]", breadcrumbsJson: "[]"
}];
const csv = toCsv(rows, baseProductHeaders);
const census = {
  type: "manain-diagnostic-census", providerId: "manain", complete: true, published: false,
  endReason: "control-exhausted", urlCount: 4, urls: [productUrl, ...discardedManainProductUrls]
};
const summary = {
  quality: { status: "partial", published: false },
  totals: { scrapedProducts: 1, discoveredProductUrls: 4, failures: 3 },
  artifacts: { csvSha256: createHash("sha256").update(csv).digest("hex") }
};
const errors = {
  quality: "partial",
  failures: discardedManainProductUrls.map((url) => ({ categoryKey: "venta", url, error: "Ficha inaccesible" }))
};

test("Manain: el registro offline conserva el origen y la revisión sin acreditar un canónico", () => {
  const result = buildManainRecord(csv, summary, errors, census);
  assert.equal(result.quality.status, "partial");
  assert.equal(result.quality.published, false);
  assert.equal(result.products.length, 1);
  assert.equal(result.discardedUrls.length, 3);
  assert.equal(result.products[0]?.original.reference, "REF-1");
  assert.equal(result.products[0]?.original.specs?.Peso, "2100 kg");
  assert.equal(result.products[0]?.prepared.product.reference, "REF-1");
});

test("Manain: el registro rechaza CSV alterado y descartes no autorizados", () => {
  assert.throws(() => buildManainRecord(csv.replace("REF-1", "REF-2"), summary, errors, census), /CSV alterado/);
  const otherErrors = {
    ...errors,
    failures: [
      { categoryKey: "venta", url: "https://manain.com/producto/otro/", error: "Otro error" },
      ...errors.failures.slice(1)
    ]
  };
  assert.throws(() => buildManainRecord(csv, summary, otherErrors, census), /no conciliadas/);
});
