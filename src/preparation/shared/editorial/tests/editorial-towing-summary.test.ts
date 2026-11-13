import assert from "node:assert/strict";
import test from "node:test";
import type { ProductRecord } from "../../../../contracts/catalog.js";
import { prepareSourceProduct } from "../../../prepare-product.js";
import { normalizeEditorialSummary } from "../domain/editorial-normalization.js";
import { normalizeCorroboratedTowingSummary } from "../domain/editorial-towing-summary.js";
import { normalizePreparedEditorialPresentation } from "../mapping/prepared-editorial-presentation.js";
import { controlledGamForklift } from "./editorial-contract-records.js";

const towing = (): ProductRecord => ({
  ...controlledGamForklift(),
  categoryKey: "marcas-nuevas",
  categoryName: "Marcas nuevas",
  reference: "2738",
  url: "https://online.gamrentals.com/es/bts/2738-trailercaddy-terminal-tractor",
  title: "Arrastrador a Pie TrailerCaddy Terminal Tractor TT30K",
  shortDescription: "➨ TrailerCaddy 6k 36v BR nuevo ➨ Venta de arrastrador a pie ⭐Capacidad de arrastre 45300 Kg",
  longDescription: "Levanta hasta 13.600 Kg. Mueve hasta 45.300 Kg Funciona con pasador, gancho o bola de quinta rueda. Sistema alimentado por batería. El TrailerCaddy Terminal Tractor TT30K es una solución para el transporte de cargas pesadas.",
  brand: null,
  model: "TT30K",
  condition: "Nuevo",
  specs: { Modelo: "TT30K", "Capacidad de arrastre": "45300 Kg", "Capacidad de carga (kg)": "13600 KG" }
});

const normalize = (source: ProductRecord): string | null => {
  const prepared = prepareSourceProduct(source).product;
  const summary = normalizeEditorialSummary(source.shortDescription, source.model);
  return normalizeCorroboratedTowingSummary(source, prepared, summary);
};

test("el resumen del arrastrador recupera la variante acreditada sin cambiar la magnitud", () => {
  const original = towing();
  const snapshot = JSON.stringify(original);
  const output = prepareSourceProduct(original).product;
  assert.equal(output.description,
    "TrailerCaddy Terminal Tractor TT30K nuevo. Venta de arrastrador a pie. Capacidad de arrastre 45300 kg");
  assert.equal(output.title, original.title);
  assert.equal(output.spec["Capacidad de arrastre"], "45300 Kg");
  assert.equal(JSON.stringify(original), snapshot);
  assert.deepEqual(normalizePreparedEditorialPresentation(original, output), output);
});

test("las unidades nuevas equivalentes pueden recuperar condición e identidad sin una referencia fija", () => {
  const original = towing();
  const next: ProductRecord = {
    ...original, reference: "NUEVA-UNIDAD",
    url: "https://online.gamrentals.com/es/bts/NUEVA-UNIDAD-trailercaddy-terminal-tractor"
  };
  assert.equal(normalize(next), "TrailerCaddy Terminal Tractor TT30K nuevo. Venta de arrastrador a pie. Capacidad de arrastre 45300 kg");
  const oldCondition: ProductRecord = {
    ...next, shortDescription: "➨ TrailerCaddy Terminal Tractor TT30K Segunda Mano ➨ Venta de arrastrador a pie nuevo ⭐Capacidad de arrastre 45300 Kg"
  };
  assert.equal(normalize(oldCondition),
    "TrailerCaddy Terminal Tractor TT30K nuevo. Venta de arrastrador a pie nuevo. Capacidad de arrastre 45300 kg");
});

test("la comprobación no depende del proveedor cuando se mantiene la evidencia de unidad", () => {
  const source: ProductRecord = { ...towing(), providerId: "mercaeleva", reference: "OTRA-UNIDAD",
    url: "https://sales.mercaeleva.com/es/for-sale/machine/otra-unidad" };
  const original = normalizeEditorialSummary(source.shortDescription, source.model);
  const published = { ...prepareSourceProduct(towing()).product,
    providerId: source.providerId, sourceUrl: source.url, reference: source.reference, condition: "Nuevo" as const };
  assert.equal(normalizeCorroboratedTowingSummary(source, published, original),
    "TrailerCaddy Terminal Tractor TT30K nuevo. Venta de arrastrador a pie. Capacidad de arrastre 45300 kg");
});

test("rechaza procedencias, capacidades, identidades y condiciones contradictorias", () => {
  const original = towing();
  const candidates: readonly ProductRecord[] = [
    { ...original, condition: "Segunda mano" },
    { ...original, model: "TT40K" },
    { ...original, specs: { ...original.specs, Modelo: "TT40K" } },
    { ...original, specs: { ...original.specs, "Capacidad de arrastre": "45000 Kg" } },
    { ...original, longDescription: original.longDescription?.replace("45.300", "40.000") ?? null },
    { ...original, longDescription: `${original.longDescription} El TrailerCaddy 6k 36v BR es una alternativa diferente.` },
    { ...original, shortDescription: "➨ TrailerCaddy 6k 36v BR nuevo ➨ Venta de arrastrador a pie ⭐Capacidad de arrastre 45000 Kg" },
    { ...original, title: "Arrastrador a Pie TrailerCaddy 6k 36v BR" }
  ];
  for (const source of candidates) {
    const raw = normalizeEditorialSummary(source.shortDescription, source.model);
    assert.equal(normalize(source), raw, source.title ?? "sin título");
  }
  const prepared = prepareSourceProduct(original).product;
  const raw = normalizeEditorialSummary(original.shortDescription, original.model);
  assert.equal(normalizeCorroboratedTowingSummary(original, { ...prepared, reference: "OTRA" }, raw), raw);
  assert.equal(normalizeCorroboratedTowingSummary(original, { ...prepared, sourceUrl: "https://otro.example/" }, raw), raw);
  assert.equal(normalizeCorroboratedTowingSummary(original, { ...prepared, condition: "Segunda_Mano" }, raw), raw);
  assert.equal(normalizeCorroboratedTowingSummary(original, { ...prepared, description: "Resumen acreditado diferente" },
    "Resumen acreditado diferente"), "Resumen acreditado diferente");
});
