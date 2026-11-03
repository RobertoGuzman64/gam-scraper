import assert from "node:assert/strict";
import test from "node:test";
import type { ProductRecord } from "../../../../../../contracts/catalog.js";
import { readCanonicalCatalog } from "../../../../../../infrastructure/filesystem/catalog/canonical-catalog.js";
import { removeGamResidualEditorialArtifacts } from "../../../../mapping/providers/gam/editorial-descriptions/long-description.js";
import { removeGomarizConversationalLead } from "../../../../mapping/providers/gomariz/residual-general.js";
import { resolveGamAdditionalCondensedGeneral, resolveGamAdditionalCondensedShort } from "../../../../mapping/providers/gam/editorial-descriptions/verified-condensed-additional.js";
import { prepareSourceProduct } from "../../../../prepare-product.js";

const gam = await readCanonicalCatalog("catalogs/providers/gam/original/scrape-gam-catalog.json");
const gomariz = await readCanonicalCatalog("catalogs/providers/gomariz/original/scrape-gomariz-catalog.json");

const find = (products: readonly ProductRecord[], reference: string): ProductRecord => {
  const result = products.find((record) => record.reference === reference);
  assert.ok(result, reference);
  return result;
};

const responseReferences = ["5", "2082", "6", "4626", "6332", "2373", "6020", "2087", "2046"] as const;
const generatorReferences = ["1210", "1211", "1212", "1213", "1214"] as const;

test("limpia respuestas sin pregunta, sin alterar características técnicas", () => {
  for (const reference of responseReferences) {
    const record = find(gam.products, reference);
    const original = JSON.stringify(record);
    const prepared = prepareSourceProduct(record);
    const general = prepared.product.description_general;
    assert.ok(general);
    assert.notEqual(general, record.longDescription, reference);
    assert.doesNotMatch(general, /(?<=\.)\s+(?:Sí|No)\.\s+(?=[A-ZÁÉÍÓÚÑ])/gu, reference);
    assert.deepEqual(prepared.product.spec,
      prepareSourceProduct({ ...record }).product.spec, reference);
    assert.equal(JSON.stringify(record), original, reference);
  }
});

test("PRAMAC elimina etiquetas vacías sin retirar la referencia al panel", () => {
  for (const reference of generatorReferences) {
    const record = find(gam.products, reference);
    const general = prepareSourceProduct(record).product.description_general;
    assert.ok(general);
    assert.equal(general, resolveGamAdditionalCondensedGeneral(record) ?? general, reference);
    assert.ok(general.includes("panel") || general.includes("carrocería"), reference);
    assert.doesNotMatch(general, /Instrumentación: Comandos: Protección con alarma: Protecciones con paro:/u);
    assert.ok(general.includes(record.model ?? "INVALID"), reference);
  }
});

test("Gomariz elimina el prefacio conversacional solo para la ficha acreditada", () => {
  const record = find(gomariz.products, "1011JFB");
  const general = prepareSourceProduct(record).product.description_general;
  assert.ok(general);
  const suffix = ` Año de fabricación de esta unidad: ${record.year}.`;
  assert.equal(general.endsWith(suffix) ? general.slice(0, -suffix.length) : general, record.longDescription?.slice("Claro. ".length));
  const variations: readonly ProductRecord[] = [
    { ...record, reference: "OTRA" },
    { ...record, model: "PREMIUM 320" },
    { ...record, brand: "Scania" },
    { ...record, url: `${record.url}?test=1` },
    { ...record, title: "RENAULT PREMIUM 400" },
    { ...record, longDescription: "Claro. Otra máquina." },
    { ...record, providerId: "gam" }
  ];
  for (const candidate of variations) {
    assert.equal(removeGomarizConversationalLead(candidate, candidate.longDescription ?? null), null);
  }
});

test("rechaza identidades cruzadas, URLs manipuladas y textos modificados", () => {
  for (const reference of [...responseReferences, ...generatorReferences]) {
    const record = find(gam.products, reference);
    const variations: readonly ProductRecord[] = [
      { ...record, providerId: "gomariz" },
      { ...record, reference: "MAL" },
      { ...record, brand: "OTRA" },
      { ...record, model: "MODELO-AJENO" },
      { ...record, specs: { ...record.specs, Modelo: "MODELO-AJENO" } },
      { ...record, url: `${record.url}?utm=1` },
      { ...record, url: record.url.replace("online.gamrentals.com", "example.com") },
      { ...record, title: "Otro equipo" },
      { ...record, longDescription: "Descripción alternativa sin residuos." }
    ];
    for (const candidate of variations) {
      assert.equal(removeGamResidualEditorialArtifacts(candidate, candidate.longDescription ?? null), null, reference);
    }
  }
});

test("conserva respuestas válidas asociadas a preguntas explícitas", () => {
  for (const reference of ["2031", "22", "4655", "4660"]) {
    const records = gam.products;
    const record = find(records, reference);
    const prepared = prepareSourceProduct(record);
    const general = prepared.product.description_general;
    assert.ok(general);
    assert.equal(removeGamResidualEditorialArtifacts(record, general), null);
    assert.match(record.longDescription ?? "", /\?\s+(?:Sí|No)\./u);
    if (reference === "4655") {
      assert.match(general, /CTE TRACCESS 135/u);
      assert.match(general, /13,5 metros/u);
      assert.match(general, /200 kg/u);
      assert.doesNotMatch(general, /\?\s+(?:Sí|No)\./u);
    } else if (reference === "2031" || reference === "4660") {
      assert.ok(general.includes(record.model ?? "INVALID"), reference);
      assert.doesNotMatch(general, /\?\s+(?:Sí|No)\./u);
    } else {
      assert.match(general, /Hyster J1\.6XN/u);
      assert.match(general, /1600 KG/u);
      assert.match(general, /48V \/ 625Ah/u);
      assert.doesNotMatch(general, /\?\s+(?:Sí|No)\./u);
    }
  }
});
