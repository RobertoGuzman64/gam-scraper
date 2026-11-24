import assert from "node:assert/strict";
import test from "node:test";
import type { ProductRecord } from "../../../contracts/catalog.js";
import { controlledGomarizPlatform } from "../core/editorial-contract-records.js";
import { structureSourcedLongGeneral } from "./editorial-sourced-long-structure.js";

const sentences = [
  "La plataforma de tijera MARCA MODELO10 tiene una configuración eléctrica que el proveedor describe para tareas de mantenimiento interior y desplazamientos controlados.",
  "La ficha de origen indica que las maniobras deben verificarse antes de cada intervención y que las instrucciones del fabricante tienen prioridad.",
  "El equipo dispone de una estructura de elevación cuyo estado se inspecciona regularmente y cuya utilización depende de las condiciones del entorno.",
  "La descripción técnica distingue las funciones de desplazamiento de las operaciones de elevación y recomienda respetar los límites indicados para la unidad.",
  "Las superficies de trabajo deben presentar estabilidad suficiente y los operadores deben comprobar que no existen obstáculos durante la maniobra de subida.",
  "El sistema eléctrico requiere comprobaciones de alimentación y carga y el anuncio recuerda que la autonomía depende del uso y mantenimiento realizado.",
  "La plataforma permite inspecciones periódicas y el documento aconseja revisar el estado de las protecciones antes de iniciar un desplazamiento con carga.",
  "La información facilitada por el proveedor describe el acceso a la cesta y las precauciones necesarias para evitar maniobras fuera del área permitida.",
  "El equipamiento debe manejarse con la formación correspondiente y las personas responsables deben consultar los procedimientos de seguridad para cada actividad.",
  "El mantenimiento preventivo incluye verificar elementos de fijación y conexiones y conservar los registros que permitan identificar las actuaciones efectuadas sobre el equipo.",
  "La documentación diferencia los elementos instalados de las características disponibles para el modelo y exige verificar la configuración antes de asignar una prestación.",
  "La última recomendación del proveedor consiste en inspeccionar el funcionamiento del equipo y contrastar las condiciones reales antes de utilizarlo en obra."
];

const source = (): ProductRecord => ({
  ...controlledGomarizPlatform(),
  longDescription: sentences.join(" ")
});

const words = (value: string): number => value.trim().split(/\s+/u).length;

test("separa en dos párrafos una descripción técnica controlada sin alterar su contenido", () => {
  const original = source();
  const before = original.longDescription ?? "";
  assert.ok(words(before) >= 200 && words(before) <= 320);
  const snapshot = JSON.stringify(original);
  const result = structureSourcedLongGeneral(original, original, before, true);
  assert.ok(result);
  assert.equal(result.replace("\n\n", " "), before);
  assert.equal(result.split("\n\n").length, 2);
  assert.equal(JSON.stringify(original), snapshot);
});

test("no estructura textos ajenos, fuentes no acreditadas ni contenido ya transformado", () => {
  const original = source();
  const before = original.longDescription ?? "";
  const variants: readonly ProductRecord[] = [
    { ...original, providerId: "gam" },
    { ...original, reference: "CONTROL-DISTINTO" },
    { ...original, url: "https://example.invalid/otra-unidad" },
    { ...original, brand: "OTRA" },
    { ...original, model: "OTRO" },
    { ...original, condition: "Nuevo" }
  ];
  for (const variant of variants) {
    assert.equal(structureSourcedLongGeneral(original, variant, before, original.providerId === variant.providerId), null);
  }
  assert.equal(structureSourcedLongGeneral(original, original, before, false), null);
  assert.equal(structureSourcedLongGeneral(original, original, `Acreditado. ${before}`, true), null);
  assert.equal(structureSourcedLongGeneral(original, original, before.replace(". ", ".\n\n"), true), null);
  assert.equal(structureSourcedLongGeneral({ ...original, longDescription: null }, original, before, true), null);
  assert.equal(structureSourcedLongGeneral(original, original, before.slice(0, 90), true), null);
});
