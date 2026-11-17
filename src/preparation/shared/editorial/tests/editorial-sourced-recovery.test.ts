import assert from "node:assert/strict";
import test from "node:test";
import type { ProductRecord } from "../../../../contracts/catalog.js";
import { resolveSourcedTechnicalContext } from "../domain/editorial-sourced-technical-context.js";
import { resolveSourcedConciseShort } from "../domain/editorial-sourced-concise-short.js";
import { resolveSourcedLongEvidence } from "../domain/editorial-sourced-long-evidence.js";
import { controlledGamForklift, controlledGomarizPlatform } from "./editorial-contract-records.js";

const technicalSource = (): ProductRecord => ({
  ...controlledGamForklift(),
  longDescription: "Carretilla destinada a tareas de almacén y desplazamiento de mercancías.",
  shortDescription: null
});

const genericGeneral = "La ficha presenta una carretilla elevadora destinada al movimiento interno de mercancías.";

test("recupera únicamente magnitudes técnicas corroboradas por la misma ficha original", () => {
  const source = technicalSource();
  const before = JSON.stringify(source);
  const result = resolveSourcedTechnicalContext(source, source, genericGeneral, true) ?? "";
  assert.match(result, /altura de elevación de 4,5 m/u);
  assert.match(result, /capacidad de carga declarada de 2\.500 kg/u);
  assert.match(result, /esta misma referencia/u);
  assert.equal(JSON.stringify(source), before);
  assert.equal(resolveSourcedTechnicalContext(source, source, result, true), null);
});

test("reutiliza la descripción corta acreditada solo para el modelo original y si aporta información adicional", () => {
  const source: ProductRecord = {
    ...technicalSource(),
    shortDescription: "La carretilla MARCA MODELO10 se destina al desplazamiento de mercancías en almacenes y centros de distribución. Su diseño facilita tareas de manutención, movimiento interno y preparación logística, y permite planificar los recorridos en las instalaciones conforme a las operaciones de cada centro de trabajo."
  };
  const result = resolveSourcedTechnicalContext(source, source, genericGeneral, true) ?? "";
  assert.match(result, /descripción breve del mismo anuncio precisa/u);
  assert.match(result, /MARCA MODELO10/u);
  assert.equal(resolveSourcedTechnicalContext({ ...source, model: "MODELO11" }, source, genericGeneral, true), null);
});

test("impide mezclar magnitudes de otras unidades, modelos o proveedores", () => {
  const source = technicalSource();
  const changed: readonly ProductRecord[] = [
    { ...source, providerId: "gomariz" },
    { ...source, reference: "CONTROL-OTRA" },
    { ...source, url: "https://online.gamrentals.com/es/carretillas/OTRA" },
    { ...source, brand: "OTRA" },
    { ...source, model: "MODELO11", title: "Carretilla elevadora MARCA MODELO11 2500 kg" },
    { ...source, condition: "Nuevo" },
    { ...source, specs: { "Capacidad de carga (kg)": "1800 kg", "Altura de elevación (mm)": "3000 mm" } }
  ];
  for (const candidate of changed) {
    assert.equal(resolveSourcedTechnicalContext(source, candidate, genericGeneral, source.providerId === candidate.providerId), null);
  }
  assert.equal(resolveSourcedTechnicalContext(source, source, genericGeneral, false), null);
  assert.equal(resolveSourcedTechnicalContext({ ...source, longDescription: null }, source, genericGeneral, true), null);
});

test("recupera una única cota exterior con evidencia propia sin inventar accesorios", () => {
  const source: ProductRecord = {
    ...controlledGomarizPlatform(),
    longDescription: "Máquina para realizar trabajos de limpieza profesional sobre pavimentos y superficies continuas.",
    specs: { Altura: "1.35 m" }
  };
  const description = "Esta máquina se destina a trabajos profesionales de mantenimiento de superficies en instalaciones de distinto tamaño. La información existente permite identificar la familia, el fabricante y la unidad concreta, aunque no acredita equipamiento ni accesorios instalados. Deben verificarse las condiciones del recinto para cada operación.";
  const result = resolveSourcedTechnicalContext(source, source, description, true) ?? "";
  assert.match(result, /altura exterior de 1,35 m/u);
  assert.doesNotMatch(result, /incluye accesorios|equipa elementos/u);
  assert.equal(resolveSourcedTechnicalContext(source, { ...source, specs: { Altura: "1.5 m" } }, description, true), null);
});

const generatorSource = (): ProductRecord => ({
  ...controlledGamForklift(),
  title: "Grupo electrógeno MARCA MODELO10",
  url: "https://online.gamrentals.com/es/grupos-electrogenos/CONTROL-03-grupo-electrogeno",
  longDescription: `La bancada se construye con perfil de acero y soportes antivibración dimensionados para el conjunto. La carrocería es insonora y está formada por paneles modulares fijados sobre la estructura de protección. Dispone de puertas laterales para las revisiones y de elementos de cierre que permiten las operaciones de mantenimiento del generador. El proveedor describe las soluciones constructivas del modelo sin acreditar el estado individual de cada pieza ni sustituir la comprobación de la máquina anunciada.`,
  specs: { Marca: "MARCA", Modelo: "MODELO10", "Peso": "1200 kg" }
});

const generatorGeneral = "La ficha técnica del grupo electrógeno MARCA MODELO10 menciona sus principales dimensiones y su utilización para generación autónoma.";

test("recupera sistemas constructivos documentados en cualquier grupo compatible, sin afirmar instalación", () => {
  const source = generatorSource();
  const result = resolveSourcedLongEvidence(source, source, generatorGeneral) ?? "";
  assert.match(result, /carrocería insonora formada por paneles modulares/u);
  assert.match(result, /soportes antivibración/u);
  assert.match(result, /debe contrastarse/u);
  assert.equal(resolveSourcedLongEvidence(source, source, result), null);
});

test("rechaza características opcionales, identidad distinta y familias incompatibles", () => {
  const source = generatorSource();
  const optional: ProductRecord = {
    ...source,
    longDescription: source.longDescription?.replace("La carrocería es insonora", "La carrocería es insonora opcional") ?? null
  };
  assert.equal(resolveSourcedLongEvidence(optional, optional, generatorGeneral), null);
  const alternatives: readonly ProductRecord[] = [
    { ...source, reference: "OTRA-UNIDAD" },
    { ...source, providerId: "gomariz" },
    { ...source, model: "MODELO11", title: "Grupo electrógeno MARCA MODELO11" },
    { ...source, condition: "Nuevo" },
    { ...source, title: "Carretilla elevadora MARCA MODELO10" }
  ];
  for (const candidate of alternatives) assert.equal(resolveSourcedLongEvidence(source, candidate, generatorGeneral), null);
});

const shortSource = (): ProductRecord => ({
  ...controlledGamForklift(),
  shortDescription: "La carretilla MARCA MODELO10 sirve para transportar palés en operaciones logísticas de almacén y centros de distribución. Se presenta como una solución de manutención capaz de mejorar la organización de recorridos y movimientos de mercancías en instalaciones de distintos tamaños. La información de origen describe también su aplicación en operaciones de organización del trabajo y abastecimiento interior de los almacenes."
});

test("reduce la corta repetitiva conservando las afirmaciones técnicas que no constan en la general", () => {
  const source = shortSource();
  const shortened = resolveSourcedConciseShort(source, source, source.shortDescription, genericGeneral, true) ?? "";
  assert.match(shortened, /MARCA MODELO10/u);
  assert.ok(shortened.split(/\s+/u).length < 45);
  assert.ok(shortened.length < (source.shortDescription?.length ?? 0));
  const protectedNumber = `${source.shortDescription} La capacidad es de 3.500 kg.`;
  const numeric: ProductRecord = { ...source, shortDescription: protectedNumber };
  assert.equal(resolveSourcedConciseShort(numeric, numeric, protectedNumber, genericGeneral, true), null);
});

test("no comprime texto de origen diferente, unidades cruzadas ni variantes dudosas", () => {
  const source = shortSource();
  const variations: readonly ProductRecord[] = [
    { ...source, providerId: "gomariz" },
    { ...source, reference: "CONTROL-OTRA" },
    { ...source, model: "MODELO11", title: "Carretilla elevadora MARCA MODELO11 2500 kg" },
    { ...source, condition: "Nuevo" }
  ];
  for (const candidate of variations) {
    assert.equal(resolveSourcedConciseShort(source, candidate, source.shortDescription, genericGeneral, source.providerId === candidate.providerId), null);
  }
  assert.equal(resolveSourcedConciseShort(source, source, `${source.shortDescription} texto añadido`, genericGeneral, true), null);
  assert.equal(resolveSourcedConciseShort(source, source, source.shortDescription, null, true), null);
});
