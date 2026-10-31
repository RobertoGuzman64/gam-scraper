import assert from "node:assert/strict";
import test from "node:test";
import type { ProductRecord } from "../../../contracts/catalog.js";
import { readCanonicalCatalog } from "../../../infrastructure/filesystem/catalog/canonical-catalog.js";
import { resolveGomarizCriticalBriefGeneral } from "../mapping/providers/gomariz/critical-brief-general.js";
import { resolveGomarizGeneralDescription } from "../mapping/providers/gomariz/general-description.js";
import { prepareSourceProduct } from "../prepare-product.js";

const source = await readCanonicalCatalog("catalogs/providers/gomariz/original/scrape-gomariz-catalog.json");
const find = (reference: string): ProductRecord => {
  const record = source.products.find((item) => item.reference === reference);
  assert.ok(record, reference);
  return record;
};

test("Gomariz: las generales sustituyen texto de familia por datos específicos respaldados", () => {
  const cases = [
    ["TE1620", "La plataforma de tijera LGMG S1413EII", "15,8 m", "320 kg", "13,8 m"],
    ["TD1511", "La plataforma de tijera GENIE GS4390RT", "14,75 m", "680 kg", "12,75 m"],
    ["BA1335", "La plataforma articulada SKYJACK SJ85AJ", "27,74 m", "227 kg", "25,91 m"],
    ["BA1344", "La plataforma articulada Manitou 120 AETJC", "12 m", "200 kg", "10 m"],
    ["MT1661", "El manipulador telescópico JCB 540-140", "13,8 m", "4000 kg", "6,25 m"],
    ["CAE1207", "La carretilla industrial Nissan Q02L25CU", "2500 kg", "2,37 m", "1,18 m"]
  ] as const;
  for (const [reference, identity, first, second, third] of cases) {
    const record = find(reference);
    const original = JSON.stringify(record);
    const general = resolveGomarizGeneralDescription(record);
    assert.ok(general, reference);
    for (const fragment of [identity, first, second, third]) assert.ok(general.includes(fragment), `${reference}: ${fragment}`);
    assert.equal(general.includes(record.longDescription ?? ""), false, reference);
    const prepared = prepareSourceProduct(record);
    assert.equal(prepared.product.description_general, general, reference);
    assert.equal(prepared.product.reference, reference);
    assert.equal(prepared.product.sourceUrl, record.url);
    assert.deepEqual(prepared.product.spec, record.specs);
    assert.equal(JSON.stringify(record), original);
  }
});

test("Gomariz: contradicciones o descripción propia acreditada no se reescriben", () => {
  for (const reference of [
    "TE1858", "TE1621", "TE1622", "BA1465", "GR1113", "OR1537",
    "CC1535", "CC1666", "5051BDX", "PV556"
  ]) {
    const record = find(reference);
    assert.equal(resolveGomarizGeneralDescription(record), null, reference);
    assert.equal(prepareSourceProduct(record).product.description_general, record.longDescription, reference);
  }
});

test("Gomariz: rechaza identidades, proveedores y magnitudes incompatibles", () => {
  const record = find("TE1620");
  const variants: readonly ProductRecord[] = [
    { ...record, providerId: "gam" },
    { ...record, categoryKey: "alquiler" },
    { ...record, reference: null },
    { ...record, url: record.url.replace("gomarizrent.com", "example.com") },
    { ...record, url: record.url.replace("elevador-tijera", "brazo-articulado") },
    { ...record, brand: "Genie" },
    { ...record, model: "OTRO" },
    { ...record, title: "LGMG OTRO" },
    { ...record, longDescription: "La tijera LGMG S1413EII está descrita específicamente." },
    { ...record, longDescription: "Ficha técnica propia sin texto de familia" },
    { ...record, specs: { ...record.specs, "Altura de trabajo": "12 kg" } },
    { ...record, specs: { ...record.specs, "Altura plataforma": "16 m" } },
    { ...record, specs: { ...record.specs, Motor: "Diésel" } },
    { ...record, specs: { "Altura de trabajo": "15,8 m", Capacidad: "320 kg" } }
  ];
  for (const [index, variant] of variants.entries()) {
    assert.equal(resolveGomarizGeneralDescription(variant), null, String(index));
  }
});

test("Gomariz: el piloto se aplica solo a la cohorte segura y preserva todas las identidades", () => {
  const affected = source.products.filter((record) => resolveGomarizGeneralDescription(record) !== null);
  assert.equal(source.products.length, 143);
  assert.equal(affected.length, 116);
  const seen = new Set<string>();
  for (const record of source.products) {
    const reference = record.reference;
    assert.ok(reference && !seen.has(reference));
    seen.add(reference);
    const prepared = prepareSourceProduct(record);
    assert.equal(prepared.product.reference, reference);
    assert.equal(prepared.product.description_general,
      resolveGomarizCriticalBriefGeneral(record) ?? resolveGomarizGeneralDescription(record) ?? record.longDescription);
    assert.deepEqual(prepared.product.spec, record.specs);
  }
});

test("Gomariz: incorpora alcance lateral solo cuando está publicado con unidad y valor válido", () => {
  const reference = find("BA1335");
  const general = resolveGomarizGeneralDescription(reference);
  assert.ok(general?.includes("un alcance lateral de 17,07 m"));
  assert.ok(prepareSourceProduct(reference).product.description_general?.includes("17,07 m"));
  const other = find("MT1661");
  assert.ok(resolveGomarizGeneralDescription(other)?.includes("un alcance lateral de 9,25 m"));
  const zero = find("TE1602");
  assert.equal(zero.specs?.["Alcance lateral"], "0 m");
  assert.ok(!resolveGomarizGeneralDescription(zero)?.includes("alcance lateral"));
  for (const value of ["0 m", "-1 m", "8.45 kg", "8 y 10 m", ["8 m", "10 m"]]) {
    const variant = { ...reference, specs: { ...reference.specs, "Alcance lateral": value } };
    const description = resolveGomarizGeneralDescription(variant);
    assert.ok(description);
    assert.equal(description.includes("alcance lateral"), false);
  }
  const enriched = source.products.filter((record) =>
    resolveGomarizGeneralDescription(record)?.includes("alcance lateral"));
  assert.equal(enriched.length, 37);
});
