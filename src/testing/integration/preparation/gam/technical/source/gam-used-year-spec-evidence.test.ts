import assert from "node:assert/strict";
import test from "node:test";
import { readCanonicalCatalog } from "../../../../../../infrastructure/filesystem/catalog/canonical-catalog.js";
import { normalizeSpecsObject } from "../../../../../../catalog/normalization/normalize-specs.js";
import { recoverGamVerifiedUsedYearSpec } from "../../../../../../preparation/gam/technical/source/used-year-spec-evidence.js";

const gam = await readCanonicalCatalog("catalogs/providers/gam/original/scrape-gam-catalog.json");
const expected = [
  "6947", "6997", "6196", "6195", "6920", "6881", "6857", "6834", "6358", "6367",
  "6607", "6571", "6631", "6614", "6886", "6486", "6845", "6362", "6116",
  "6514", "5227", "6884", "5213", "6686", "6684", "5714", "6627", "6618", "5739",
  "6616", "6615", "6974", "6975", "6130", "6284", "6389", "6226", "6980", "6233", "6626", "6776", "6492", "5280", "6885", "6950", "6436", "5719", "5962", "5228", "6391",
  "6901", "6912", "6139", "6846", "6979", "6985", "6752", "6311", "6630", "6632", "6977", "6945", "6941", "6951", "5879", "6849", "6816", "6817", "6837", "6880", "6587", "6510", "6915", "6878",
  "6984", "6879", "6572", "6077", "6126", "6202", "6998", "6972", "6983", "6483", "6937", "6854", "5845", "6755", "5880", "6819", "6820", "6823", "6841", "6738", "6860", "6835", "6976", "6726", "6949",
  "6228", "6967", "6778", "6779", "6855", "6856", "6859", "6864", "5979", "6063", "6064", "6065", "6109", "6204", "6821", "6822", "6858", "6372", "6084", "6788", "6582", "6601",
  "6625", "6982", "6932", "6723", "6123", "6966", "6599", "6559", "6560", "6608", "6606", "6775", "6024", "5792", "6122", "5848"
];

const source = (reference: string) => {
  const record = gam.products.find((product) => product.reference === reference);
  assert.ok(record, reference);
  return record;
};

test("GAM: año verificable de unidades identificadas sin inferencias por modelo", () => {
  const recovered: string[] = [];
  for (const record of gam.products) {
    const previous = normalizeSpecsObject(record.specs);
    const updated = recoverGamVerifiedUsedYearSpec(record);
    const normalized = normalizeSpecsObject(updated);
    if (record.reference && normalized.normalized.Año !== previous.normalized.Año) {
      assert.equal(normalized.normalized.Año, Number(record.year), record.reference);
      assert.deepEqual(
        Object.fromEntries(Object.entries(normalized.normalized).filter(([key]) => key !== "Año")),
        previous.normalized,
        record.reference
      );
      recovered.push(record.reference);
    } else {
      assert.deepEqual(updated, record.specs ?? {}, record.reference ?? "sin referencia");
    }
  }
  assert.deepEqual(recovered.sort(), [...expected].sort());
});

test("GAM: el año contradictorio o la identidad alterada no se publican como spec", () => {
  const record = source("6607");
  const blocked = [
    { ...record, providerId: "gomariz" },
    { ...record, condition: "Nuevo" as const },
    { ...record, year: "2013" },
    { ...record, brand: "OTRA" },
    { ...record, model: "Z45/25" },
    { ...record, url: `${record.url}?other=1` },
    { ...record, title: "Otra máquina sin identidad GAM" },
    { ...record, longDescription: `${record.longDescription ?? ""} Fabricada en 2011.` },
    { ...record, longDescription: `${record.longDescription ?? ""} Fabricada en el año 2011.` },
    { ...record, specs: { ...record.specs, "Año de fabricación": "2011" } }
  ];
  for (const invalid of blocked) {
    assert.deepEqual(recoverGamVerifiedUsedYearSpec(invalid), invalid.specs ?? {});
  }
  const newlyVerified = source("6855");
  for (const invalid of [
    { ...newlyVerified, year: "2017" },
    { ...newlyVerified, url: `${newlyVerified.url}?duplicate=1` },
    { ...newlyVerified, brand: "OTRA" },
    { ...newlyVerified, model: "S3219" },
    { ...newlyVerified, longDescription: `${newlyVerified.longDescription ?? ""} Fabricada en 2016.` },
    { ...newlyVerified, specs: { ...newlyVerified.specs, "Año de fabricación": "2016" } }
  ]) {
    assert.deepEqual(recoverGamVerifiedUsedYearSpec(invalid), invalid.specs ?? {});
  }
  assert.deepEqual(recoverGamVerifiedUsedYearSpec(source("6911")), source("6911").specs ?? {});
  assert.deepEqual(recoverGamVerifiedUsedYearSpec(source("6759")), source("6759").specs ?? {});
  for (const reference of ["6920", "6881", "6947", "6358"] as const) {
    const verified = source(reference);
    assert.equal(recoverGamVerifiedUsedYearSpec(verified)["Año de fabricación"], verified.year, reference);
    const blocked = [
      { ...verified, url: `${verified.url}?variant=1` },
      { ...verified, title: `${verified.title} OTRO MODELO` },
      { ...verified, longDescription: `${verified.longDescription} Fabricada en 2001.` },
      { ...verified, year: "2001" },
      { ...verified, specs: { ...verified.specs, "Año de fabricación": "2001" } }
    ];
    for (const invalid of blocked) {
      assert.deepEqual(recoverGamVerifiedUsedYearSpec(invalid), invalid.specs ?? {}, reference);
    }
  }

});

test("GAM: la nueva cohorte de años rechaza identidad, texto y fecha alterados", () => {
  const record = source("6625");
  for (const invalid of [
    { ...record, model: "GS-3384RT" },
    { ...record, year: "2015" },
    { ...record, url: `${record.url}?other=1` },
    { ...record, longDescription: `${record.longDescription ?? ""} Fabricada en el año 2016.` },
    { ...record, specs: { ...record.specs, "Año de fabricación": "2013" } }
  ]) {
    assert.deepEqual(recoverGamVerifiedUsedYearSpec(invalid), invalid.specs ?? {});
  }
});
