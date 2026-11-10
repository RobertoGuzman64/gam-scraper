import assert from "node:assert/strict";
import test from "node:test";
import { analyzeTechnicalDensity } from "../technical-density.js";
import { resolveAccreditedPublication, readAccreditedPublication } from "../../../infrastructure/filesystem/catalog/accredited-publication.js";
import type { ImportCandidate } from "../../../commercial/legacy-export/contracts.js";

const candidate = (reference: string, spec: ImportCandidate["spec"], providerId = "proveedor"): ImportCandidate => ({
  providerId, sourceUrl: `https://example.com/${reference}`, reference, title: `Máquina ${reference}`,
  categorySellID: null, category: "Elevación", condition: "Segunda_Mano", price: null,
  description_title: null, description: null, description_general: null, image: null, images: [],
  spec, attributes: []
});

test("la densidad técnica separa prestaciones de metadatos y no inventa campos obligatorios", () => {
  const report = analyzeTechnicalDensity([
    candidate("1", { Marca: "JLG", Modelo: "1930ES", "Año de fabricación": "2018", "Horas laborales": "300 h",
      Estado: "Usado", "Título adicional": "Elevador", "Tipo de motor": "Eléctrico", "Altura de trabajo": "7,8 m" }),
    candidate("2", { Marca: "JLG", Modelo: "1930ES", "Tipo de motor": "Eléctrico", "Altura de trabajo": "7,8 m", Capacidad: "230 kg" }),
    candidate("3", { Marca: "JLG", Modelo: "1930ES", "Tipo de motor": "", "Altura de trabajo": [] }),
    candidate("4", { Marca: "JLG", Modelo: "450AJ", "Altura de trabajo": "15 m" }, "otro"),
    candidate("5", { Marca: "JLG", Modelo: "450AJ", "Tipo de motor": "Diésel", "Altura de trabajo": "15 m",
      Capacidad: "230 kg", Peso: "6.000 kg" }, "otro")
  ]);
  assert.equal(report.totals.products, 5);
  assert.equal(report.totals.sparse, 3);
  assert.equal(report.totals.medium, 1);
  assert.equal(report.cases.length, 3);
  assert.equal(report.mediumCases.length, 1);
  assert.deepEqual(report.providers.map((item) => [item.providerId, item.products, item.sparse, item.median]),
    [["otro", 2, 1, 2.5], ["proveedor", 3, 2, 2]]);
  assert.deepEqual(report.cases.map((item) => [item.reference, item.technicalCount, item.priority]),
    [["3", 0, "alta"], ["4", 1, "alta"], ["1", 2, "alta"]]);
  assert.deepEqual(report.mediumCases.map((item) => [item.reference, item.technicalCount, item.priority]),
    [["2", 3, "media"]]);
  assert.deepEqual(report.cases.find((item) => item.reference === "1")?.technicalKeys,
    ["Altura de trabajo (mm)", "Tipo de motor"]);
  assert.deepEqual(report.models.find((item) => item.providerId === "proveedor"), {
    providerId: "proveedor", brand: "JLG", model: "1930ES", products: 3, sparse: 2, medium: 1, examples: ["1", "2", "3"]
  });
  assert.match(report.note, /Sin bloqueo de publicación/);
  assert.deepEqual(report.criteria, { sparseMaximum: 2, mediumMaximum: 3 });
  assert.equal([...report.cases, ...report.mediumCases].some((item) => item.reference === "5"), false);
});

test("el criterio se aplica también a proveedores nuevos y rechaza duplicados", () => {
  const report = analyzeTechnicalDensity([
    candidate("5", { "Capacidad": "200 kg", "Alcance": "9 m", "Peso": "1500 kg" }, "nuevo"),
    candidate("6", { "Nº de serie": "123", "Certificación CE": "Sí" }, "nuevo")
  ]);
  assert.equal(report.providers[0]?.providerId, "nuevo");
  assert.equal(report.providers[0]?.sparse, 1);
  assert.equal(report.providers[0]?.medium, 1);
  assert.equal(report.providers[0]?.median, 1.5);
  assert.throws(() => analyzeTechnicalDensity([candidate("5", {}), candidate("5", {})]), /duplicada/);
});


test("la densidad publicada refleja la recuperación documental de las dos JLG sin maquillar el resto", async () => {
  const products: ImportCandidate[] = [];
  for (const providerId of ["gam", "gomariz", "mercaeleva"]) {
    const path = await resolveAccreditedPublication(process.cwd(), providerId);
    assert.ok(path, providerId);
    products.push(...(await readAccreditedPublication(path)).products);
  }
  const before = JSON.stringify(products);
  const report = analyzeTechnicalDensity(products);
  const jlg = products.filter((item) => item.providerId === "mercaeleva" &&
    (item.reference === "M838-0666" || item.reference === "M969-4655"));
  assert.equal(jlg.length, 2);
  const documented = jlg.every((item) => item.spec["Altura de plataforma"] === "13,72 m" &&
    item.spec["Alcance horizontal"] === "7,47 m");
  const previouslyPublished = jlg.every((item) => !("Altura de plataforma" in item.spec) &&
    !("Alcance horizontal" in item.spec));
  assert.ok(documented || previouslyPublished);
  const modelGam = products.filter((item) => item.providerId === "gam" &&
    (item.reference === "2737" || item.reference === "6688"));
  assert.equal(modelGam.length, 2);
  const documentedGam = modelGam.every((item) => item.reference === "2737" ?
    item.spec["Cargador a bordo del modelo"] === "Sí" :
    item.spec["Longitud exterior del modelo"] === "4120 mm");
  const previousGam = modelGam.every((item) => item.reference === "2737" ?
    !("Cargador a bordo del modelo" in item.spec) :
    !("Longitud exterior del modelo" in item.spec));
  assert.ok(documentedGam || previousGam);
  const toyota = products.find((item) => item.providerId === "mercaeleva" && item.reference === "M547-2372");
  assert.ok(toyota);
  const documentedToyota = toyota.spec["Centro de carga nominal del modelo"] === "600 mm" &&
    toyota.spec["Anchura exterior del modelo"] === "1250 mm" &&
    toyota.spec["Radio de giro exterior del modelo"] === "1570 mm" &&
    toyota.spec["Capacidad nominal según texto comercial"] === "1.350 kg" &&
    toyota.spec.Propulsión === "Eléctrica";
  const partiallyDocumentedToyota = toyota.spec["Capacidad nominal según texto comercial"] === "1.350 kg" &&
    toyota.spec.Propulsión === "Eléctrica" && !("Centro de carga nominal del modelo" in toyota.spec) &&
    !("Anchura exterior del modelo" in toyota.spec) && !("Radio de giro exterior del modelo" in toyota.spec);
  const originalToyota = ["Capacidad nominal según texto comercial", "Propulsión",
    "Centro de carga nominal del modelo", "Anchura exterior del modelo", "Radio de giro exterior del modelo"]
    .every((key) => !(key in toyota.spec));
  assert.ok(documentedToyota || partiallyDocumentedToyota || originalToyota);
  assert.deepEqual(report.totals, { products: 1344, sparse: documentedToyota ? 0 : documented ? 1 : 3,
    medium: documentedGam ? 0 : 2 });
  assert.deepEqual(report.cases.map((item) => [item.providerId, item.reference, item.technicalCount]), [
    ...(documentedToyota ? [] : [["mercaeleva", "M547-2372", partiallyDocumentedToyota ? 2 : 0] as const]),
    ...(documented ? [] : [
      ["mercaeleva", "M838-0666", 2],
      ["mercaeleva", "M969-4655", 2]
    ])
  ]);
  assert.deepEqual(report.mediumCases.map((item) => [item.providerId, item.reference, item.technicalCount]),
    documentedGam ? [] : [["gam", "2737", 3], ["gam", "6688", 3]]);
  if (!documentedToyota) assert.deepEqual(report.cases.find((item) => item.reference === "M547-2372")?.technicalKeys,
    partiallyDocumentedToyota ? ["Capacidad nominal según texto comercial", "Propulsión"] : []);
  else assert.equal(report.cases.some((item) => item.reference === "M547-2372"), false);
  assert.match(report.note, /Sin bloqueo de publicación/);
  assert.equal(JSON.stringify(products), before);
});
