import assert from "node:assert/strict";
import test from "node:test";
import type { ProductRecord } from "../../../../contracts/catalog.js";
import { readCanonicalCatalog } from "../../../../infrastructure/filesystem/catalog/canonical-catalog.js";
import { resolveGamExactVariantGeneral, resolveGamModelIdentifiedGeneral } from "../mapping/model-identified-general.js";
import { prepareSourceProduct } from "../../../prepare-product.js";
import { createGamCondensedEditorialResolver } from "../mapping/condensed-editorial-resolver.js";
import { multiSectorSecondaryEvidence } from "../evidence/multi-sector-secondary.js";

const { general: resolveGamAdditionalCondensedGeneral, short: resolveGamAdditionalCondensedShort } = createGamCondensedEditorialResolver(multiSectorSecondaryEvidence);

const catalog = await readCanonicalCatalog("catalogs/providers/gam/original/scrape-gam-catalog.json");
const improved = new Set(["4765", "6185", "6188", "217", "215", "216", "211", "212", "213", "4031", "234", "239", "237", "243", "235"]);

const find = (reference: string): ProductRecord => {
  const record = catalog.products.find((entry) => entry.reference === reference);
  assert.ok(record, reference);
  return record;
};

test("Fase 19: identifica 15 modelos acreditados sin modificar los originales", () => {
  const changed = new Set<string>();
  for (const record of catalog.products) {
    const previous = JSON.stringify(record);
    const prepared = prepareSourceProduct(record).product;
    if (record.reference === "4031") {
      assert.ok(resolveGamModelIdentifiedGeneral(record, record.longDescription));
      assert.match(prepared.description_general ?? "", /Tennant BCS S20 Batería/u);
      changed.add(record.reference);
      assert.equal(JSON.stringify(record), previous);
      continue;
    }
    if (record.reference && ["211", "213", "215"].includes(record.reference)) {
      assert.ok(resolveGamModelIdentifiedGeneral(record, record.longDescription));
      assert.ok(prepared.description_general?.includes(record.model ?? ""));
      assert.ok(prepared.description_general?.includes("kg"));
      changed.add(record.reference);
      assert.equal(JSON.stringify(record), previous);
      continue;
    }
    if (record.reference === "4765") {
      const sourceResult = resolveGamModelIdentifiedGeneral(record, record.longDescription);
      assert.ok(sourceResult);
      assert.ok(prepared.description_general?.includes("XGA16ACK-Li"));
      assert.match(prepared.description_general ?? "", /230 kg/u);
      changed.add(record.reference);
      assert.equal(JSON.stringify(record), previous);
      continue;
    }
    const result = resolveGamModelIdentifiedGeneral(record, (resolveGamAdditionalCondensedGeneral(record) ? null : prepared.description_general)?.replace(
      /^Modelo identificado en la ficha: [^\n]+\n\n/u, "") ?? null);
    if (result !== null || (record.reference && improved.has(record.reference) && resolveGamAdditionalCondensedGeneral(record))) {
      if (result === null) {
        assert.equal(prepared.description_general, resolveGamAdditionalCondensedGeneral(record));
        assert.equal(JSON.stringify(record), previous);
        changed.add(record.reference ?? "");
        continue;
      }
      assert.ok(record.reference);
      changed.add(record.reference);
      assert.equal(prepared.description_general, result);
      assert.ok(result.toLocaleLowerCase("es").includes(`${record.brand} ${record.model}`.toLocaleLowerCase("es")));
      assert.ok(result.endsWith(record.longDescription?.trim() ?? ""));
      assert.equal(prepared.reference, record.reference);
      assert.equal(prepared.sourceUrl, record.url);
    }
    assert.equal(JSON.stringify(record), previous);
  }
  assert.deepEqual(changed, improved);
});

test("Fase 19: rechaza identidad, origen y contenido discordantes", () => {
  const record = find("217");
  const general = record.longDescription?.trim() ?? "";
  assert.ok(resolveGamModelIdentifiedGeneral(record, general));
  const invalid: readonly ProductRecord[] = [
    { ...record, providerId: "gomariz" },
    { ...record, reference: "215" },
    { ...record, model: "RR S" },
    { ...record, title: "Volteador Logitrans RR S" },
    { ...record, shortDescription: "Volteador Logitrans RR S" },
    { ...record, brand: "OTRA" },
    { ...record, categoryKey: "maquinaria" },
    { ...record, condition: "Segunda mano" },
    { ...record, specs: { ...record.specs, Modelo: "RR S" } },
    { ...record, specs: { ...record.specs, Marca: "OTRA" } },
    { ...record, longDescription: "Descripción genérica distinta." },
    { ...record, url: "https://example.com/217-volteador-de-bidones-350-kg-logitrans-mdt" },
    { ...record, url: record.url.replace("217-", "215-") },
    { ...record, url: "not-a-url" }
  ];
  for (const [index, candidate] of invalid.entries()) {
    assert.equal(resolveGamModelIdentifiedGeneral(candidate, general), null, String(index));
  }
  assert.equal(resolveGamModelIdentifiedGeneral(record, `Modelo identificado en la ficha: LOGITRANS MDT.\n\n${general}`), null);
});

test("Fase 19: mantiene fuera referencias ambiguas y casos con variantes incompatibles", () => {
  for (const reference of ["5949", "6806", "2028", "1218", "2148", "6634"]) {
    const record = find(reference);
    assert.equal(resolveGamModelIdentifiedGeneral(record, record.longDescription), null, reference);
  }
});

test("conserva el relato original e identifica solo 15 variantes inequívocas en sus descripciones", () => {
  const expected = new Set(["2276", "2277", "2278", "2279", "2280", "2291", "2293", "2294",
    "4734", "4739", "4741", "4743", "4745", "4747", "4768"]);
  const changed = new Set<string>();
  for (const record of catalog.products) {
    const snapshot = JSON.stringify(record);
    const result = resolveGamExactVariantGeneral(record, record.longDescription);
    if (result !== null) {
      assert.ok(record.reference);
      changed.add(record.reference);
      assert.ok(record.model);
      assert.ok(result.toLocaleLowerCase("es").includes(`${record.brand} ${record.model}`.toLocaleLowerCase("es")));
      assert.ok(!record.longDescription?.includes(`${record.brand} ${record.model}`));
      const prepared = prepareSourceProduct(record);
      if (prepared.product.description_general !== result) {
        if (record.reference === "2294") {
          assert.match(prepared.product.description_general ?? "", /ERP35VL.*LWB/u);
        } else {
          assert.ok(prepared.product.description_general?.includes(record.model ?? "INVALID"), record.reference);
        }
        assert.ok(prepared.product.description_general?.includes("kg"), record.reference);
      }
      assert.equal(prepared.product.reference, record.reference);
      assert.equal(prepared.product.sourceUrl, record.url);
    }
    assert.equal(JSON.stringify(record), snapshot);
  }
  assert.deepEqual(changed, expected);
});

test("rechaza discrepancias de procedencia, versión, identidad y batería", () => {
  const record = find("4743");
  const general = record.longDescription;
  assert.ok(resolveGamExactVariantGeneral(record, general));
  const invalid: readonly ProductRecord[] = [
    { ...record, providerId: "gomariz" },
    { ...record, reference: "4745" },
    { ...record, model: "XG1412AC-LI" },
    { ...record, title: "Plataforma elevadora XCMG XG1412AC" },
    { ...record, shortDescription: "Equipo sin variante identificada" },
    { ...record, brand: "OTRA" },
    { ...record, categoryKey: "carretillas-nuevas" },
    { ...record, condition: "Segunda mano" },
    { ...record, specs: { ...record.specs, Modelo: "XG1412AC-LI" } },
    { ...record, specs: { ...record.specs, "Tipo de batería": "Batería de plomo" } },
    { ...record, longDescription: "Descripción no acreditada." },
    { ...record, url: "https://example.com/es/plataformas-de-tijera-electricas-xcmg/4743-xcmg-xg1212ac-li" },
    { ...record, url: record.url.replace("4743-", "4745-") },
    { ...record, url: "no-es-una-url" }
  ];
  for (const [index, candidate] of invalid.entries()) {
    assert.equal(resolveGamExactVariantGeneral(candidate, general), null, String(index));
  }
  assert.equal(resolveGamExactVariantGeneral(record, general?.replace("XG1212AC", "XG1212AC-LI") ?? null), null);
  const yale = find("2279");
  assert.ok(resolveGamExactVariantGeneral(yale, yale.longDescription));
  assert.equal(resolveGamExactVariantGeneral({ ...yale, specs: { ...yale.specs, Modelo: "ERC32VG (MWB)" } }, yale.longDescription), null);
});
