import assert from "node:assert/strict";
import test from "node:test";
import { prepareSourceProduct } from "../../../prepare-product.js";
import { resolvePreparedEditorialTitle } from "../mapping/prepared-editorial-title.js";
import { resolveDocumentedFamilyTitle } from "../domain/editorial-documented-title.js";
import { normalizeVerifiedEditorialCapacity } from "../domain/editorial-capacity-coherence.js";
import { controlledGamForklift, controlledGomarizPlatform, controlledMercaelevaForklift } from "./editorial-contract-records.js";

test("el título procede de la familia, la fuente y las magnitudes, no de una referencia histórica", () => {
  for (const source of [controlledGamForklift(), controlledGomarizPlatform(), controlledMercaelevaForklift()]) {
    const initial = JSON.stringify(source);
    const title = resolvePreparedEditorialTitle(source, source);
    assert.ok(title?.includes(`${source.brand} ${source.model}`));
    const prepared = prepareSourceProduct(source).product;
    assert.equal(prepared.title, title);
    assert.equal(prepared.description_title, title);
    assert.equal(prepared.reference, source.reference);
    assert.equal(prepared.sourceUrl, source.url);
    assert.equal(JSON.stringify(source), initial);
  }
});

test("el mismo modelo de otra unidad reutiliza la regla de título", () => {
  const source = controlledGomarizPlatform();
  const other = { ...source, reference: "OTRA-UNIDAD", url: "https://www.gomarizrent.com/producto/otra-marca-modelo10/" };
  assert.equal(resolvePreparedEditorialTitle(other, other), resolvePreparedEditorialTitle(source, source));
});

test("un modelo o magnitud discordante no recibe título técnico inventado", () => {
  const source = controlledGomarizPlatform();
  for (const changed of [
    { ...source, brand: "OTRA MARCA" },
    { ...source, model: "OTRO MODELO" },
    { ...source, url: "https://example.invalid/producto/marca-modelo10/" },
    { ...source, specs: { ...source.specs, "Altura de trabajo": "10 kg" } }
  ]) {
    assert.equal(resolvePreparedEditorialTitle(changed, changed), changed.title);
  }
});

test("las familias acreditadas por fuente y descripción titulan modelos nuevos sin ficha histórica", () => {
  const gam = {
    ...controlledGamForklift(),
    title: "MARCA MODELO10",
    longDescription: "La carretilla elevadora MARCA MODELO10 se utiliza en operaciones de manutención.",
    specs: { Marca: "MARCA", Modelo: "MODELO10" }
  };
  const gomariz = {
    ...controlledGomarizPlatform(),
    url: "https://www.gomarizrent.com/venta/elevacion-y-trabajos-en-altura/elevador-tijera/marca-modelo10/",
    title: "MARCA MODELO10",
    longDescription: "La plataforma de tijera MARCA MODELO10 es adecuada para elevación de personas.",
    specs: { Marca: "MARCA", Modelo: "MODELO10" }
  };
  const mercaeleva = {
    ...controlledMercaelevaForklift(),
    title: "MARCA MODELO10",
    longDescription: "La carretilla elevadora MARCA MODELO10 facilita la manutención de cargas.",
    specs: { Marca: "MARCA", Modelo: "MODELO10", "Título adicional": "CARRETILLA ELEVADORA" }
  };
  for (const [source, noun] of [
    [gam, "Carretilla elevadora"],
    [gomariz, "Plataforma de tijera"],
    [mercaeleva, "Carretilla elevadora"]
  ] as const) {
    const expected = `${noun} MARCA MODELO10`;
    assert.equal(resolveDocumentedFamilyTitle(source), expected);
    assert.equal(resolvePreparedEditorialTitle(source, source), expected);
    const equivalent = {
      ...source,
      reference: "CONTROL-NUEVA",
      url: source.url.replace(source.reference ?? "", "CONTROL-NUEVA")
    };
    assert.equal(resolveDocumentedFamilyTitle(equivalent), expected);
    const nextModel = {
      ...equivalent,
      model: "MODELO11",
      title: "MARCA MODELO11",
      url: equivalent.url.replace("modelo10", "modelo11"),
      longDescription: equivalent.longDescription?.replace("MODELO10", "MODELO11") ?? null,
      specs: { ...equivalent.specs, Modelo: "MODELO11" }
    };
    assert.equal(resolveDocumentedFamilyTitle(nextModel), `${noun} MARCA MODELO11`);
  }
});

test("la titulación descriptiva rechaza incoherencias de identidad, fuente y familia", () => {
  const source = {
    ...controlledGomarizPlatform(),
    title: "MARCA MODELO10",
    url: "https://www.gomarizrent.com/venta/elevacion-y-trabajos-en-altura/elevador-tijera/marca-modelo10/",
    longDescription: "La plataforma de tijera MARCA MODELO10 sirve para elevación.",
    specs: { Marca: "MARCA", Modelo: "MODELO10" }
  };
  for (const invalid of [
    { ...source, providerId: "gam" },
    { ...source, brand: "OTRA MARCA" },
    { ...source, model: "OTRO MODELO" },
    { ...source, url: "https://example.invalid/venta/elevacion-y-trabajos-en-altura/elevador-tijera/marca-modelo10/" },
    { ...source, longDescription: "El brazo articulado MARCA MODELO10 permite el trabajo en altura." },
    { ...source, longDescription: null },
    { ...source, specs: { ...source.specs, Marca: "FABRICANTE DISTINTO" } }
  ]) {
    assert.equal(resolveDocumentedFamilyTitle(invalid), null);
    assert.equal(resolvePreparedEditorialTitle(invalid, invalid), invalid.title);
  }
});

test("la corrección de capacidad se comparte por evidencia, no por referencia o proveedor", () => {
  for (const sourceRecord of [controlledGamForklift(), controlledGomarizPlatform(), controlledMercaelevaForklift()]) {
    const source = {
      ...sourceRecord,
      title: "Transpaleta MARCA MODELO10 2000 kg",
      shortDescription: "Transporte de cargas de hasta 1,4 toneladas.",
      specs: { Marca: "MARCA", Modelo: "MODELO10", "Capacidad de carga (kg)": "1400 KG" }
    };
    const document = {
      title: source.title,
      description_general: "La capacidad de carga declarada de 2000 kg debe contrastarse.",
      sourceUrl: source.url,
      reference: source.reference,
      spec: { ...source.specs }
    };
    const expected = {
      title: "Transpaleta MARCA MODELO10 1400 kg",
      description_general: "La capacidad de carga declarada de 1400 kg debe contrastarse."
    };
    assert.deepEqual(normalizeVerifiedEditorialCapacity(source, document), expected);
    for (const invalid of [
      { ...source, shortDescription: "Transporte de carga de 2.000 kg." },
      { ...source, specs: { ...source.specs, "Capacidad de carga (kg)": "2000 KG" } },
      { ...source, model: "MODELO11" }
    ]) assert.deepEqual(normalizeVerifiedEditorialCapacity(invalid, document), {
      title: document.title, description_general: document.description_general
    });
    assert.deepEqual(normalizeVerifiedEditorialCapacity(source, { ...document, sourceUrl: `${source.url}?otra=1` }), {
      title: document.title, description_general: document.description_general
    });
  }
});
