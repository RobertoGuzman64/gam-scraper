import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";
import { parseCanonicalCatalog } from "../../canonical-catalog.js";
import { buildProductIdentity } from "../../identity.js";
import type { ProductRecord } from "../../../contracts/catalog.js";
import { applyInterventionToCatalog } from "../application.js";
import type { ManualInterventionProposal } from "../contracts.js";
import { simulateIntervention } from "../simulation.js";

const original: ProductRecord = {
  providerId: "gam", categoryKey: "elevacion", categoryName: "Elevación",
  url: "https://proveedor.example/producto-1", title: "Plataforma",
  shortDescription: "Ficha publicada", longDescription: null, price: "10000",
  reference: "P-1", brand: "Marca", model: "Modelo", year: "2020",
  location: "Valencia", country: "España", horometer: null, serialNumber: "S-1",
  image: "https://proveedor.example/actual.jpg",
  images: ["https://proveedor.example/actual.jpg"]
};

const second: ProductRecord = {
  ...original,
  url: "https://proveedor.example/producto-2", reference: "P-2",
  title: "Carretilla", serialNumber: "S-2",
  image: "https://proveedor.example/segunda.jpg",
  images: ["https://proveedor.example/segunda.jpg"]
};

const catalog = (products: readonly ProductRecord[]) => parseCanonicalCatalog({
  version: 1, providerId: "gam", prefix: "gam-campaign-safety",
  scope: "0123456789abcdef", startedAt: "2026-10-25T10:00:00.000Z",
  endedAt: "2026-10-25T10:02:00.000Z",
  quality: { status: "complete", published: true },
  productCount: products.length, products
});

const digest = (value: string): string => createHash("sha256").update(value).digest("hex");

const proposal = (product: ProductRecord, field: ManualInterventionProposal["field"], expected: string | null, next: string | null): ManualInterventionProposal => ({
  providerId: "gam", identity: buildProductIdentity(product).key,
  field, expected, next,
  reason: "Revisión puntual de una ficha",
  evidence: "Comparación manual con la fuente vigente"
});

test("una ejecución nueva no recupera imágenes de catálogos anteriores", () => {
  const previous = catalog([{ ...original,
    images: ["https://proveedor.example/actual.jpg", "https://proveedor.example/antigua.jpg"]
  }]);
  const current = catalog([original]);
  const input = proposal(original, "shortDescription", original.shortDescription, "Ficha revisada");
  const before = JSON.stringify(current);
  const simulation = simulateIntervention(current, digest("origen-vigente"), [input]);
  const derived = applyInterventionToCatalog(current, simulation);
  assert.equal(previous.products[0]?.images?.length, 2);
  assert.deepEqual(derived.products[0]?.images, current.products[0]?.images);
  assert.equal(derived.products[0]?.image, current.products[0]?.image);
  assert.equal(derived.products[0]?.shortDescription, "Ficha revisada");
  assert.equal(JSON.stringify(current), before);
});

test("una intervención sobre varios productos solo modifica los textos declarados", () => {
  const source = catalog([original, second]);
  const changes = [
    proposal(original, "longDescription", null, "Texto verificado"),
    proposal(second, "title", second.title, "Carretilla revisada")
  ];
  const simulation = simulateIntervention(source, digest("dos-productos"), changes);
  const derived = applyInterventionToCatalog(source, simulation);
  assert.equal(simulation.affectedProducts, 2);
  assert.deepEqual(derived.products, [
    { ...original, longDescription: "Texto verificado" },
    { ...second, title: "Carretilla revisada" }
  ]);
  assert.deepEqual(source.products, [original, second]);
});

test("se rechaza editar galerías, imagen principal y atributos fuera del contrato", () => {
  const source = catalog([original]);
  for (const field of ["image", "images", "serialNumber", "technicalSheetUrl", "specs"]) {
    assert.throws(() => simulateIntervention(source, digest("origen"), [{
      ...proposal(original, "title", original.title, "Texto verificado"), field
    }]), /campo prohibido/);
  }
});

test("la misma referencia no autoriza reutilizar un valor anterior de otra ejecución", () => {
  const previous = catalog([{ ...original, shortDescription: "Texto anterior" }]);
  const current = catalog([original]);
  const stale = proposal(previous.products[0]!, "shortDescription", "Texto anterior", "Texto verificado");
  assert.equal(buildProductIdentity(previous.products[0]!).key, buildProductIdentity(current.products[0]!).key);
  assert.throws(() => simulateIntervention(current, digest("origen-actual"), [stale]), /valor actual no coincide/);
});
