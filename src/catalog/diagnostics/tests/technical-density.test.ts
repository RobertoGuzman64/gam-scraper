import assert from "node:assert/strict";
import test from "node:test";
import { analyzeTechnicalDensity } from "../technical-density.js";
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
