import assert from "node:assert/strict";
import test from "node:test";
import { parseGomarizProduct } from "../parsers.js";

const url = "https://www.gomarizrent.com/venta/elevacion-y-trabajos-en-altura/elevador-tijera/lgmg-ss0507etijera-electrica-electric-scissor/";

const ficha = (platform: string, working: string): string => `
  <html><main><h1>LGMG SS0507E</h1>
  <p>Referencia: TE1858 Año: 2022 Marca: LGMG Ver precio</p>
  <h2>Descripción</h2><p>Tijera eléctrica.</p>
  <h2>Dimensiones</h2>
  <p>Altura plataforma: ${platform} Altura de trabajo: ${working} Altura almacenaje: 2.15 m Longitud: 1.53 m Peso: 985 kg</p>
  <h2>Especificaciones técnicas</h2><p>Motor: Eléctrico Capacidad: 230 kg</p>
  <p>Ver ficha técnica</p></main></html>`;

test("Gomariz: no exporta la altura de plataforma contradictoria publicada para TE1858", () => {
  const product = parseGomarizProduct(ficha("14.30 m", "6.3 m"), url);
  assert.equal(product.reference, "TE1858");
  assert.equal(product.specs?.["Altura plataforma"], undefined);
  assert.equal(product.specs?.["Altura de trabajo"], "6.3 m");
  assert.equal(product.specs?.["Peso"], "985 kg");
  assert.equal(product.specs?.["Motor"], "Eléctrico");
});

test("Gomariz: conserva alturas compatibles con decimales de coma", () => {
  const product = parseGomarizProduct(ficha("4,30 m", "6,3 m"), url);
  assert.equal(product.specs?.["Altura plataforma"], "4,30 m");
  assert.equal(product.specs?.["Altura de trabajo"], "6,3 m");
});

test("Gomariz: no compara alturas de unidades que no puede normalizar", () => {
  const product = parseGomarizProduct(ficha("4.30 m", "21 ft"), url);
  assert.equal(product.specs?.["Altura plataforma"], "4.30 m");
});
