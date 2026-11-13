import { accreditedSourceSamples } from "../../../../testing/domain-cases/accredited-source-samples.js";
import assert from "node:assert/strict";
import test from "node:test";
import type { ProductRecord } from "../../../../contracts/catalog.js";
import { loadImportCatalog } from "../../../../infrastructure/filesystem/legacy-export/import-catalog-loader.js";
import { resolveAttribute } from "../../classification/mapping/attribute-mapping.js";
import { prepareProduct } from "../../../../commercial/legacy-export/prepare-product.js";

const catalog = await loadImportCatalog();
const gam = { products: accreditedSourceSamples("gam-historical") };
const mercaeleva = { products: accreditedSourceSamples("mercaeleva-historical") };

const sources = new Map<string, readonly ProductRecord[]>([
  ["gam", gam.products],
  ["mercaeleva", mercaeleva.products]
]);

const record = (provider: "gam" | "mercaeleva", reference: string): ProductRecord => {
  const found = sources.get(provider)?.find((product) => product.reference === reference);
  assert.ok(found, `${provider}:${reference}`);
  return found;
};

const attribute = (name: string) => {
  const found = catalog.attributes.find((entry) => entry.name === name);
  assert.ok(found, name);
  return found;
};


const gamVariableCapacity = ["237", "235"] as const;
const mercaelevaConflictingCapacity = ["M582-1882", "M827-8304", "M062-8951", "M119-9334"] as const;
const gamNonUnivocalPower = ["6834", "1210", "1218", "1212", "1213", "1216", "1217", "1219"] as const;


test("las dos capacidades multivalor GAM no se convierten en una carga puntual", () => {
  const capacity = attribute("Capacidad de carga");
  for (const reference of gamVariableCapacity) {
    const product = record("gam", reference);
    assert.deepEqual(resolveAttribute(product, capacity), { status: "not_observed", value: null }, reference);
    assert.equal(prepareProduct(product, catalog).status, "ready", reference);
    assert.ok(!prepareProduct(product, catalog).product.attributes.some((item) => item.attributeID === capacity.id), reference);
  }
});

test("las cuatro capacidades conservan el origen tras reconciliar dos modelos MB y la UniCarriers", () => {
  const capacity = attribute("Capacidad de carga");
  for (const reference of mercaelevaConflictingCapacity) {
    const product = record("mercaeleva", reference);
    const originalSpecs = JSON.stringify(product.specs);
    const expected = reference === "M062-8951" ? 3000 : reference === "M119-9334" ? 1800 : null;
    assert.deepEqual(resolveAttribute(product, capacity), expected === null
      ? { status: "contradiction", value: null }
      : { status: "resolved", value: expected }, reference);
    const prepared = prepareProduct(product, catalog);
    assert.equal(prepared.issues.includes("Atributo contradictorio: Capacidad de carga"), expected === null && !["M582-1882", "M827-8304"].includes(reference), reference);
    assert.equal(JSON.stringify(product.specs), originalSpecs, reference);
    assert.deepEqual(prepared.product.spec, reference === "M582-1882"
      ? { ...product.specs, "Título adicional": "CARRETILLA ELEVADORA DIESEL 2500 KG" }
      : reference === "M827-8304"
        ? { ...product.specs, "Capacidad máxima de elevación": "4800 kg", "Tipo de mástil": "Dúplex/estándar" }
        : expected === null ? product.specs : {
          ...Object.fromEntries(Object.entries(product.specs ?? {}).filter(([key]) =>
            key !== (reference === "M062-8951" ? "Distancia del centro de gravedad" : "Horas laborales"))),
          "Capacidad máxima de elevación": `${expected} kg`
        }, reference);
  }
  const linde = prepareProduct(record("mercaeleva", "M827-8304"), catalog);
  assert.deepEqual(linde.issues, []);
  assert.equal(linde.product.spec["Tipo de mástil"], "Dúplex/estándar");
  assert.ok(!prepareProduct(record("mercaeleva", "M119-9334"), catalog).issues.includes("Atributo no normalizable: Horas de uso"));
});

test("las potencias GAM nominales no confunden kW con kVA ni regímenes", () => {
  const power = attribute("Potencia");
  for (const reference of gamNonUnivocalPower) {
    const product = record("gam", reference);
    const source = JSON.stringify(product.specs);
    assert.equal(resolveAttribute(product, power).status, "resolved", reference);
    assert.equal(prepareProduct(product, catalog).status, "ready", reference);
    assert.equal(JSON.stringify(product.specs), source, reference);
  }
});

test("potencia no unívoca y capacidad nominal son conceptos separados", () => {
  const generator = record("gam", "1211");
  assert.match(generator.shortDescription ?? "", /Potencia Emergencia: 83\.0 Kva/);
  assert.match(generator.shortDescription ?? "", /Potencia continuo: 78\.0 Kva/);
  assert.equal(generator.specs?.["Potencia Motor (KW)"], "76 / 72");
  assert.deepEqual(resolveAttribute(generator, attribute("Potencia")), { status: "resolved", value: 80 });
  const lift = record("gam", "2016");
  assert.equal(lift.specs?.["Capacidad de carga (kg)"], "1600 KG");
  assert.match(lift.shortDescription ?? "", /1800 kg/i);
  assert.deepEqual(resolveAttribute(lift, attribute("Capacidad de carga")), { status: "resolved", value: 1800 });
});

test("la capacidad multivariante explícita no desaparece si falta la especificación", () => {
  const original = record("gam", "235");
  const specs = { ...original.specs };
  delete specs["Capacidad de carga (kg)"];
  const withoutDirect = { ...original, specs };
  assert.equal(resolveAttribute(withoutDirect, attribute("Capacidad de carga")).status, "rejected");
  assert.ok(prepareProduct(withoutDirect, catalog).issues.includes("Atributo rechazado por seguridad: Capacidad de carga"));
  const unambiguous = { ...withoutDirect, shortDescription: "Logitrans Panther con capacidad de carga de 1600 kg" };
  assert.deepEqual(resolveAttribute(unambiguous, attribute("Capacidad de carga")), { status: "resolved", value: 1600 });
});
