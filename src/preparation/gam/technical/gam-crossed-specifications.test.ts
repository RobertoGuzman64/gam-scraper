import assert from "node:assert/strict";
import test from "node:test";
import type { ProductRecord, SpecsMap } from "../../../contracts/catalog.js";
import { resolveAttribute } from "../../shared/classification/mapping/attribute-mapping.js";
import { SOURCE_TECHNICAL_FIELDS } from "../../shared/technical/source/technical-fields.js";
import { readCanonicalCatalog } from "../../../infrastructure/filesystem/catalog/canonical-catalog.js";
import { recoverGamCrossedTechnicalSpecs } from "./crossed-specifications.js";
import { prepareSourceProduct } from "../../prepare-product.js";

const attribute = (name: string) => {
  const result = SOURCE_TECHNICAL_FIELDS.find((item) => item.name === name);
  assert.ok(result, name);
  return result;
};

const record = (url: string, title: string, model: string, specs: SpecsMap): ProductRecord => ({
  providerId: "gam", categoryKey: "marcas-nuevas", categoryName: "Marcas nuevas",
  url, title, shortDescription: title, longDescription: `${title}: ficha de Yale ${model}`,
  reference: "referencia", price: null, brand: "YALE", model, year: null,
  location: null, country: null, horometer: null, serialNumber: null,
  condition: "Nuevo", image: null, specs: { Modelo: model, ...specs }
});

const stacker = (model: "MC12" | "MC15"): ProductRecord => record(
  `https://online.gamrentals.com/es/apiladores-yale/2300-apilador-electrico-a-pie-yale-${model.toLowerCase()}`,
  `Apilador eléctrico a pie Yale ${model}`, `${model} (pedestrian)`, {
    "Centro de carga": "5076 mm", "Capacidad de carga (kg)": `${model === "MC12" ? 1200 : 1500} KG`,
    "Radio de giro": "24V / 400Ah(V/Ah)", "Capacidad de la batería": model === "MC12" ? "2280" : "2360"
  }
);

const pallet = (raw: string): ProductRecord => record(
  "https://online.gamrentals.com/es/transpaletas-yale/2242-transpaleta-electrica-a-pie-yale-mp16",
  "Transpaleta eléctrica a pie Yale MP16", "MP16", {
    Peso: "545 KG", "Capacidad de la batería": "545", "Altura Plataforma": raw
  }
);

test("GAM: los campos cruzados del apilador Yale se reubican solo con evidencia coherente", () => {
  for (const [model, weight] of [["MC12", 2280], ["MC15", 2360]] as const) {
    const source = stacker(model);
    assert.deepEqual(resolveAttribute(source, attribute("Radio de giro")), { status: "not_observed", value: null });
    assert.deepEqual(resolveAttribute(source, attribute("Centro de carga")), { status: "not_observed", value: null });
    assert.deepEqual(resolveAttribute(source, attribute("Altura de elevación")), { status: "resolved", value: 5076 });
    assert.deepEqual(resolveAttribute(source, attribute("Peso")), { status: "resolved", value: weight });
    assert.deepEqual(resolveAttribute(source, attribute("Batería (V / Ah)")), { status: "resolved", value: "24 V / 400 Ah" });
    assert.ok(!prepareSourceProduct(source).issues.includes("Atributo no normalizable: Radio de giro"));
    assert.equal(source.specs?.["Radio de giro"], "24V / 400Ah(V/Ah)");
  }
});

test("GAM: un apilador de otra ruta o con datos contradictorios conserva la revisión", () => {
  const source = stacker("MC12");
  const cases = [
    { ...source, url: source.url.replace("apiladores-yale", "carretillas-yale") },
    { ...source, specs: { ...source.specs, "Capacidad de la batería": "3000" } },
    { ...source, specs: { ...source.specs, "Radio de giro": "24V / 450Ah(V/Ah)" } },
    { ...source, model: "MC10 (pedestrian)" }
  ];
  for (const product of cases) {
    assert.deepEqual(resolveAttribute(product, attribute("Radio de giro")), { status: "invalid", value: null });
  }
});

test("GAM: la batería publicada como altura de plataforma no produce una altura ficticia", () => {
  for (const raw of ["24V / 150-375Ah | Li-ion 24V / 50-100Ah(V/Ah) metros", "24V / 465Ah(V/Ah) metros"]) {
    const source = pallet(raw);
    assert.deepEqual(resolveAttribute(source, attribute("Altura de plataforma")), { status: "not_observed", value: null });
    assert.ok(!prepareSourceProduct(source).issues.includes("Atributo no normalizable: Altura de plataforma"));
    assert.equal(source.specs?.["Altura Plataforma"], raw);
  }
  const simple = pallet("24V / 465Ah(V/Ah) metros");
  assert.deepEqual(resolveAttribute(simple, attribute("Batería (V / Ah)")), { status: "resolved", value: "24 V / 465 Ah" });
  assert.deepEqual(resolveAttribute({ ...simple, specs: { ...simple.specs, "Capacidad de la batería": "750" } }, attribute("Batería (V / Ah)")),
    { status: "not_observed", value: null });
  assert.deepEqual(resolveAttribute(pallet("24V / 150-375Ah | Li-ion 24V / 50-100Ah(V/Ah) metros"), attribute("Batería (V / Ah)")),
    { status: "not_observed", value: null });
});

test("GAM: los valores incompatibles o las rutas ajenas no se omiten por apariencia", () => {
  const source = pallet("24V / 465Ah(V/Ah) metros");
  const cases = [
    { ...source, url: source.url.replace("transpaletas-yale", "apiladores-yale") },
    { ...source, specs: { ...source.specs, "Altura Plataforma": "24V / 465Ah(V/Ah)" } },
    { ...source, model: "MP18" }
  ];
  for (const product of cases) {
    assert.deepEqual(resolveAttribute(product, attribute("Altura de plataforma")), { status: "invalid", value: null });
  }
});

const canonicalGam = await readCanonicalCatalog("catalogs/providers/gam/original/scrape-gam-catalog.json");
const canonicalRecord = (reference: string): ProductRecord => {
  const source = canonicalGam.products.find((item) => item.reference === reference);
  assert.ok(source, reference);
  return source;
};

test("GAM: las transpaletas Yale acreditadas recuperan batería sin duplicar el peso ni inventar altura", () => {
  for (const reference of ["2242", "2243", "2244", "2245", "2246", "2247"]) {
    const source = canonicalRecord(reference);
    const original = structuredClone(source);
    const recovered = recoverGamCrossedTechnicalSpecs(source);
    const prepared = prepareSourceProduct(source).product.spec;
    assert.equal(prepared["Batería (V / Ah)"], recovered["Batería (V / Ah)"], reference);
    assert.equal(prepared["Peso"], source.specs?.["Peso"], reference);
    assert.equal(prepared["Altura Plataforma"], undefined, reference);
    assert.equal(prepared["Capacidad de la batería"], undefined, reference);
    assert.equal(prepared["Capacidad de carga (kg)"], source.specs?.["Capacidad de carga (kg)"], reference);
    assert.deepEqual(recoverGamCrossedTechnicalSpecs({ ...source, specs: recovered }), recovered, reference);
    assert.deepEqual(source, original, reference);
  }
  assert.equal(prepareSourceProduct(canonicalRecord("2246")).product.spec["Batería (V / Ah)"], "24 V / 465 Ah");
  assert.equal(prepareSourceProduct(canonicalRecord("2242")).product.spec["Batería (V / Ah)"],
    "24V / 150-375Ah | Li-ion 24V / 50-100Ah(V/Ah)");
});

test("GAM: los apiladores Yale acreditados recuperan únicamente las tres magnitudes trasladadas", () => {
  for (const [reference, weight] of [["2300", "2280"], ["2301", "2360"]] as const) {
    const source = canonicalRecord(reference);
    const original = structuredClone(source);
    const recovered = recoverGamCrossedTechnicalSpecs(source);
    const prepared = prepareSourceProduct(source).product.spec;
    assert.equal(prepared["Altura de elevación (mm)"], "5076 mm", reference);
    assert.equal(prepared["Peso"], `${weight} kg`, reference);
    assert.equal(prepared["Batería (V / Ah)"], "24 V / 400 Ah", reference);
    for (const key of ["Centro de carga", "Radio de giro", "Capacidad de la batería"]) {
      assert.equal(prepared[key], undefined, `${reference}: ${key}`);
    }
    assert.equal(prepared["Capacidad de carga (kg)"], source.specs?.["Capacidad de carga (kg)"], reference);
    assert.deepEqual(recoverGamCrossedTechnicalSpecs({ ...source, specs: recovered }), recovered, reference);
    assert.deepEqual(source, original, reference);
  }
});

test("GAM: no se altera un cruce sin identificación y correspondencia de valores suficiente", () => {
  const stacker = canonicalRecord("2300");
  const pallet = canonicalRecord("2246");
  const unrelated = ["2241", "2248", "2249", "2250", "72", "73"];
  const altered: ProductRecord[] = [
    { ...stacker, reference: "2302" },
    { ...stacker, url: `${stacker.url}?variante=otra` },
    { ...stacker, model: "MC10 (pedestrian)" },
    { ...stacker, specs: { ...stacker.specs, "Centro de carga": "6000 mm" } },
    { ...stacker, specs: { ...stacker.specs, "Batería (V / Ah)": "24 V / 500 Ah" } },
    { ...pallet, reference: "2245" },
    { ...pallet, model: "MP25T" },
    { ...pallet, specs: { ...pallet.specs, "Peso": "999 KG" } },
    { ...pallet, specs: { ...pallet.specs, "Batería (V / Ah)": "24 V / 465 Ah" } }
  ];
  for (const candidate of [...unrelated.map(canonicalRecord), ...altered]) {
    assert.deepEqual(recoverGamCrossedTechnicalSpecs(candidate), candidate.specs ?? {}, candidate.reference ?? "sin referencia");
  }
});
