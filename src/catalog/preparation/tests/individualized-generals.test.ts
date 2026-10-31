import assert from "node:assert/strict";
import test from "node:test";
import type { ProductRecord } from "../../../contracts/catalog.js";
import { readCanonicalCatalog } from "../../../infrastructure/filesystem/catalog/canonical-catalog.js";
import { resolveGamIndividualizedGeneral } from "../mapping/providers/gam/individualized-general.js";
import { resolveGomarizIndividualizedGeneral } from "../mapping/providers/gomariz/individualized-general.js";
import { prepareSourceProduct } from "../prepare-product.js";

const gam = await readCanonicalCatalog("catalogs/providers/gam/original/scrape-gam-marzo-2026-catalog.json");
const gomariz = await readCanonicalCatalog("catalogs/providers/gomariz/original/scrape-gomariz-catalog.json");
const gamReferences = new Set(["6688", "6689", "6690", "1210", "1211", "1212", "1213", "1214", "1217", "1219"]);
const gomarizReferences = new Set(["GR1356", "GR1113", "TO1242", "TO1245", "RO457", "GR1681", "GR1680", "GR1679"]);

const find = (records: readonly ProductRecord[], reference: string): ProductRecord => {
  const record = records.find((entry) => entry.reference === reference);
  assert.ok(record, reference);
  return record;
};

test("Fase 8: diferencia 18 fichas con evidencias propias sin modificar los originales", () => {
  const changed = new Set<string>();
  for (const [catalog, resolve] of [
    [gam, resolveGamIndividualizedGeneral],
    [gomariz, resolveGomarizIndividualizedGeneral]
  ] as const) {
    for (const record of catalog.products) {
      const before = JSON.stringify(record);
      const text = resolve(record);
      if (text !== null) {
        assert.ok(record.reference);
        changed.add(record.reference);
        assert.ok(text.includes(record.providerId === "gam" && !record.brand ?
          record.title?.trim() ?? "" : record.model?.trim() ?? record.title?.trim() ?? ""));
        const prepared = prepareSourceProduct(record).product;
        assert.equal(prepared.description_general, text, record.reference);
        assert.equal(prepared.sourceUrl, record.url);
        assert.equal(prepared.reference, record.reference);
        assert.deepEqual(prepared.spec, record.specs);
      }
      assert.equal(JSON.stringify(record), before);
    }
  }
  assert.equal(gam.products.length, 983);
  assert.equal(gomariz.products.length, 143);
  assert.deepEqual(changed, new Set([...gamReferences, ...gomarizReferences]));
});

test("GAM: diferencia generadores por motor, peso y dimensiones sin asumir la potencia aparente", () => {
  const motor = find(gam.products, "1212");
  const general = resolveGamIndividualizedGeneral(motor);
  assert.ok(general);
  for (const fact of ["GSW110V", "Volvo TAD531GE", "3000 mm", "1150 mm", "1727 kg", "97.34 / 87.05 kW"]) {
    assert.ok(general.includes(fact), fact);
  }
  assert.ok(general.endsWith(motor.longDescription?.trim() ?? ""));
  for (const reference of ["1216", "1218"]) {
    assert.equal(resolveGamIndividualizedGeneral(find(gam.products, reference)), null, reference);
  }
  const rejected: readonly ProductRecord[] = [
    { ...motor, providerId: "gomariz" },
    { ...motor, reference: "1210" },
    { ...motor, model: "GSW65P" },
    { ...motor, title: "PRAMAC GSW65P" },
    { ...motor, externalReference: "GSW65P" },
    { ...motor, url: motor.url.replace("online.gamrentals.com", "example.com") },
    { ...motor, url: "not-a-url" },
    { ...motor, specs: { ...motor.specs, Modelo: "GSW65P" } },
    { ...motor, specs: { ...motor.specs, "Marca motor": "Perkins TAD531GE" } },
    { ...motor, specs: { ...motor.specs, Peso: "5000 cm" } },
    { ...motor, specs: { ...motor.specs, "Potencia Motor (KW)": "97 CV" } },
    { ...motor, longDescription: "Descripción específica del modelo." }
  ];
  for (const [index, record] of rejected.entries()) {
    assert.equal(resolveGamIndividualizedGeneral(record), null, String(index));
  }
});

test("GAM: distingue tres automóviles por año y kilometraje publicados", () => {
  const records = ["6688", "6689", "6690"].map((reference) => find(gam.products, reference));
  const texts = records.map(resolveGamIndividualizedGeneral);
  assert.ok(texts.every(Boolean));
  assert.equal(new Set(texts).size, 3);
  for (const [index, record] of records.entries()) {
    const text = texts[index];
    assert.ok(text);
    const year = record.specs?.["Año de fabricación"];
    assert.ok(typeof year === "string");
    assert.ok(text.includes(year));
    assert.ok(text.includes(record.longDescription?.trim() ?? ""));
  }
  const original = records[0];
  assert.ok(original);
  for (const variant of [
    { ...original, categoryKey: "maquinaria" },
    { ...original, reference: "6689" },
    { ...original, url: "not-a-url" },
    { ...original, specs: { ...original.specs, Kilómetros: "sin datos" } },
    { ...original, specs: { ...original.specs, "Año de fabricación": "3020" } },
    { ...original, longDescription: "Descripción original distinta" }
  ]) assert.equal(resolveGamIndividualizedGeneral(variant), null);
});

test("Gomariz: sustituye la general de torres en un generador por sus propias medidas", () => {
  const source = find(gomariz.products, "GR1113");
  const description = resolveGomarizIndividualizedGeneral(source);
  assert.ok(description);
  for (const fragment of ["Himoinsa HFW-605T", "2,75 m", "1,10 m", "1786 kg", "60 kVA"]) {
    assert.ok(description.includes(fragment), fragment);
  }
  assert.ok(!description.includes("Las torres de iluminación"));
  for (const variant of [
    { ...source, categoryKey: "alquiler" },
    { ...source, brand: "Generac" },
    { ...source, model: "HFW-605U" },
    { ...source, url: source.url.replace("gomarizrent.com", "example.com") },
    { ...source, specs: { ...source.specs, Potencia: "datos estimados" } },
    { ...source, specs: { ...source.specs, Longitud: "2 metros o 3 metros" } },
    { ...source, longDescription: "Información propia y específica." }
  ]) {
    const text = resolveGomarizIndividualizedGeneral(variant);
    assert.equal(text, null);
  }
});

test("Gomariz: solo incorpora magnitudes con unidad en las familias acreditadas", () => {
  const source = find(gomariz.products, "TO1242");
  const description = resolveGomarizIndividualizedGeneral(source);
  assert.ok(description?.includes("4x400 W"));
  const another = find(gomariz.products, "RO457");
  assert.ok(resolveGomarizIndividualizedGeneral(another)?.includes("4030 kg"));
  for (const variant of [
    { ...source, providerId: "gam" },
    { ...source, specs: { ...source.specs, Potencia: "4000 CV" } },
    { ...source, specs: { ...source.specs, Peso: "? kg" } },
    { ...source, longDescription: "Texto de esta torre de luz" }
  ]) assert.equal(resolveGomarizIndividualizedGeneral(variant), null);
  assert.equal(resolveGomarizIndividualizedGeneral(find(gomariz.products, "RO1197")), null);
});
