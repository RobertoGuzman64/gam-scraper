import assert from "node:assert/strict";
import test from "node:test";
import type { ProductRecord } from "../../contracts/catalog.js";
import { readCanonicalCatalog } from "../../infrastructure/filesystem/catalog/canonical-catalog.js";
import { verifiedEditorialClosure } from "../shared/editorial/evidence/verified-editorial-closure.js";
import { resolveVerifiedEditorialClosure } from "../shared/editorial/mapping/verified-editorial-closure.js";
import { prepareSourceProduct } from "../prepare-product.js";

const catalogs = await Promise.all([
  readCanonicalCatalog("catalogs/providers/gam/original/scrape-gam-catalog.json"),
  readCanonicalCatalog("src/testing/fixtures/gomariz/regression-143/scrape-gomariz-catalog.json"),
  readCanonicalCatalog("catalogs/providers/mercaeleva/original/scrape-mercaeleva-catalog.json")
]);
const records = catalogs.flatMap((catalog) => catalog.products);
const byIdentity = new Map<string, ProductRecord>();
for (const record of records) byIdentity.set(`${record.providerId}:${record.reference}`, record);
const references = [
  "911", "921", "922", "2311", "2330", "5845", "5949", "6116", "6126", "6130", "6195", "6196", "6206", "6228",
  "6478", "6486", "6631", "6650", "6778", "6779", "6845", "6859", "6921",
  "6971", "6980", "6982", "6987", "6988", "6989", "6993", "6994", "6995"
] as const;
const expected = new Set(references.map((reference) => `gam:${reference}`));
const evidence: Readonly<Record<string, {
  readonly sourceUrl: string;
  readonly general: string;
  readonly verificationUrl: string;
}>> = verifiedEditorialClosure;

test("Las descripciones acreditadas se aplican solo a sus referencias canónicas", () => {
  assert.equal(records.length, 1347);
  assert.deepEqual(new Set(Object.keys(evidence)), expected);
  for (const identity of expected) {
    const record = byIdentity.get(identity);
    const verified = evidence[identity];
    assert.ok(record, identity);
    assert.ok(verified, identity);
    const original = JSON.stringify(record);
    const prepared = prepareSourceProduct(record);
    assert.equal(JSON.stringify(record), original, identity);
    assert.equal(prepared.status, "ready", identity);
    assert.deepEqual(prepared.issues, [], identity);
    assert.equal(prepared.product.sourceUrl, verified.sourceUrl, identity);
    assert.equal(prepared.product.description_general, verified.general, identity);
    assert.ok(verified.verificationUrl.startsWith("https://"), identity);
    assert.ok(verified.general.trim().split(/\s+/u).length >= 95, identity);
  }
});

test("La evidencia requiere fuente y descripción previa inalteradas", () => {
  const known = [
    ["gam:5949", "La ficha del proveedor identifica una bicicleta eléctrica Littium Ibiza Titanium de segunda mano, ubicada en Madrid y con 955 km registrados. Las especificaciones del motor, la batería y la autonomía no se atribuyen a esta unidad porque la descripción comercial de origen no identifica de manera inequívoca esta variante."],
    ["gam:6126", "La plataforma articulada eléctrica Genie Z-30/20N, anunciada como unidad de ocasión de 2016, tiene 11 metros de altura de elevación y 227 kg de capacidad de carga según la ficha técnica. La máquina figura ubicada en Tarragona, con número de serie Z30N16F-17879. El proveedor indica que el horómetro ha sido sustituido, sin lectura total de horas acreditada. Sus medidas publicadas son longitud: 3.500 mm; anchura: 1.190 mm; altura: 2.000 mm; peso: 6.600 kg. La pendiente superable declarada es del 35%."]
  ] as const;
  for (const [identity, previous] of known) {
    const record = byIdentity.get(identity);
    assert.ok(record, identity);
    assert.equal(resolveVerifiedEditorialClosure(record, previous), evidence[identity]?.general, identity);
    assert.equal(resolveVerifiedEditorialClosure(record, null), null, identity);
    assert.equal(resolveVerifiedEditorialClosure(record, `${previous} variante`), null, identity);
    for (const modified of [
      { ...record, providerId: "otro" },
      { ...record, reference: `${record.reference}-otro` },
      { ...record, url: `${record.url}?version=2` },
      { ...record, title: `${record.title} variante` },
      { ...record, model: "OTRO" },
      { ...record, specs: { ...record.specs, "Capacidad revisada": "pendiente" } },
      { ...record, longDescription: "Descripción no acreditada" }
    ] satisfies readonly ProductRecord[]) {
      assert.equal(resolveVerifiedEditorialClosure(modified, previous), null, identity);
    }
  }
});

test("La preparación distingue las variantes y preserva los datos inciertos de cada unidad", () => {
  const expectations: Readonly<Record<string, readonly string[]>> = {
    "gam:5949": ["Ibiza Titanium", "Ibiza Dogma", "955 km", "10,4", "14 Ah"],
    "gam:6126": ["Z-30/20N", "2016", "227 kg", "horómetro sustituido", "35 %"],
    "gam:6650": ["E300AJP", "2006", "2.047 horas", "230 kg", "6.859 kg"],
    "gam:6971": ["1Q2L25Q", "A1N1L18Q", "2016"],
    "gam:6987": ["Yale MP20", "Hyster P2.0SD", "2017", "2021"],
    "gam:6988": ["Hyster P2.0", "Still RX 60-35", "2022", "2015"],
    "gam:6989": ["Toyota LPE200", "Yale ERP35VL", "2006", "2019"],
    "gam:6993": ["JLG E300AJP", "Haulotte Optimum 8", "2007"],
    "gam:6994": ["Yale ERP16VT MWB", "Yale MP16", "2016", "2021"],
    "gam:6995": ["Hyster S1.2", "Yale ERP18VT MWB", "2021", "2018"]
  };
  for (const [identity, fragments] of Object.entries(expectations)) {
    const description = evidence[identity]?.general;
    assert.ok(description, identity);
    for (const fragment of fragments) assert.ok(description.includes(fragment), `${identity}: ${fragment}`);
  }
});
