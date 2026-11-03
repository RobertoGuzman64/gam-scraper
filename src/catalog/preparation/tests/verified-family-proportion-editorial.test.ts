import assert from "node:assert/strict";
import test from "node:test";
import type { ProductRecord } from "../../../contracts/catalog.js";
import { readCanonicalCatalog } from "../../../infrastructure/filesystem/catalog/canonical-catalog.js";
import { verifiedFamilyProportionEditorial } from "../evidence/verified-family-proportion-editorial.js";
import { resolveVerifiedFamilyProportionEditorial } from "../mapping/verified-family-proportion-editorial.js";
import { prepareSourceProduct } from "../prepare-product.js";

const catalogs = await Promise.all([
  readCanonicalCatalog("catalogs/providers/gam/original/scrape-gam-catalog.json"),
  readCanonicalCatalog("catalogs/providers/gomariz/original/scrape-gomariz-catalog.json"),
  readCanonicalCatalog("catalogs/providers/mercaeleva/original/scrape-mercaeleva-catalog.json")
]);
const records = catalogs.flatMap((catalog) => catalog.products);
const byIdentity = new Map<string, ProductRecord>();
for (const record of records) byIdentity.set(`${record.providerId}:${record.reference}`, record);
const expected = new Set([
  "gam:6745", "gam:6274", "gam:6193", "gam:6189", "gam:6421",
  "gam:6422", "gam:2328", "gam:2313", "gam:6169", "gam:2314",
  "gam:4650", "gam:6171", "gam:4802", "gam:4846", "gam:4737",
  "mercaeleva:M879-4639", "mercaeleva:M294-4678", "gam:6218",
  "gam:6262", "gam:6669"
]);
const evidenceEntries: Readonly<Record<string, {
  readonly general: string;
  readonly sourceUrl: string;
}>> = verifiedFamilyProportionEditorial;

test("La fase 162 mejora exactamente veinte fichas canónicas sin alterar datos técnicos", () => {
  assert.equal(records.length, 1347);
  assert.deepEqual(new Set(Object.keys(verifiedFamilyProportionEditorial)), expected);
  for (const identity of expected) {
    const record = byIdentity.get(identity);
    assert.ok(record, identity);
    const evidence = evidenceEntries[identity];
    assert.ok(evidence, identity);
    const unchangedRecord = JSON.stringify(record);
    const prepared = prepareSourceProduct(record);
    assert.equal(JSON.stringify(record), unchangedRecord, identity);
    assert.equal(prepared.status, "ready", identity);
    assert.deepEqual(prepared.issues, [], identity);
    assert.equal(prepared.product.sourceUrl, evidence.sourceUrl, identity);
    assert.equal(prepared.product.description_general, evidence.general, identity);
    const words = evidence.general.trim().split(/\s+/u).length;
    assert.ok(words >= 70 && words <= 190, identity);
  }
});

test("La regla exige identidad, fuente, especificaciones y descripción previa exactas", () => {
  for (const [identity, general] of [
    ["gam:6745", "El preparapedidos Yale MO30X es una transpaleta eléctrica de conductor a bordo diseñada para el transporte interno de palets pesados"],
    ["mercaeleva:M879-4639", "Transpaleta eléctrica Stöcklin EDP-2000. Horas de uso publicadas: 2261 h. Referencia del vendedor: MER0515."]
  ] as const) {
    const record = byIdentity.get(identity);
    assert.ok(record, identity);
    assert.equal(resolveVerifiedFamilyProportionEditorial(record, null), null);
    assert.equal(resolveVerifiedFamilyProportionEditorial(record, general + " texto alterado"), null);
    for (const changed of [
      { ...record, providerId: "otro" },
      { ...record, reference: `${record.reference}-otro` },
      { ...record, title: `${record.title} variante` },
      { ...record, model: "OTRO" },
      { ...record, url: `${record.url}?variante=2` },
      { ...record, specs: { ...record.specs, revisión: "pendiente" } },
      { ...record, longDescription: "Texto sustituido" }
    ] satisfies readonly ProductRecord[]) {
      assert.equal(resolveVerifiedFamilyProportionEditorial(changed, general), null, identity);
    }
  }
});

test("La depuración conserva las discrepancias y no adjudica capacidades contradictorias", () => {
  for (const [identity, fragments] of [
    ["gam:6745", ["MO30X", "MO20X", "3.000 kg"]],
    ["gam:6274", ["H14XD-12", "H12XD-12", "1.200 mm"]],
    ["gam:6193", ["300 kg", "250 kg"]],
    ["gam:6421", ["2.000 kg", "3.000 kg"]],
    ["gam:2328", ["GP80SVX", "GP90VX", "8.000 kg", "9.000 kg"]],
    ["gam:2313", ["GLP", "diésel", "eléctrico"]],
    ["gam:6169", ["TRCS 180", "TRACCESS 180", "230 kg", "200 kg"]],
    ["gam:6171", ["20,46 m", "21 m", "200 kg", "230 kg"]],
    ["gam:4650", ["18HD", "18HV", "360 kg", "300 kg"]],
    ["gam:4737", ["XG0810C", "XG0807ACW-LI"]],
    ["gam:6669", ["3 m", "5 m", "NA"]]
  ] as const) {
    const evidence = evidenceEntries[identity];
    assert.ok(evidence, identity);
    for (const fragment of fragments) assert.ok(evidence.general.includes(fragment), `${identity}: ${fragment}`);
  }
});
