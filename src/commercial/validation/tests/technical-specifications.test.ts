import assert from "node:assert/strict";
import test from "node:test";
import { resolveAccreditedPublication, readAccreditedPublication } from "../../../infrastructure/filesystem/catalog/accredited-publication.js";
import { readCanonicalCatalog } from "../../../infrastructure/filesystem/catalog/canonical-catalog.js";
import { inspectTechnicalCoherence } from "../../../catalog/validation/technical-specifications.js";
import { projectCommercialPresentation } from "../../projection/presentation-projection.js";
import type { SpecValue } from "../../../contracts/catalog.js";
import type { ImportCandidate } from "../../legacy-export/contracts.js";
import { analyzePresentationConsistency } from "../../diagnostics/presentation-consistency.js";
import { hasLoadCapacityDisagreement, inspectTechnicalSpecifications } from "../technical-specifications.js";
import { projectPresentableSpecifications } from "../../projection/spec-projection.js";

const publication = async (providerId: string): Promise<readonly ImportCandidate[]> => {
  const path = await resolveAccreditedPublication(process.cwd(), providerId);
  assert.ok(path, providerId);
  return (await readAccreditedPublication(path)).products;
};

const knownTechnicalReferences = ["2242", "2243", "2244", "2245", "2246", "2247", "2248", "2249", "2250",
  "2300", "2301", "2263", "2265", "2267", "2302", "2305", "6114", "6115", "2130", "72", "73"];
const knownCapacityReferences = ["gam:1145", "gam:6514", "gam:6837", "mercaeleva:M062-8951", "mercaeleva:M119-9334"];

test("la proyección comercial oculta las 21 especificaciones corruptas vigentes sin alterar evidencias", async () => {
  const products = await publication("gam");
  const snapshot = JSON.stringify(products);
  const byReference = new Map(products.map((product) => [product.reference, product]));
  const affected = products.filter((product) => inspectTechnicalSpecifications(product.spec).length > 0);
  assert.deepEqual(affected.map((product) => product.reference).sort(), [...knownTechnicalReferences].sort());
  for (const reference of knownTechnicalReferences) {
    const product = byReference.get(reference);
    assert.ok(product, reference);
    const issues = inspectTechnicalSpecifications(product.spec);
    assert.ok(issues.length > 0, reference);
    const safe = projectPresentableSpecifications(product.spec);
    assert.deepEqual(inspectTechnicalSpecifications(safe), []);
    for (const issue of issues) {
      assert.ok(issue.key in product.spec, reference);
      assert.ok(!(issue.key in safe), `${reference}:${issue.key}`);
    }
    assert.deepEqual(inspectTechnicalCoherence(safe), []);
    for (const key of Object.keys(safe)) {
      const sourceValue: SpecValue | undefined = product.spec[key];
      if (sourceValue !== safe[key]) {
        assert.equal(key, "Centro de carga");
        assert.match(String(sourceValue), /^\d+mm mm$/u);
        assert.equal(safe[key], String(sourceValue).replace("mm mm", " mm"));
      }
    }
  }
  assert.equal(JSON.stringify(products), snapshot);
});

test("las cinco discrepancias de capacidad quedan en revisión, sin fijar automáticamente la capacidad nominal", async () => {
  const products = [...await publication("gam"), ...await publication("mercaeleva")];
  const flagged = products.filter(hasLoadCapacityDisagreement).map((product) => `${product.providerId}:${product.reference}`);
  assert.deepEqual(flagged.sort(), [...knownCapacityReferences].sort());
  const report = analyzePresentationConsistency(products);
  const capacity = report.findings.filter((item) => item.code === "capacidad-titulo-spec-discordante");
  assert.equal(capacity.length, knownCapacityReferences.length);
  assert.ok(capacity.every((item) => item.status === "revisar"));
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
  assert.equal(presentation("2250")["Batería (V / Ah)"], undefined);
  assert.equal(presentation("2250")["Capacidad de la batería"], undefined);
  assert.equal(presentation("2241")["Centro de carga"], undefined);
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
  const alteredPublished = { ...published, spec: { ...published.spec, "Centro de carga": "500 mm" } };
  const altered = projectPresentableSpecifications(alteredPublished.spec, source);
  assert.equal(altered["Altura de elevación (mm)"], undefined);
  assert.equal(altered["Peso"], undefined);
  assert.equal(altered["Batería (V / Ah)"], undefined);
  const differentModel = { ...source, model: "OTRO" };
  const unconfirmed = projectPresentableSpecifications(published.spec, differentModel);
  assert.equal(unconfirmed["Altura de elevación (mm)"], undefined);
  assert.equal(unconfirmed["Peso"], undefined);
  assert.equal(unconfirmed["Batería (V / Ah)"], undefined);
});
