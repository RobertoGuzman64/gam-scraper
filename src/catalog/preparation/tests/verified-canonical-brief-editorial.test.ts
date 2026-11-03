import assert from "node:assert/strict";
import test from "node:test";
import type { ProductRecord } from "../../../contracts/catalog.js";
import { readCanonicalCatalog } from "../../../infrastructure/filesystem/catalog/canonical-catalog.js";
import { verifiedCanonicalBriefEditorial } from "../evidence/verified-canonical-brief-editorial.js";
import { resolveVerifiedCanonicalBriefEditorial } from "../mapping/verified-canonical-brief-editorial.js";
import { prepareSourceProduct } from "../prepare-product.js";

const catalogs = await Promise.all([
  readCanonicalCatalog("catalogs/providers/gam/original/scrape-gam-catalog.json"),
  readCanonicalCatalog("catalogs/providers/gomariz/original/scrape-gomariz-catalog.json"),
  readCanonicalCatalog("catalogs/providers/mercaeleva/original/scrape-mercaeleva-catalog.json")
]);
const records = catalogs.flatMap((catalog) => catalog.products);
const byIdentity = new Map<string, ProductRecord>();
for (const record of records) byIdentity.set(`${record.providerId}:${record.reference}`, record);
const expectedReferences = new Set([
  "gam:2045", "gam:2046", "gam:2047", "gam:2048", "gam:53",
  "gam:4725", "gam:6585", "gam:2082", "gam:2305", "gam:4029",
  "gomariz:PV556", "gomariz:1011JFB", "gomariz:TE1618", "gomariz:CC1535", "gomariz:CC1666",
  "mercaeleva:M104-0836", "mercaeleva:M582-1882", "mercaeleva:M887-9469",
  "mercaeleva:M958-0132", "mercaeleva:M401-4335"
]);

test("Las veinte ampliaciones generales acreditadas conservan identidad y otros campos", () => {
  assert.deepEqual(new Set(Object.keys(verifiedCanonicalBriefEditorial)), expectedReferences);
  assert.equal(records.length, 1347);
  for (const identity of expectedReferences) {
    const record = byIdentity.get(identity);
    assert.ok(record, identity);
    const before = JSON.stringify(record);
    const prepared = prepareSourceProduct(record);
    assert.equal(JSON.stringify(record), before, identity);
    assert.equal(prepared.status, "ready", identity);
    assert.deepEqual(prepared.issues, [], identity);
    const entries: Readonly<Record<string, { readonly general: string; readonly sourceUrl: string }>> = verifiedCanonicalBriefEditorial;
    const evidence = entries[identity];
    assert.ok(evidence, identity);
    assert.equal(prepared.product.description_general, evidence.general, identity);
    assert.equal(prepared.product.sourceUrl, evidence.sourceUrl, identity);
    assert.ok(evidence.general.trim().split(/\s+/u).length >= 60, identity);
  }
});

const previousDescriptions: Readonly<Record<string, string>> = {
  "gam:2045": "La carretilla elevadora diésel Hyster H25XD-9 se ofrece como modelo nuevo. La ficha técnica declara elevación de 9850 mm y capacidad de carga de 25000 KG. Dimensiones y peso publicados: longitud 8321 mm, anchura 3220 mm, altura 4099 mm, peso 45616 KG. Datos adicionales consignados: centro de carga: 900 mm; radio de giro: 6185mm; motor declarado: MTU 7.7L Diesel.",
  "gomariz:PV556": "La ficha técnica de GENIE SLA15 (elevador de mástil vertical) recoge 0,74 m de longitud, 0,8 m de anchura, 151 kg de peso, 4,5 m de altura de trabajo, 363 kg de capacidad.",
  "mercaeleva:M104-0836": "Ref. MER0624 CARRETILLA ELEVADORA ELECTRICA 1600 KG MASTIL DUPLEX LINDE E16P-01 ALTURA DE TRABAJO 3.000mm HORAS 16532 AÑO DE FABRICACION 2009"
};

test("La resolución exige identidad, texto previo y fuente canónica inalterados", () => {
  for (const identity of ["gam:2045", "gomariz:PV556", "mercaeleva:M104-0836"]) {
    const record = byIdentity.get(identity);
    assert.ok(record, identity);
    const entries: Readonly<Record<string, { readonly general: string }>> = verifiedCanonicalBriefEditorial;
    const evidence = entries[identity];
    assert.ok(evidence);
    const source = { ...record, reference: `${record.reference}-no-vinculada` };
    const originalGeneral = previousDescriptions[identity];
    assert.ok(originalGeneral);
    assert.equal(resolveVerifiedCanonicalBriefEditorial(record, originalGeneral), evidence.general);
    const former = resolveVerifiedCanonicalBriefEditorial(source, originalGeneral);
    assert.equal(former, null);
    assert.equal(resolveVerifiedCanonicalBriefEditorial(record, "Texto anterior no acreditado"), null);
    assert.equal(resolveVerifiedCanonicalBriefEditorial(record, null), null);
    for (const changed of [
      { ...record, title: `${record.title} otro modelo` },
      { ...record, model: `${record.model} variante` },
      { ...record, url: `${record.url}?otro=1` },
      { ...record, longDescription: "Anuncio sustituido" },
      { ...record, specs: { ...record.specs, "dato alterado": "no acreditado" } },
      { ...record, providerId: "proveedor-distinto" }
    ] satisfies readonly ProductRecord[]) {
      assert.equal(resolveVerifiedCanonicalBriefEditorial(changed, originalGeneral), null);
    }
  }
});

test("Las descripciones preservan discrepancias de identidad, capacidad y motorización", () => {
  for (const [identity, fragments] of [
    ["gam:2045", ["MTU", "Mercedes-Benz", "discrepancia"]],
    ["gam:2305", ["C1.5L", "H2.0FT", "diferente"]],
    ["gam:4029", ["S16H", "S16L", "variante"]],
    ["gomariz:PV556", ["elevador manual", "363 kg", "4,98 m"]],
    ["gomariz:CC1666", ["230 kg", "9 m", "tracción"]],
    ["mercaeleva:M104-0836", ["dúplex", "tríplex", "reconciliación acreditada"]],
    ["mercaeleva:M582-1882", ["3.000 kg", "2.500 kg", "reconciliación individual acreditada"]],
    ["mercaeleva:M887-9469", ["15 m", "16 m", "diferencia"]]
  ] as const) {
    const record = byIdentity.get(identity);
    assert.ok(record, identity);
    const description = prepareSourceProduct(record).product.description_general;
    assert.ok(description, identity);
    for (const fragment of fragments) {
      assert.ok(description.includes(fragment), `${identity}: ${fragment}`);
    }
  }
});
