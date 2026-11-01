import assert from "node:assert/strict";
import test from "node:test";
import type { ProductRecord } from "../../../contracts/catalog.js";
import { readCanonicalCatalog } from "../../../infrastructure/filesystem/catalog/canonical-catalog.js";
import { resolveGamVerifiedCommercialShort } from "../mapping/providers/gam/verified-commercial-short.js";
import { prepareSourceProduct } from "../prepare-product.js";

const catalog = await readCanonicalCatalog("catalogs/providers/gam/original/scrape-gam-marzo-2026-catalog.json");
const refs = [
  "6901", "6984", "6139", "6846", "6391", "6893", "6502", "6644", "6679", "6704",
  "5227", "2260", "2335", "4388", "2104", "1884", "1885", "1886", "1022", "2138"
] as const;

const find = (reference: string): ProductRecord => {
  const record = catalog.products.find((candidate) => candidate.reference === reference);
  assert.ok(record, reference);
  return record;
};

const normalize = (value: string): string => value.normalize("NFD")
  .replace(/[\u0300-\u036f]/gu, "").toLowerCase().replace(/[^a-z0-9]/gu, "");

test("sustituye 20 anuncios comerciales por resúmenes técnicos atribuidos a su fuente", () => {
  assert.equal(new Set(refs).size, 20);
  for (const reference of refs) {
    const record = find(reference);
    const original = JSON.stringify(record);
    const revised = resolveGamVerifiedCommercialShort(record);
    assert.ok(revised, reference);
    assert.match(record.shortDescription ?? "", /➨|⭐/u, reference);
    assert.doesNotMatch(revised, /➨|⭐|venta de|mejor precio/iu, reference);
    assert.ok(record.model && normalize(revised).includes(normalize(record.model)), reference);
    assert.ok(record.brand && normalize(revised).includes(normalize(record.brand)), reference);
    const prepared = prepareSourceProduct(record);
    assert.equal(prepared.product.description, revised, reference);
    assert.equal(JSON.stringify(record), original, reference);
    assert.deepEqual(prepared.product.spec, prepareSourceProduct({ ...record }).product.spec, reference);
    assert.equal(prepared.status, "ready", reference);
  }
});

test("preserva la advertencia documental de la unidad Haulotte y las variantes de motores", () => {
  assert.match(prepareSourceProduct(find("6893")).product.description ?? "", /documentaci[oó]n original/iu);
  assert.match(prepareSourceProduct(find("1022")).product.description ?? "", /litio/iu);
  assert.match(prepareSourceProduct(find("1886")).product.description ?? "", /40\.000 kg/iu);
  assert.equal(resolveGamVerifiedCommercialShort(find("2148")), null);
});

test("no atribuye textos acreditados cuando cambia la identidad o el contenido del anuncio", () => {
  for (const reference of refs) {
    const record = find(reference);
    const variants: readonly ProductRecord[] = [
      { ...record, providerId: "gomariz" },
      { ...record, reference: "OTRA" },
      { ...record, url: `${record.url}?variant=1` },
      { ...record, title: "Otra máquina" },
      { ...record, brand: "OTRA" },
      { ...record, model: "OTRO" },
      { ...record, categoryKey: "otra-categoria" },
      { ...record, condition: record.condition === "Nuevo" ? "Segunda mano" : "Nuevo" },
      { ...record, externalReference: "OTRA" },
      { ...record, shortDescription: "Texto del proveedor actualizado" },
      { ...record, longDescription: "Ficha técnica actualizada" },
      { ...record, specs: { ...record.specs, Modelo: "OTRO" } }
    ];
    for (const variant of variants) {
      assert.equal(resolveGamVerifiedCommercialShort(variant), null, reference);
    }
  }
});
