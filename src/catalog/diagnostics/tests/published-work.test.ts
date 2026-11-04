import assert from "node:assert/strict";
import test from "node:test";
import type { ProductRecord } from "../../../contracts/catalog.js";
import type { ImportCandidate } from "../../legacy-export/contracts.js";
import { measurePublishedWork } from "../published-work.js";

const original = (reference: string): ProductRecord => ({
  providerId: "gam", categoryKey: "venta", categoryName: "Maquinaria",
  url: `https://example.test/${reference}`, reference, title: "Máquina",
  shortDescription: null, longDescription: "Máquina en venta", price: "20.500,00 €",
  condition: "Segunda mano", brand: null, model: null, year: null, location: null,
  country: null, horometer: null, serialNumber: null, image: null, images: [], specs: { "Carga Máxima (kg)": "500" }
});

const published = (record: ProductRecord): ImportCandidate => ({
  providerId: record.providerId, sourceUrl: record.url, reference: record.reference,
  title: record.title, categorySellID: null, category: record.categoryName,
  condition: "Segunda_Mano", price: 20500, description_title: record.title,
  description: record.shortDescription, description_general: record.longDescription,
  image: null, images: [], spec: { "Carga Máxima (kg)": "500" }, attributes: []
});

test("mide solo publicadas y separa nuevas specs, textos y cambios comerciales sin duplicar máquinas", () => {
  const a = original("A");
  const b = original("B");
  const excluded = original("C");
  const finalA = { ...published(a), title: "Máquina identificada", description: "Equipo de ocasión",
    spec: { "Carga Máxima (kg)": "550", "Velocidad máxima sin carga (km/h)": "10" }, price: 21000 };
  const work = measurePublishedWork([a, b, excluded], [published(b), finalA]);
  assert.equal(work.originalProducts, 3);
  assert.equal(work.publishedProducts, 2);
  assert.equal(work.excludedProducts, 1);
  assert.equal(work.processedProducts, 2);
  assert.equal(work.transformedProducts, 1);
  assert.equal(work.specificationsAdded, 1);
  assert.equal(work.specificationValuesChanged, 1);
  assert.equal(work.titlesTransformed, 1);
  assert.equal(work.descriptionsGenerated, 1);
  assert.equal(work.pricesChanged, 1);
  assert.equal(work.conditionsChanged, 0);
});

test("una diferencia solo de categoría o galería cuenta como máquina transformada", () => {
  const a = original("A");
  const work = measurePublishedWork([a], [{ ...published(a), category: "Otra categoría",
    images: ["https://example.test/photo.png"] }]);
  assert.equal(work.transformedProducts, 1);
  assert.equal(work.categoriesChanged, 1);
  assert.equal(work.galleriesChanged, 1);
  assert.equal(work.specificationsAdded, 0);
});

test("no confunde formato de precio con cambio comercial", () => {
  const a = original("A");
  const work = measurePublishedWork([a], [published(a)]);
  assert.equal(work.pricesChanged, 0);
  assert.equal(work.transformedProducts, 0);
});

test("protege identidad, procedencia y duplicados", () => {
  const a = original("A");
  const final = published(a);
  assert.throws(() => measurePublishedWork([a], [{ ...final, reference: "B" }]), /sin origen/);
  assert.throws(() => measurePublishedWork([a], [{ ...final, sourceUrl: "https:\/\/example.test\/B" }]), /sin origen/);
  assert.throws(() => measurePublishedWork([a], [final, final]), /duplicada/);
  assert.throws(() => measurePublishedWork([a, a], [final]), /duplicada/);
});
