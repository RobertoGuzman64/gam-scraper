import assert from "node:assert/strict";
import test from "node:test";
import { parseGomarizProduct } from "../parsers.js";

const fixture = (reference: string, technical: string, description = "Máquina de ocasión."): string => `<html><main>
  <h1>PRAMAC GPW200P-FN</h1>
  <p>Referencia: ${reference} Año: 2023 Marca: Pramac Ver precio</p>
  <h2>Descripción</h2><p>${description}</p>
  <h2>Dimensiones</h2><p>Altura: 2.05 m Longitud: 3.70 m Peso: 2367 kg</p>
  <h2>Especificaciones técnicas</h2><p>${technical}</p>
  <p>Ver ficha técnica</p>
</main></html>`;

const url = "https://www.gomarizrent.com/venta/energia-electrica-e-iluminacion/generador/pramac-gpw200p-fn/";

test("Gomariz: separa voltaje y demás etiquetas técnicas del motor", () => {
  const result = parseGomarizProduct(fixture("GR1356", "Motor: Diésel Voltaje: 230 V Capacidad: 350 l"), url);
  assert.equal(result.specs?.Motor, "Diésel");
  assert.equal(result.specs?.Voltaje, "230 V");
  assert.equal(result.specs?.Capacidad, "350 l");
  assert.equal(result.price, null);
  assert.equal(result.shortDescription, null);
});

test("Gomariz: separa la anchura de limpieza y no transforma motor eléctrico en batería", () => {
  const result = parseGomarizProduct(fixture("FR1077", "Motor: Eléctrico Anchura limpieza: 0.81 m", "Dimensiones reducidas, buena maniobrabilidad."),
    "https://www.gomarizrent.com/venta/limpieza/fregadora/nilfisk-br850-s-fregadora/");
  assert.equal(result.specs?.Motor, "Eléctrico");
  assert.equal(result.specs?.["Anchura limpieza"], "0.81 m");
  assert.equal(result.specs?.["Altura"], "2.05 m");
});

test("Gomariz: deja potencias compuestas sin calcular un valor ficticio", () => {
  const result = parseGomarizProduct(fixture("TO1245", "Motor: Diésel Potencia: 4x120 W"),
    "https://www.gomarizrent.com/venta/energia-electrica-e-iluminacion/torre-de-luz/generac-vt-hybrid/");
  assert.equal(result.specs?.Potencia, "4x120 W");
});

test("Gomariz: no recoge fichas técnicas ni valores de máquinas similares", () => {
  const html = `${fixture("GR1356", "Motor: Diésel Potencia: 45 kVA")}<p>Máquinas similares Motor: Gasolina Potencia: 999 kVA</p>`;
  const result = parseGomarizProduct(html, url);
  assert.equal(result.specs?.Motor, "Diésel");
  assert.equal(result.specs?.Potencia, "45 kVA");
});
