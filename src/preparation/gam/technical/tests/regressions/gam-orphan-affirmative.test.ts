import assert from "node:assert/strict";
import test from "node:test";
import type { ProductRecord } from "../../../../../contracts/catalog.js";
import { readCanonicalCatalog } from "../../../../../infrastructure/filesystem/catalog/canonical-catalog.js";
import { removeGamOrphanAffirmative, removeGamResidualEditorialArtifacts } from "../../../editorial/mapping/long-description.js";
import { prepareSourceProduct } from "../../../../prepare-product.js";
import { createGamCondensedEditorialResolver } from "../../../editorial/mapping/condensed-editorial-resolver.js";
import { hysterEvidence } from "../../../editorial/evidence/hyster.js";

const { general: resolveGamHysterCondensedGeneral } = createGamCondensedEditorialResolver(hysterEvidence, true);

const gam = await readCanonicalCatalog("catalogs/providers/gam/original/scrape-gam-catalog.json");
const gomariz = await readCanonicalCatalog("catalogs/providers/gomariz/original/scrape-gomariz-catalog.json");
const expected = new Set([
  "2079", "6", "2090", "2075", "2091", "2076", "2092", "2094",
  "2093", "2095", "2096", "2064", "2044", "6272", "4624", "4625"
]);

const recordOf = (reference: string): ProductRecord => {
  const record = gam.products.find((item) => item.reference === reference);
  assert.ok(record, reference);
  return record;
};

test("GAM: limpia 16 respuestas huérfanas sin alterar el resto del contenido", () => {
  const changed = new Set<string>();
  for (const record of gam.products) {
    const originalRecord = structuredClone(record);
    const original = record.longDescription;
    const corrected = removeGamOrphanAffirmative(record, original);
    if (expected.has(record.reference ?? "")) {
      assert.ok(record.reference);
      assert.ok(original);
      assert.ok(corrected);
      changed.add(record.reference);
      assert.equal(corrected, original.replace(/(?<=\.)\s+Sí\.\s+(?=[A-ZÁÉÍÓÚÑ])/u, " "));
      assert.equal((corrected.match(/Sí\./gu) ?? []).length, (original.match(/Sí\./gu) ?? []).length - 1);
      const prepared = prepareSourceProduct(record).product;
      const previousGeneral = resolveGamHysterCondensedGeneral(record) ?? removeGamResidualEditorialArtifacts(record, corrected) ?? corrected;
      if (prepared.description_general !== previousGeneral) {
        assert.ok(prepared.description_general?.includes(record.model ?? "INVALID"), record.reference);
        assert.doesNotMatch(prepared.description_general ?? "", /(?<=\.)\s+Sí\.\s+(?=[A-ZÁÉÍÓÚÑ])/u, record.reference);
      }
      assert.deepEqual(prepared.spec, prepareSourceProduct(record).product.spec);
    }
    assert.deepEqual(record, originalRecord, record.reference ?? "sin referencia");
  }
  assert.deepEqual(changed, expected);
});

test("GAM: rechaza identidades cruzadas, origen alterado y preguntas con respuesta legítima", () => {
  const record = recordOf("2090");
  assert.ok(record.longDescription);
  assert.ok(removeGamOrphanAffirmative(record, record.longDescription));
  const question = record.longDescription.replace("Sí.", "¿Está disponible? Sí.");
  const variants: readonly ProductRecord[] = [
    { ...record, providerId: "gomariz" },
    { ...record, categoryKey: "marcas-nuevas" },
    { ...record, condition: "Segunda mano" },
    { ...record, brand: "YALE" },
    { ...record, model: "H6.0FT" },
    { ...record, title: "Carretilla de otra marca" },
    { ...record, specs: { ...record.specs, Modelo: "H6.0FT" } },
    { ...record, url: record.url.replace("2090-", "2091-") },
    { ...record, url: `${record.url}?variant=other` },
    { ...record, longDescription: question },
    { ...record, longDescription: record.longDescription.replace("Sí.", "No.") },
    { ...record, longDescription: `${record.longDescription} Sí. Otro texto.` }
  ];
  for (const [index, variant] of variants.entries()) {
    assert.equal(removeGamOrphanAffirmative(variant, variant.longDescription), null, String(index));
  }
});

test("Gomariz y las fichas ajenas a la cohorte no cambian", () => {
  for (const record of gomariz.products) {
    assert.equal(removeGamOrphanAffirmative(record, record.longDescription), null, record.reference ?? "sin referencia");
  }
  for (const reference of ["4655", "4724", "2079", "18", "2030"]) {
    const record = recordOf(reference);
    if (expected.has(reference)) continue;
    assert.equal(removeGamOrphanAffirmative(record, record.longDescription), null, reference);
  }
});
