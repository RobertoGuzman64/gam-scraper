import assert from "node:assert/strict";
import test from "node:test";
import type { ProductRecord, SpecsMap } from "../../../../contracts/catalog.js";
import { normalizeTechnicalPresentation } from "../reconciliation/technical-presentation.js";
import { normalizePreparedTechnicalSpecs } from "../reconciliation/preparation-technical-stages.js";

const source: ProductRecord = {
  providerId: "gam",
  categoryKey: "prueba",
  categoryName: "Maquinaria",
  url: "https://example.com/producto/demo",
  title: "Equipo DEMO",
  shortDescription: null,
  longDescription: null,
  price: null,
  reference: "PRUEBA-1",
  brand: "EQUIPTEST",
  model: "DEMO",
  year: null,
  location: null,
  country: null,
  horometer: null,
  serialNumber: null,
  image: null
};

test("la presentación binaria se normaliza en el núcleo sin depender del proveedor", () => {
  const input: SpecsMap = {
    Estabilizadores: "si",
    "Trabajo negativo": "no",
    Matriculada: "SI",
    Restaurada: "No",
    "Barra antiatrapamiento": "sí",
    Marca: "NO",
    Modelo: "SI",
    Referencia: "SI",
    "Nº de serie": "no",
    "Baterías nuevas": "SIN BATERÍAS",
    Motor: "SI",
    "Tipo motor": "SI",
    Potencia: "3,6 kW",
    Activo: true,
    Unidades: 2,
    Observaciones: ["si", "no"]
  };
  const original = JSON.stringify(input);
  for (const providerId of ["gam", "gomariz", "mercaeleva", "manain"]) {
    const output = normalizePreparedTechnicalSpecs({ ...source, providerId }, input);
    assert.equal(output.Estabilizadores, "Sí");
    assert.equal(output["Trabajo negativo"], "No");
    assert.equal(output.Matriculada, "Sí");
    assert.equal(output.Restaurada, "No");
    assert.equal(output["Barra antiatrapamiento"], "Sí");
    assert.equal(output.Marca, "NO");
    assert.equal(output.Modelo, "SI");
    assert.equal(output.Referencia, "SI");
    assert.equal(output["Nº de serie"], "no");
    assert.equal(output["Baterías nuevas"], "SIN BATERÍAS");
    assert.equal(output.Motor, "SI");
    assert.equal(output["Tipo motor"], "SI");
    assert.equal(output.Potencia, "3,6 kW");
    assert.equal(output.Activo, true);
    assert.equal(output.Unidades, 2);
    assert.deepEqual(output.Observaciones, ["si", "no"]);
  }
  assert.equal(JSON.stringify(input), original);
});

test("el tipo de mástil unívoco se presenta con ortografía uniforme y sin inferencias", () => {
  const input: SpecsMap = {
    "Tipo mastil": "triplex",
    "Tipo de mástil": "DUPLEX",
    "Tipo Mástil": "simplex",
    "Tipo de mastil": "cuadruplex",
    "Tipos de mástil": "triplex",
    "Mástil opcional": "duplex / triplex",
    Modelo: "TRIPLEX"
  };
  const output = normalizeTechnicalPresentation(input);
  assert.equal(output["Tipo mastil"], "Tríplex");
  assert.equal(output["Tipo de mástil"], "Dúplex");
  assert.equal(output["Tipo Mástil"], "Simple");
  assert.equal(output["Tipo de mastil"], "Cuádruplex");
  assert.equal(output["Tipos de mástil"], "triplex");
  assert.equal(output["Mástil opcional"], "duplex / triplex");
  assert.equal(output.Modelo, "TRIPLEX");
  assert.equal(normalizeTechnicalPresentation(output), output);
  assert.equal(input["Tipo mastil"], "triplex");
  assert.equal(normalizeTechnicalPresentation({ Peso: "2.400 kg", Motor: "Diésel" }).Peso, "2.400 kg");
});

test("una entrada sin cambios conserva la identidad del mapa", () => {
  const input: SpecsMap = { Modelo: "SI", Motor: "Diésel", "Tipo mastil": "Tríplex", Activo: true };
  assert.equal(normalizeTechnicalPresentation(input), input);
});
