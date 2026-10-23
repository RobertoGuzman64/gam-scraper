import assert from "node:assert/strict";
import test from "node:test";
import { collectGomarizSpecs } from "../specifications.js";

const section = (fields: string): string =>
  `Descripción Máquina de ocasión. Dimensiones ${fields} Ver ficha técnica Máquinas similares Motor: Gasolina Capacidad: 999 kg`;

test("Gomariz: conserva alturas contradictorias con su valor original", () => {
  const specs = collectGomarizSpecs(section("Altura plataforma: 3.07 m Altura de trabajo: 20 m Altura almacenaje: 3.07 m"));
  assert.deepEqual(specs, {
    "Altura plataforma": "3.07 m",
    "Altura de trabajo": "20 m",
    "Altura almacenaje": "3.07 m"
  });
});

test("Gomariz: conserva todas las variantes distintas de una especificación sin duplicarlas", () => {
  const specs = collectGomarizSpecs(section("Motor: Diésel Capacidad: 350 l Motor: Eléctrico Motor: Gasolina Motor: Diésel Capacidad: 400 l Potencia: 45 kVA"));
  assert.deepEqual(specs, {
    Motor: ["Diésel", "Eléctrico", "Gasolina"],
    Capacidad: ["350 l", "400 l"],
    Potencia: "45 kVA"
  });
});

test("Gomariz: conserva escalar cuando una etiqueta repite el mismo valor", () => {
  const specs = collectGomarizSpecs(section("Motor: Diésel Motor: Diésel Capacidad: 350 l"));
  assert.deepEqual(specs, { Motor: "Diésel", Capacidad: "350 l" });
});

test("Gomariz: no mezcla texto comercial ni productos similares con especificaciones", () => {
  const specs = collectGomarizSpecs("Descripción Motor: Gasolina. Dimensiones Longitud: 3 m Ver ficha técnica Máquinas similares Motor: Eléctrico");
  assert.deepEqual(specs, { Longitud: "3 m" });
});
