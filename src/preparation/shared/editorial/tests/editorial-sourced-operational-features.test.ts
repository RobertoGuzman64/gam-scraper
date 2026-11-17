import assert from "node:assert/strict";
import test from "node:test";
import type { ProductRecord } from "../../../../contracts/catalog.js";
import { accreditedSourceRecord } from "../../../../testing/domain-cases/accredited-source-samples.js";
import { prepareSourceProduct } from "../../../prepare-product.js";
import { resolveSourcedOperationalFeatures } from "../domain/editorial-sourced-operational-features.js";

const source = (reference: string): ProductRecord => accreditedSourceRecord("gam-original", reference);

const expectedFeatures: Readonly<Record<string, RegExp>> = {
  "4742": /control proporcional/u,
  "4800": /control proporcional/u,
  "4750": /control proporcional/u,
  "4751": /control proporcional/u,
  "4772": /control proporcional/u,
  "4777": /control proporcional/u,
  "4776": /control proporcional/u,
  "5900": /control proporcional y sistema hidr[aá]ulico/u,
  "5902": /control proporcional y sistema hidr[aá]ulico/u,
  "4794": /control proporcional/u,
  "4791": /control proporcional/u,
  "2022": /comunicaci[oó]n CANbus y sistema hidr[aá]ulico/u,
  "31": /comunicaci[oó]n CANbus/u,
  "2109": /comunicaci[oó]n CANbus/u,
  "2108": /comunicaci[oó]n CANbus y motor el[eé]ctrico sin escobillas/u,
  "2175": /motor el[eé]ctrico sin escobillas/u
};

test("recupera características de control documentadas por cada fuente sin acreditarlas como instaladas", () => {
  for (const [reference, feature] of Object.entries(expectedFeatures)) {
    const record = source(reference);
    const snapshot = JSON.stringify(record);
    const prepared = prepareSourceProduct(record);
    const general = prepared.product.description_general ?? "";
    assert.match(general, feature, reference);
    assert.match(general, /cuya disponibilidad y configuraci[oó]n deben comprobarse/u, reference);
    assert.equal(prepared.product.sourceUrl, record.url, reference);
    assert.equal(JSON.stringify(record), snapshot, reference);
  }
});

test("rechaza unidad, modelo, familia, proveedor y origen no autenticado y no duplica información", () => {
  const record = source("2108");
  const prepared = prepareSourceProduct(record).product.description_general ?? "";
  const base = prepared.split(" La descripción del proveedor menciona ")[0] ?? "";
  assert.equal(resolveSourcedOperationalFeatures(record, record, base, true), prepared);
  assert.equal(resolveSourcedOperationalFeatures(record, record, prepared, true), null);
  const others: readonly ProductRecord[] = [
    { ...record, reference: "OTRA-UNIDAD" },
    { ...record, model: "S1.6UTS" },
    { ...record, brand: "YALE" },
    { ...record, url: "https://example.invalid/otra-unidad" },
    { ...record, condition: "Segunda mano" },
    { ...record, title: "Plataforma articulada Hyster S1.5UTS" }
  ];
  for (const variant of others) {
    assert.equal(resolveSourcedOperationalFeatures(record, variant, base, true), null);
  }
  assert.equal(resolveSourcedOperationalFeatures(record, { ...record, providerId: "gomariz" }, base, false), null);
  assert.equal(resolveSourcedOperationalFeatures(record, record, base, false), null);
  assert.equal(resolveSourcedOperationalFeatures({ ...record, longDescription: null }, record, base, true), null);
});

test("no transforma opciones o ausencias en equipamiento de una unidad", () => {
  const record = source("2108");
  const prepared = prepareSourceProduct(record).product.description_general ?? "";
  const base = prepared.split(" La descripción del proveedor menciona ")[0] ?? "";
  const sourceText = record.longDescription ?? "";
  const uncertain = sourceText.replace(/\bCANbus\b/gu, "CANbus opcional")
    .replace(/motor\s+el[eé]ctrico\s+AC\s+sin\s+escobillas/giu, "motor eléctrico AC sin escobillas opcional");
  assert.equal(resolveSourcedOperationalFeatures({ ...record, longDescription: uncertain }, record, base, true), null);
  const already = `${base} La comunicación CANbus y el motor sin escobillas se describen en el origen.`;
  assert.equal(resolveSourcedOperationalFeatures(record, record, already, true), null);
});
