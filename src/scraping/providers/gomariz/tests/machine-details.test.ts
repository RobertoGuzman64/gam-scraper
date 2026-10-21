import assert from "node:assert/strict";
import test from "node:test";
import { parseGomarizProduct } from "../parsers.js";

const url = "https://www.gomarizrent.com/venta/energia/grupo-electrogeno/pramac-gpw200p-fn/";

test("Gomariz: extrae metadatos etiquetados y potencia sin confundirlos con el título", () => {
  const html = `<html><main><h1>PRAMAC GPW200P-FN</h1>
    <p>Referencia: GR1356 Año: 2022 Marca: PRAMAC Modelo: GPW200P-FN Horómetro: 1250 h Nº de serie: ABC123 Ubicación: Murcia Ver precio</p>
    <h2>Descripción</h2><p>Generador revisado GR1356.</p>
    <h2>Dimensiones</h2><p>Longitud: 3 m Peso: 3000 kg</p>
    <h2>Especificaciones técnicas</h2><p>Motor: Diesel Potencia: 200 kW Combustible: Diésel</p>
    <p>Ver ficha técnica</p></main></html>`;
  const result = parseGomarizProduct(html, url);
  assert.equal(result.brand, "PRAMAC");
  assert.equal(result.model, "GPW200P-FN");
  assert.equal(result.location, "Murcia");
  assert.equal(result.horometer, "1250 h");
  assert.equal(result.serialNumber, "ABC123");
  assert.equal(result.specs?.Potencia, "200 kW");
  assert.equal(result.specs?.Combustible, "Diésel");
  assert.equal(result.price, null);
});

test("Gomariz: no inventa ubicación, serie ni precio cuando solo ofrece consultar", () => {
  const html = `<html><main><h1>LGMG SS0507E</h1>
    <p>Referencia: TE1858 Año: 2022 Marca: LGMG Ver precio</p>
    <h2>Descripción</h2><p>Las Tijeras Eléctricas están diseñadas para interior.</p>
    <h2>Dimensiones</h2><p>Altura plataforma: 14.30 m Altura de trabajo: 6.3 m</p>
    <p>Ver ficha técnica</p></main></html>`;
  const result = parseGomarizProduct(html,
    "https://www.gomarizrent.com/venta/elevacion-y-trabajos-en-altura/elevador-tijera/lgmg-ss0507etijera-electrica-electric-scissor/");
  assert.equal(result.price, null);
  assert.equal(result.location, null);
  assert.equal(result.serialNumber, null);
  assert.equal(result.specs?.["Altura plataforma"], undefined);
  assert.equal(result.specs?.["Altura de trabajo"], "6.3 m");
});

test("Gomariz: recupera motor y potencia cuando no hay sección de dimensiones", () => {
  const html = `<html><main><h1>PRAMAC GPW200P-FN</h1>
    <p>Referencia: GR1356 Año: 2022 Marca: PRAMAC Ver precio</p>
    <h2>Descripción</h2><p>Grupo electrógeno.</p>
    <h2>Especificaciones técnicas</h2><p>Motor: Diésel Potencia: 200 kW Combustible: Diésel</p>
    <p>Ver ficha técnica</p></main></html>`;
  const parsed = parseGomarizProduct(html, url);
  assert.equal(parsed.specs?.Motor, "Diésel");
  assert.equal(parsed.specs?.Potencia, "200 kW");
});

test("Gomariz: recupera marca y modelo del título cuando la referencia y el slug coinciden", () => {
  const machines = [
    ["TE1620", "LGMG S1413EII", "lgmg-s1413eii-tijera-electrica-scissor-lift", "LGMG", "S1413EII"],
    ["GR1113", "Himoinsa HFW-605T", "himoinsa-hfw-605t-generador-generator", "Himoinsa", "HFW-605T"],
    ["TO1242", "Generac EVE 9", "generac-eve-9-generador", "Generac", "EVE 9"],
    ["BA1575", "JLG 340AJ", "jlg-340aj-brazo-articulado-articulated-boom-lift", "JLG", "340AJ"]
  ] as const;
  for (const [reference, title, slug, brand, model] of machines) {
    const html = `<html><main><h1>${title}</h1><p>Referencia: ${reference} Ver precio</p></main></html>`;
    const pageUrl = `https://www.gomarizrent.com/venta/elevacion-y-trabajos-en-altura/brazo-articulado/${slug}/`;
    const parsed = parseGomarizProduct(html, pageUrl);
    assert.equal(parsed.brand, brand, reference);
    assert.equal(parsed.model, model, reference);
    assert.equal(parsed.price, null, reference);
  }
});

test("Gomariz: respeta la marca explícita y acepta el orden inverso de marcas compuestas", () => {
  const title = "SOCAGE IVECO 35S14 FORSTE 20D SPEED NEUTRA";
  const html = `<html><main><h1>${title}</h1><p>Referencia: CC1535 Marca: Iveco Socage Ver precio</p></main></html>`;
  const result = parseGomarizProduct(html,
    "https://www.gomarizrent.com/venta/elevacion-y-trabajos-en-altura/camion-plataforma/socage-iveco-35s14-forste-20d-speed-neutra/");
  assert.equal(result.brand, "Iveco Socage");
  assert.equal(result.model, "35S14 FORSTE 20D SPEED NEUTRA");
  const unknown = parseGomarizProduct(html.replace("Marca: Iveco Socage ", "").replace("CC1535", "CC1665"),
    "https://www.gomarizrent.com/venta/elevacion-y-trabajos-en-altura/camion-plataforma/socage-iveco-35s14-forste-20d-speed-neutra/");
  assert.equal(unknown.brand, null);
  assert.equal(unknown.model, null);
});

test("Gomariz: no deduce la marca con títulos genéricos, slug distinto o dominios ajenos", () => {
  const html = `<html><main><h1>Plataforma Eléctrica 10</h1><p>Referencia: TEST Ver precio</p></main></html>`;
  const pageUrl = "https://www.gomarizrent.com/venta/elevacion-y-trabajos-en-altura/elevador-tijera/plataforma-electrica-10/";
  const result = parseGomarizProduct(html, pageUrl);
  assert.equal(result.brand, null);
  assert.equal(result.model, null);
  const mislabeled = parseGomarizProduct(html.replace("Plataforma Eléctrica 10", "JLG 340AJ"), pageUrl);
  assert.equal(mislabeled.brand, null);
  assert.equal(mislabeled.model, null);
  const foreign = parseGomarizProduct(html.replace("Plataforma Eléctrica 10", "JLG 340AJ"),
    "https://example.com/venta/elevacion-y-trabajos-en-altura/elevador-tijera/jlg-340aj/");
  assert.equal(foreign.brand, null);
  assert.equal(foreign.model, null);
});
