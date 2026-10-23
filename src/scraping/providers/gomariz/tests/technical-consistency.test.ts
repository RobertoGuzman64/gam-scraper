import assert from "node:assert/strict";
import test from "node:test";
import { parseGomarizProduct } from "../parsers.js";

const url = (family: string): string =>
  `https://www.gomarizrent.com/venta/elevacion-y-trabajos-en-altura/${family}/prueba/`;
const html = (specs: string): string => `<html><main><h1>Máquina de ocasión</h1>
  <p>Referencia: TEST Año: 2022 Ver precio</p><h2>Descripción</h2><p>Ficha de ocasión.</p>
  <h2>Especificaciones técnicas</h2><p>${specs}</p><p>Ver ficha técnica</p></main></html>`;

test("Gomariz: conserva la altura de transporte contradictoria para que la preparación pueda bloquearla", () => {
  const result = parseGomarizProduct(html("Altura plataforma: 3.07 m Altura de trabajo: 20 m Altura almacenaje: 3.07 m Capacidad: 230 kg"), url("camion-plataforma"));
  assert.equal(result.specs?.["Altura plataforma"], "3.07 m");
  assert.equal(result.specs?.["Altura de trabajo"], "20 m");
  assert.equal(result.specs?.["Altura almacenaje"], "3.07 m");
  assert.equal(result.specs?.Capacidad, "230 kg");
  const valid = parseGomarizProduct(html("Altura plataforma: 15.7 m Altura de trabajo: 17.7 m Altura almacenaje: 2.94 m"), url("camion-plataforma"));
  assert.equal(valid.specs?.["Altura plataforma"], "15.7 m");
});

test("Gomariz: etiquetas técnicas repetidas con valores contradictorios no prevalecen por orden", () => {
  const result = parseGomarizProduct(html("Motor: Diésel Capacidad: 350 l Motor: Eléctrico Capacidad: 400 l Potencia: 45 kVA"),
    "https://www.gomarizrent.com/venta/energia-electrica-e-iluminacion/generador/prueba/");
  assert.deepEqual(result.specs?.Motor, ["Diésel", "Eléctrico"]);
  assert.deepEqual(result.specs?.Capacidad, ["350 l", "400 l"]);
  assert.equal(result.specs?.Potencia, "45 kVA");
  const repeated = parseGomarizProduct(html("Motor: Diésel Motor: Diésel Capacidad: 350 l"),
    "https://www.gomarizrent.com/venta/energia-electrica-e-iluminacion/generador/prueba/");
  assert.equal(repeated.specs?.Motor, "Diésel");
  assert.equal(repeated.specs?.Capacidad, "350 l");
  const three = parseGomarizProduct(html("Motor: Diésel Motor: Eléctrico Motor: Gasolina Motor: Diésel"),
    "https://www.gomarizrent.com/venta/energia-electrica-e-iluminacion/generador/prueba/");
  assert.deepEqual(three.specs?.Motor, ["Diésel", "Eléctrico", "Gasolina"]);
});
