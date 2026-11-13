import assert from "node:assert/strict";
import test from "node:test";
import { resolveAccreditedPublication, readAccreditedPublication } from "../../../../../infrastructure/filesystem/catalog/accredited-publication.js";
import { readCanonicalCatalog } from "../../../../../infrastructure/filesystem/catalog/canonical-catalog.js";
import { inspectTechnicalCoherence } from "../../../../../catalog/validation/technical-specifications.js";
import { projectCommercialPresentation } from "../../../../../commercial/projection/presentation-projection.js";
import type { SpecValue } from "../../../../../contracts/catalog.js";
import type { ImportCandidate } from "../../../../../commercial/legacy-export/contracts.js";
import { analyzePresentationConsistency } from "../../../../../commercial/diagnostics/presentation-consistency.js";
import { hasLoadCapacityDisagreement, inspectTechnicalSpecifications } from "../../../../../commercial/validation/technical-specifications.js";
import { projectPresentableSpecifications } from "../../../../../commercial/projection/spec-projection.js";

const publication = async (providerId: string): Promise<readonly ImportCandidate[]> => {
  const path = await resolveAccreditedPublication(process.cwd(), providerId);
  assert.ok(path, providerId);
  return (await readAccreditedPublication(path)).products;
};

const knownTechnicalReferences = ["2248", "2249", "2250", "2305", "72", "73"];
const knownCapacityReferences = ["gam:6837", "mercaeleva:M062-8951", "mercaeleva:M119-9334"];

test("las publicaciones actuales no reintroducen magnitudes incompatibles presentes en los originales", async () => {
  const [originals, products] = await Promise.all([
    readCanonicalCatalog("catalogs/providers/gam/original/scrape-gam-catalog.json"), publication("gam")
  ]);
  const before = JSON.stringify([originals.products, products]);
  const originalsByReference = new Map(originals.products.map((product) => [product.reference, product]));
  const publishedByReference = new Map(products.map((product) => [product.reference, product]));
  assert.deepEqual(products.filter((product) => inspectTechnicalSpecifications(product.spec).length > 0), []);
  for (const reference of knownTechnicalReferences) {
    const source = originalsByReference.get(reference);
    const published = publishedByReference.get(reference);
    assert.ok(source && published, reference);
    const sourceSpecs = source.specs;
    assert.ok(sourceSpecs, reference);
    assert.ok(inspectTechnicalSpecifications(sourceSpecs).length > 0, reference);
    assert.deepEqual(inspectTechnicalSpecifications(published.spec), [], reference);
    assert.deepEqual(inspectTechnicalCoherence(published.spec), [], reference);
    assert.deepEqual(projectPresentableSpecifications(published.spec), published.spec, reference);
  }
  assert.equal(JSON.stringify([originals.products, products]), before);
});

test("las tres capacidades acreditadas permanecen corregidas sin alterar las contradicciones del original", async () => {
  const [originalGam, originalMercaeleva, publishedGam, publishedMercaeleva] = await Promise.all([
    readCanonicalCatalog("catalogs/providers/gam/original/scrape-gam-catalog.json"),
    readCanonicalCatalog("catalogs/providers/mercaeleva/original/scrape-mercaeleva-catalog.json"),
    publication("gam"), publication("mercaeleva")
  ]);
  const originals = [...originalGam.products, ...originalMercaeleva.products];
  const products = [...publishedGam, ...publishedMercaeleva];
  for (const key of knownCapacityReferences) {
    const original = originals.find((item) => `${item.providerId}:${item.reference}` === key);
    const published = products.find((item) => `${item.providerId}:${item.reference}` === key);
    assert.ok(original && published, key);
    assert.equal(hasLoadCapacityDisagreement({ title: original.title, spec: original.specs ?? {} }), true, key);
    assert.equal(hasLoadCapacityDisagreement(published), false, key);
  }
  assert.deepEqual(products.filter(hasLoadCapacityDisagreement), []);
  const report = analyzePresentationConsistency(products);
  assert.deepEqual(report.findings.filter((item) => item.code === "capacidad-titulo-spec-discordante"), []);
});

test("no bloquea medidas físicas válidas ni transforma implícitamente metros a milímetros", () => {
  const spec = {
    "Altura Plataforma": "9,5 metros",
    "Radio de giro": "1,98 m",
    "Radio de giro (exterior)": "1601 mm",
    "Capacidad de la batería": "24 V / 400 Ah",
    "Altura de elevación (mm)": "16900 mm",
    "Número de serie": "12345"
  };
  assert.deepEqual(inspectTechnicalSpecifications(spec), []);
  assert.deepEqual(projectPresentableSpecifications(spec), spec);
  assert.deepEqual(projectPresentableSpecifications({
    ...spec, "Altura Plataforma": "9225 metros", "Radio de giro": "24V / 400Ah(V/Ah)",
    "Capacidad de la batería": "1000mm", "Altura de elevación (mm)": "#VALUE! mm"
  }), {
    "Radio de giro (exterior)": "1601 mm", "Número de serie": "12345"
  });
});

test("retiene completos los campos multivalor válidos y excluye campos con residuos parciales", () => {
  assert.deepEqual(projectPresentableSpecifications({
    "Altura Plataforma": ["8 m", "24 V / 400 Ah"],
    "Capacidad de la batería": ["24 V / 400 Ah", "48 V / 500 Ah"],
    "Radio de giro": "6085mm metros",
    "Anchura": "24V / 840-1000Ah(V/Ah)",
    Modelo: "MPC14"
  }), { "Capacidad de la batería": ["24 V / 400 Ah", "48 V / 500 Ah"], Modelo: "MPC14" });
});


test("corrige las especificaciones comerciales con evidencia real sin reescribir originales ni publicaciones", async () => {
  const [originals, publishedGam, publishedMercaeleva] = await Promise.all([
    readCanonicalCatalog("catalogs/providers/gam/original/scrape-gam-catalog.json"),
    publication("gam"), publication("mercaeleva")
  ]);
  const before = JSON.stringify([originals.products, publishedGam, publishedMercaeleva]);
  const originalsByReference = new Map(originals.products.map((item) => [item.reference, item]));
  const gamByReference = new Map(publishedGam.map((item) => [item.reference, item]));
  const mercaelevaByReference = new Map(publishedMercaeleva.map((item) => [item.reference, item]));
  const presentation = (reference: string) => {
    const source = originalsByReference.get(reference);
    const published = gamByReference.get(reference);
    assert.ok(source && published, reference);
    const output = projectCommercialPresentation(source, published, null);
    assert.deepEqual(inspectTechnicalSpecifications(output.spec), []);
    assert.deepEqual(inspectTechnicalCoherence(output.spec), []);
    return output.spec;
  };
  for (const [reference, weight] of [["2300", 2280], ["2301", 2360]] as const) {
    const spec = presentation(reference);
    assert.equal(spec["Centro de carga"], undefined);
    assert.equal(spec["Radio de giro"], undefined);
    assert.equal(spec["Capacidad de la batería"], undefined);
    assert.equal(spec["Altura de elevación (mm)"], "5076 mm");
    assert.equal(spec["Peso"], `${weight} kg`);
    assert.equal(spec["Batería (V / Ah)"], "24 V / 400 Ah");
  }
  for (const reference of ["2242", "2243", "2244", "2245", "2246", "2247"]) {
    const spec = presentation(reference);
    assert.equal(spec["Capacidad de la batería"], undefined);
    assert.equal(spec["Altura Plataforma"], undefined);
    if (reference === "2246" || reference === "2247") {
      assert.equal(spec["Batería (V / Ah)"], "24 V / 465 Ah");
    } else assert.match(String(spec["Batería (V / Ah)"]), /^24V \/ /u);
    if (reference === "2244") assert.equal(spec["Centro de carga"], "130 mm");
  }
  assert.equal(presentation("2248")["Capacidad de la batería"], "24V / 250AH(V/Ah)");
  assert.equal(presentation("2248")["Batería (V / Ah)"], undefined);
  for (const reference of ["2249", "2250"]) {
    assert.equal(presentation(reference)["Batería (V / Ah)"], "24V / 315-500Ah(V/Ah)", reference);
    assert.equal(presentation(reference)["Capacidad de la batería"], undefined, reference);
    assert.equal(presentation(reference)["Altura Plataforma"], undefined, reference);
    assert.equal(presentation(reference).Peso, "678 KG", reference);
  }
  assert.equal(presentation("2241")["Centro de carga"], undefined);
  assert.equal(presentation("2241")["Altura de elevación (mm)"], "8895 mm");
  assert.equal(presentation("2241")["Altura Plataforma"], "14 metros");
  for (const [reference, expected] of [
    ["1714", "600 mm"], ["2220", "500 mm"], ["2285", "500 mm"],
    ["2287", "500 mm"], ["2238", "1200 mm"]
  ] as const) assert.equal(presentation(reference)["Centro de carga"], expected);
  for (const [reference, key] of [
    ["M062-8951", "Distancia del centro de gravedad"],
    ["M119-9334", "Horas laborales"]
  ] as const) {
    const published = mercaelevaByReference.get(reference);
    assert.ok(published);
    const projected = projectPresentableSpecifications(published.spec);
    assert.equal(projected[key], undefined);
    assert.deepEqual(inspectTechnicalCoherence(projected), []);
  }
  assert.equal(JSON.stringify([originals.products, publishedGam, publishedMercaeleva]), before);
});

test("no aplica mapeos de Yale sin coincidencia de original, publicación y modelo", async () => {
  const [originals, publishedGam] = await Promise.all([
    readCanonicalCatalog("catalogs/providers/gam/original/scrape-gam-catalog.json"), publication("gam")
  ]);
  const source = originals.products.find((item) => item.reference === "2300");
  const published = publishedGam.find((item) => item.reference === "2300");
  assert.ok(source && published);
  const contaminated = { ...source.specs };
  const altered = projectPresentableSpecifications({ ...contaminated, "Centro de carga": "500 mm" }, source);
  assert.equal(altered["Altura de elevación (mm)"], undefined);
  assert.equal(altered["Peso"], undefined);
  assert.equal(altered["Batería (V / Ah)"], undefined);
  const differentModel = { ...source, model: "OTRO" };
  const unconfirmed = projectPresentableSpecifications(contaminated, differentModel);
  assert.equal(unconfirmed["Altura de elevación (mm)"], undefined);
  assert.equal(unconfirmed["Peso"], undefined);
  assert.equal(unconfirmed["Batería (V / Ah)"], undefined);
  const accredited = projectPresentableSpecifications(published.spec, source);
  assert.equal(accredited["Altura de elevación (mm)"], "5076 mm");
  assert.equal(accredited.Peso, "2280 kg");
  assert.equal(accredited["Batería (V / Ah)"], "24 V / 400 Ah");
});


test("la recuperación Yale conserva los campos ya publicados y exige la evidencia del original", async () => {
  const [originals, products] = await Promise.all([
    readCanonicalCatalog("catalogs/providers/gam/original/scrape-gam-catalog.json"), publication("gam")
  ]);
  for (const reference of ["2241", "2248", "2249", "2250"]) {
    const source = originals.products.find((item) => item.reference === reference);
    const published = products.find((item) => item.reference === reference);
    assert.ok(source && published, reference);
    const sourceSpecs = source.specs;
    assert.ok(sourceSpecs, reference);
    assert.deepEqual(projectPresentableSpecifications(published.spec, source), published.spec, reference);
    if (reference === "2248") {
      assert.equal(published.spec["Capacidad de la batería"], "24V / 250AH(V/Ah)");
      assert.equal(published.spec["Batería (V / Ah)"], undefined);
      continue;
    }
    const key = reference === "2241" ? "Altura de elevación (mm)" : "Batería (V / Ah)";
    assert.ok(published.spec[key] !== undefined, reference);
    assert.equal(projectPresentableSpecifications(sourceSpecs, source)[key], published.spec[key], reference);
    const differentModel = { ...source, model: "OTRO" };
    assert.equal(projectPresentableSpecifications(sourceSpecs, differentModel)[key], undefined, reference);
    const mismatched = projectPresentableSpecifications({ ...sourceSpecs, "Capacidad de carga (kg)": "999 KG" }, source);
    assert.equal(mismatched[key], undefined, reference);
  }
});


test("la cohorte GAM saneada conserva las especificaciones válidas sin requerir un segundo filtrado comercial", async () => {
  const [originals, published] = await Promise.all([
    readCanonicalCatalog("catalogs/providers/gam/original/scrape-gam-catalog.json"), publication("gam")
  ]);
  const sourceByReference = new Map(originals.products.map((product) => [product.reference, product]));
  const publishedByReference = new Map(published.map((product) => [product.reference, product]));
  const cases: readonly { reference: string; removed: readonly string[]; recovered: Readonly<Record<string, string>> }[] = [
    { reference: "2241", removed: ["Centro de carga"], recovered: { "Altura de elevación (mm)": "8895 mm" } },
    { reference: "2248", removed: ["Altura Plataforma"], recovered: {} },
    {
      reference: "2249", removed: ["Altura Plataforma", "Capacidad de la batería"],
      recovered: { "Batería (V / Ah)": "24V / 315-500Ah(V/Ah)" }
    },
    {
      reference: "2250", removed: ["Altura Plataforma", "Capacidad de la batería"],
      recovered: { "Batería (V / Ah)": "24V / 315-500Ah(V/Ah)" }
    },
    { reference: "72", removed: ["Capacidad de la batería"], recovered: {} },
    { reference: "73", removed: ["Capacidad de la batería"], recovered: {} },
    { reference: "2305", removed: ["Altura Plataforma"], recovered: {} }
  ];
  const before = JSON.stringify([originals.products, published]);
  for (const { reference, removed, recovered } of cases) {
    const source = sourceByReference.get(reference);
    const product = publishedByReference.get(reference);
    assert.ok(source && product, reference);
    const sourceSpecs = source.specs;
    assert.ok(sourceSpecs, reference);
    for (const key of removed) {
      assert.ok(key in sourceSpecs, `${reference}:${key}`);
      assert.ok(!(key in product.spec), `${reference}:${key}`);
    }
    for (const [key, value] of Object.entries(recovered)) {
      assert.equal(sourceSpecs[key], undefined, `${reference}:${key}`);
      assert.equal(product.spec[key], value, `${reference}:${key}`);
    }
    for (const [key, value] of Object.entries(sourceSpecs)) {
      if (!removed.includes(key)) assert.deepEqual(product.spec[key], value, `${reference}:${key}`);
    }
    assert.deepEqual(projectPresentableSpecifications(product.spec, source), product.spec, reference);
    assert.deepEqual(inspectTechnicalSpecifications(product.spec), [], reference);
    assert.deepEqual(inspectTechnicalCoherence(product.spec), [], reference);
  }
  assert.equal(JSON.stringify([originals.products, published]), before);
});
