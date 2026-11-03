import assert from "node:assert/strict";
import test from "node:test";
import type { ProductRecord } from "../../../contracts/catalog.js";
import { readCanonicalCatalog } from "../../../infrastructure/filesystem/catalog/canonical-catalog.js";
import { verifiedUnitContextEditorial } from "../evidence/verified-unit-context-editorial.js";
import { resolveVerifiedUnitContextEditorial } from "../mapping/verified-unit-context-editorial.js";
import { prepareSourceProduct } from "../prepare-product.js";

const catalogs = await Promise.all([
  readCanonicalCatalog("catalogs/providers/gam/original/scrape-gam-catalog.json"),
  readCanonicalCatalog("catalogs/providers/gomariz/original/scrape-gomariz-catalog.json"),
  readCanonicalCatalog("catalogs/providers/mercaeleva/original/scrape-mercaeleva-catalog.json")
]);
const byIdentity = new Map<string, ProductRecord>();
for (const catalog of catalogs) {
  for (const record of catalog.products) byIdentity.set(`${record.providerId}:${record.reference}`, record);
}
const expected = new Set([
  "mercaeleva:M239-6301", "mercaeleva:M570-8735", "mercaeleva:M840-6795",
  "mercaeleva:M433-5206", "mercaeleva:M028-8481", "mercaeleva:M486-0114",
  "mercaeleva:M502-4867", "mercaeleva:M329-6156", "mercaeleva:M547-1056",
  "mercaeleva:M198-7237", "mercaeleva:M342-3553", "mercaeleva:M725-7107",
  "gam:4683", "gam:4691", "gam:2330", "gam:1211", "gam:922",
  "gam:2145", "gam:2237", "gam:2275"
]);

const evidenceEntries: Readonly<Record<string, {
  readonly sourceUrl: string;
  readonly short?: string;
  readonly general?: string;
}>> = verifiedUnitContextEditorial;

test("La fase editorial conserva los originales y mejora exactamente veinte referencias", () => {
  assert.equal(byIdentity.size, 1347);
  assert.deepEqual(new Set(Object.keys(verifiedUnitContextEditorial)), expected);
  let shortCount = 0;
  let generalCount = 0;
  for (const identity of expected) {
    const record = byIdentity.get(identity);
    assert.ok(record, identity);
    const evidence = evidenceEntries[identity];
    assert.ok(evidence, identity);
    const original = JSON.stringify(record);
    const result = prepareSourceProduct(record);
    assert.equal(JSON.stringify(record), original, identity);
    assert.equal(result.status, "ready", identity);
    assert.deepEqual(result.issues, [], identity);
    assert.equal(result.product.sourceUrl, evidence.sourceUrl, identity);
    if (evidence.short !== undefined) {
      assert.equal(result.product.description, evidence.short, identity);
      assert.ok(evidence.short.split(/\s+/u).length <= 35, identity);
      shortCount++;
    }
    if (evidence.general !== undefined) {
      assert.equal(result.product.description_general, evidence.general, identity);
      assert.ok(evidence.general.split(/\s+/u).length >= 60, identity);
      generalCount++;
    }
    assert.equal(result.product.reference, record.reference, identity);
    assert.deepEqual(result.product.spec, prepareSourceProduct(record).product.spec, identity);
  }
  assert.equal(shortCount, 3);
  assert.equal(generalCount, 17);
});

test("La evidencia exige identidad, origen técnico y textos preparados exactos", () => {
  for (const [identity, oldShort, oldGeneral] of [
    ["mercaeleva:M239-6301", "TRANSPALET ELECTRICO BT LPE200/8", "Transpaleta eléctrica BT LPE200/8. Año de fabricación: 2012. Referencia del vendedor: MER0825."],
    ["gam:4683", "Nueva grúa horquilla HELI CPQYD25-RC1H con motor GLP y capacidad de carga de 2.500 kg.", "La grúa horquilla HELI CPQYD25-RC1H se ofrece como maquinaria nueva. Su ficha técnica especifica un motor GLP y una capacidad de carga de 2.500 kg."],
    ["gam:922", "Apilador eléctrico a pie Yale MS16S. El apilador de operario a bordo de Yale ha sido diseñado para proporcionar una solución eficiente y cómoda para la manipulación de cargas en operaciones con recorridos internos de medios a largos.", "El apilador de operario a bordo de Yale ha sido diseñado para proporcionar una solución eficiente y cómoda para la manipulación de cargas en operaciones con recorridos internos de medios a largos. Con un acceso excelente y una posición de asiento variable, este apilador ofrece una gran comodidad al operario para una mayor productividad. La capacidad de carga del apilador MS16S es de hasta 1.600 kg, lo que lo convierte en una opción ideal para manejar productos de gran tamaño y peso en el almacén. Su mástil"]
  ] as const) {
    const record = byIdentity.get(identity);
    assert.ok(record);
    const outcome = resolveVerifiedUnitContextEditorial(record, oldShort, oldGeneral);
    assert.ok(outcome, identity);
    assert.equal(resolveVerifiedUnitContextEditorial(record, null, oldGeneral), null);
    assert.equal(resolveVerifiedUnitContextEditorial(record, oldShort, null), null);
    assert.equal(resolveVerifiedUnitContextEditorial(record, oldShort + " adulterado", oldGeneral), null);
    assert.equal(resolveVerifiedUnitContextEditorial(record, oldShort, oldGeneral + " adulterado"), null);
    for (const changed of [
      { ...record, reference: `${record.reference}-otra` },
      { ...record, providerId: "otro-proveedor" },
      { ...record, model: `${record.model} otra variante` },
      { ...record, url: `${record.url}?version=otra` },
      { ...record, specs: { ...record.specs, Capacidad: "no verificada" } },
      { ...record, longDescription: "Origen sustituido" }
    ] satisfies readonly ProductRecord[]) {
      assert.equal(resolveVerifiedUnitContextEditorial(changed, oldShort, oldGeneral), null, identity);
    }
  }
});

test("Las conclusiones preservan contradicciones de horas, capacidades y modelos", () => {
  for (const [identity, fragments] of [
    ["mercaeleva:M433-5206", ["1.800 kg", "4.700 mm", "4.700 kg"]],
    ["mercaeleva:M342-3553", ["2.278 horas", "2.276 h"]],
    ["mercaeleva:M725-7107", ["5.007 horas", "2.007 h"]],
    ["mercaeleva:M502-4867", ["42.922 kilómetros", "horas"]],
    ["gam:2145", ["P2.5", "P2.0UTS", "2.500 kg"]],
    ["gam:2237", ["1.000 kg", "2.000 kg"]],
    ["gam:2275", ["2.000 kg", "1.800 kg"]],
    ["gam:922", ["a pie", "a bordo"]]
  ] as const) {
    const record = byIdentity.get(identity);
    assert.ok(record, identity);
    const product = prepareSourceProduct(record).product;
    const description = identity === "gam:922" ? product.description : product.description_general;
    assert.ok(description, identity);
    for (const fragment of fragments) assert.ok(description.includes(fragment), `${identity} ${fragment}`);
  }
});
