import assert from "node:assert/strict";
import test from "node:test";
import { extractExplicitTechnicalSpecValues } from "../specification-text.js";

test("GAM: recupera dimensiones bidimensionales y tridimensionales con unidad explícita", () => {
  assert.deepEqual(extractExplicitTechnicalSpecValues("Dimensiones Cesta: 1,83 x 0,76 metros; Rotación de torreta: 700º."), {
    "Dimensiones Cesta": "1,83 x 0,76 metros", "Rotación de torreta": "700º"
  });
  assert.deepEqual(extractExplicitTechnicalSpecValues("Medidas de la cesta: 140x70x110 cm; Rotación de la torreta: 320°."), {
    "Dimensiones Cesta": "140x70x110 cm", "Rotación de torreta": "320°"
  });
});

test("GAM: no reconstruye dimensiones dañadas ni acepta unidades contradictorias", () => {
  for (const raw of [
    "1 76 83X0 metros", "1 1,83 x 0,76 76 83 x 0 metros", "4 81 88x1 metros", "18 3 81X2 metros",
    "1400x700x1100 mm cm", "1,83 x 0,76", "1400x700x1100 metros mm", "2,4x1,17 m metros"
  ]) {
    assert.equal(extractExplicitTechnicalSpecValues(`Dimensiones Cesta: ${raw};`)["Dimensiones Cesta"], undefined, raw);
  }
});

test("GAM: no transforma rotaciones por recorridos separados en ángulos simples", () => {
  for (const raw of ["190º+190º", "190° + 190°", "700º+20º", "90°/90°", "700 grados"]) {
    assert.equal(extractExplicitTechnicalSpecValues(`Rotación de torreta: ${raw};`)["Rotación de torreta"], undefined, raw);
  }
});

test("GAM: las declaraciones incompatibles no generan una medida acreditada", () => {
  assert.deepEqual(extractExplicitTechnicalSpecValues(
    "Dimensiones Cesta: 1,83 x 0,76 metros; Dimensiones Cesta: 2,4 x 1,17 metros; Rotación de torreta: 320º; Rotación de torreta: 700º."
  ), {});
  assert.equal(extractExplicitTechnicalSpecValues("Altura de trabajo: 10 m; Altura de trabajo: 12 m.")["Altura de trabajo"], undefined);
  assert.equal(extractExplicitTechnicalSpecValues("Altura de elevación: 8 m.")["Altura de elevación"], "8 m");
});
