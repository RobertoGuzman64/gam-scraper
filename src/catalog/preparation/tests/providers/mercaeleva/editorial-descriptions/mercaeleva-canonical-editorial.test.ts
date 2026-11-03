import { recoverMercaelevaSourceFuel } from "../../../../evidence/providers/mercaeleva/source-fuel-evidence.js";
import assert from "node:assert/strict";
import test from "node:test";
import type { ProductRecord } from "../../../../../../contracts/catalog.js";
import { readCanonicalCatalog } from "../../../../../../infrastructure/filesystem/catalog/canonical-catalog.js";
import { verifiedMercaelevaCriticalGeneral } from "../../../../evidence/providers/mercaeleva/critical-general-descriptions.js";
import { verifiedPriorityPlatformGeneral } from "../../../../evidence/providers/mercaeleva/priority-platform-generals.js";
import { verifiedMercaelevaPriorityShortDescription } from "../../../../evidence/providers/mercaeleva/priority-short-descriptions.js";
import { verifiedMercaelevaResidualGeneral } from "../../../../evidence/providers/mercaeleva/verified-residual-generals.js";
import { verifiedMercaelevaUnitGeneral } from "../../../../mapping/providers/mercaeleva/verified-unit-general.js";
import { verifiedFamilyProportionEditorial } from "../../../../evidence/verified-family-proportion-editorial.js";
import { matchesVerifiedHorometer } from "../../../../evidence/providers/mercaeleva/verified-horometer.js";
import { prepareSourceProduct } from "../../../../prepare-product.js";
import { resolveMercaelevaDocumentedFurtherPlatformGeneral } from "../../../../mapping/providers/mercaeleva/documented-further-platform-general.js";
import { resolveMercaelevaLegacyPlatformGeneral } from "../../../../mapping/providers/mercaeleva/documented-legacy-platform-general.js";
import { resolveMercaelevaVerifiedSourceEditorial } from "../../../../mapping/providers/mercaeleva/verified-source-editorial.js";

const source = await readCanonicalCatalog("catalogs/providers/mercaeleva/original/scrape-mercaeleva-catalog.json");
const sourceRecord = (reference: string): ProductRecord => {
  const record = source.products.find((item) => item.reference === reference);
  assert.ok(record, reference);
  return record;
};
const shortReferences = ["M011-3720", "M106-1389", "M168-3277"] as const;
const generalReferences = [
  "M572-8190", "M736-5615", "M432-1479", "M205-2951", "M178-6194",
  "M913-0641", "M095-5362", "M200-9533", "M171-6370", "M144-5512", "M030-7485"
] as const;
const residualReferences = [
  "M318-0509", "M294-4678", "M315-5925", "M310-8756",
  "M159-0669", "M476-1722", "M805-9451", "M131-5855"
] as const;

test("Mercaeleva: los originales canónicos activan las evidencias editoriales verificadas", () => {
  for (const reference of shortReferences) {
    const record = sourceRecord(reference);
    const snapshot = JSON.stringify(record);
    const short = verifiedMercaelevaPriorityShortDescription(record);
    assert.ok(short, reference);
    const prepared = prepareSourceProduct(record).product;
    assert.equal(prepared.description, short);
    assert.deepEqual(prepared.spec, recoverMercaelevaSourceFuel(record, record.specs ?? {}));
    assert.equal(JSON.stringify(record), snapshot);
  }
  for (const reference of generalReferences) {
    const record = sourceRecord(reference);
    const general = verifiedMercaelevaCriticalGeneral(record) ?? verifiedPriorityPlatformGeneral(record);
    assert.ok(general, reference);
    assert.equal(prepareSourceProduct(record).product.description_general, general, reference);
  }
  for (const reference of residualReferences) {
    const record = sourceRecord(reference);
    const general = verifiedMercaelevaResidualGeneral(record);
    assert.ok(general, reference);
    const prepared = prepareSourceProduct(record).product;
    const previous = resolveMercaelevaDocumentedFurtherPlatformGeneral(record) ?? general;
    assert.ok(prepared.description_general === (resolveMercaelevaVerifiedSourceEditorial(record, previous) ?? previous) ||
      prepared.description_general === resolveMercaelevaLegacyPlatformGeneral(record) ||
      (reference === "M294-4678" && prepared.description_general === verifiedFamilyProportionEditorial["mercaeleva:M294-4678"].general), reference);
    assert.deepEqual(prepared.spec, recoverMercaelevaSourceFuel(record, record.specs ?? {}), reference);
    assert.notEqual(general, record.longDescription, reference);
  }
});

test("Mercaeleva: la evidencia residual no se traslada a fichas alteradas", () => {
  for (const reference of residualReferences) {
    const record = sourceRecord(reference);
    for (const altered of [
      { ...record, reference: "M000-0000" },
      { ...record, url: `${record.url}?alternate=1` },
      { ...record, title: `${record.title} OTRO` },
      { ...record, longDescription: `${record.longDescription} DATO NUEVO` },
      { ...record, specs: { ...record.specs, "Título adicional": "OTRO" } },
      { ...record, condition: record.condition === "Nuevo" ? "Segunda mano" : "Nuevo" }
    ] satisfies readonly ProductRecord[]) {
      assert.equal(verifiedMercaelevaResidualGeneral(altered), null, reference);
    }
  }
  for (const reference of shortReferences) {
    const record = sourceRecord(reference);
    assert.equal(verifiedMercaelevaPriorityShortDescription({ ...record, horometer: "99" }), null, reference);
  }
});

test("Mercaeleva: equivalencia entre horas canónicas y horas publicadas con unidad", () => {
  assert.ok(matchesVerifiedHorometer("294", "294 h"));
  assert.ok(matchesVerifiedHorometer("14 696", "14 696 h"));
  assert.ok(matchesVerifiedHorometer(null, null));
  assert.equal(matchesVerifiedHorometer("295", "294 h"), false);
  assert.equal(matchesVerifiedHorometer("294 horas", "294 h"), false);
  assert.equal(matchesVerifiedHorometer("294", null), false);
});


test("Mercaeleva: los anuncios de unidades se individualizan únicamente con evidencia idéntica", () => {
  for (const reference of ["M208-7097", "M264-2806", "M281-3486", "M035-8084", "M373-1421", "M818-7811", "M640-1938", "M855-6850"] as const) {
    const record = sourceRecord(reference);
    const original = JSON.stringify(record);
    const general = verifiedMercaelevaUnitGeneral(record);
    assert.ok(general, reference);
    assert.notEqual(general, record.longDescription, reference);
    const prepared = prepareSourceProduct(record);
    const previous = resolveMercaelevaDocumentedFurtherPlatformGeneral(record) ?? general;
    assert.equal(prepared.product.description_general, resolveMercaelevaVerifiedSourceEditorial(record, previous) ?? previous, reference);
    assert.deepEqual(prepared.product.spec, recoverMercaelevaSourceFuel(record, record.specs ?? {}), reference);
    assert.equal(JSON.stringify(record), original, reference);
    for (const variant of [
      { ...record, reference: "M000-0000" },
      { ...record, url: `${record.url}?version=2` },
      { ...record, model: `${record.model}-ALT` },
      { ...record, horometer: "9999" },
      { ...record, longDescription: `${record.longDescription} OTRO DATO` },
      { ...record, specs: { ...record.specs, "Horas laborales": "9999 h" } },
      { ...record, specs: { ...record.specs, "Año de fabricación": String(Number(record.year) + 1) } }
    ] satisfies readonly ProductRecord[]) {
      assert.equal(verifiedMercaelevaUnitGeneral(variant), null, reference);
    }
  }
});
