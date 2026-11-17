import assert from "node:assert/strict";
import test from "node:test";
import type { ProductRecord } from "../../../../contracts/catalog.js";
import { prepareSourceProduct } from "../../../prepare-product.js";
import { resolveSourceEditorialClaims } from "../domain/editorial-source-claims.js";
import { resolveSourcedApplications } from "../domain/editorial-sourced-applications.js";
import { controlledGamForklift, controlledGomarizForklift } from "./editorial-contract-records.js";

const general = "La ficha técnica identifica las dimensiones y la capacidad del equipo anunciado.";

const operatingRecord = (
  record: ProductRecord, title: string, family: string, description: string
): ProductRecord => ({
  ...record,
  title: `${title} MARCA MODELO10`,
  categoryName: family,
  longDescription: description,
  shortDescription: null
});

test("las aplicaciones documentadas complementan familias compatibles sin atribuir equipamiento", () => {
  const examples = [
    ["Tractor de arrastre", "Tractores de arrastre", "Indicado para la alimentación de línea en industrias de automoción.", /alimentación de líneas de producción/u],
    ["Apilador eléctrico", "Apiladores", "Indicado para la reposición de existencias en estanterías de nivel medio alto.", /reposición de existencias/u],
    ["Transpaleta", "Transpaletas", "Apto para cargar y descargar camiones y transportar palés abiertos y cerrados.", /carga y descarga de vehículos/u],
    ["Recogepedidos", "Recogepedidos", "El controlador MOSFET de alta frecuencia permite gestión de la hidráulica.", /controlador MOSFET/u],
    ["Carretilla elevadora", "Carretillas elevadoras", "El anuncio recomienda trabajos en patios de almacenamiento y muelles de carga.", /patios exteriores/u],
    ["Cargadora eléctrica", "Cargadoras", "Aplicaciones desde la construcción y la agricultura hasta la logística.", /construcción y agricultura/u],
    ["Grupo electrógeno", "Grupos electrógenos", "Para respaldo de emergencia y eventos al aire libre.", /respaldo de emergencia/u]
  ] as const;
  for (const base of [controlledGamForklift(), controlledGomarizForklift()]) {
    for (const [title, category, description, expected] of examples) {
      if (base.providerId === "gam" && /^(?:Cargadora|Grupo)/u.test(title)) continue;
      const source = operatingRecord(base, title, category, description);
      const original = JSON.stringify(source);
      const added = resolveSourcedApplications(source, source, general);
      assert.match(added ?? "", expected, `${base.providerId}: ${title}`);
      assert.match(resolveSourceEditorialClaims(source, source, general) ?? "", expected);
      assert.equal(JSON.stringify(source), original);
    }
  }
});

test("el motor compartido conserva aplicaciones sin trasladar características de otra unidad", () => {
  const source = operatingRecord(controlledGamForklift(), "Tractor de arrastre", "Tractores de arrastre",
    "El fabricante destaca la alimentación de línea en el transporte interno de componentes.");
  const result = prepareSourceProduct(source).product.description_general ?? "";
  assert.match(result, /alimentación de líneas de producción/u);
  assert.doesNotMatch(result, /incluye|instalado|equipado/iu);
  const another: ProductRecord = { ...source, model: "MODELO11", title: "Tractor de arrastre MARCA MODELO11", longDescription: null };
  assert.doesNotMatch(prepareSourceProduct(another).product.description_general ?? "", /alimentación de líneas de producción/u);
});

test("no hay contaminación entre proveedor, identidad, variante, condición o familia", () => {
  const original = operatingRecord(controlledGamForklift(), "Transpaleta", "Transpaletas",
    "Recomendada para carga y descarga de camiones.");
  const alternatives: readonly ProductRecord[] = [
    { ...original, providerId: "gomariz" },
    { ...original, reference: "REFERENCIA-DISTINTA" },
    { ...original, url: "https://online.gamrentals.com/es/transpaletas/referencia-distinta" },
    { ...original, brand: "OTRA" },
    { ...original, model: "MODELO11", title: "Transpaleta MARCA MODELO11" },
    { ...original, condition: "Nuevo" },
    { ...original, title: "Carretilla elevadora MARCA MODELO10" }
  ];
  for (const candidate of alternatives) {
    assert.equal(resolveSourcedApplications(original, candidate, general), null);
    assert.equal(resolveSourceEditorialClaims(original, candidate, general), general);
  }
});

test("negaciones, opciones y falta de evidencia no se convierten en aplicaciones acreditadas", () => {
  const original = operatingRecord(controlledGamForklift(), "Recogepedidos", "Recogepedidos",
    "El recogepedidos dispone de controlador MOSFET.");
  for (const text of [
    "No incluye controlador MOSFET.",
    "El controlador MOSFET es opcional según el modelo.",
    "Se puede equipar controlador MOSFET a petición.",
    "Sin controlador MOSFET instalado.",
    "Controlador MOSFET no disponible.",
    ""
  ]) {
    const record = { ...original, longDescription: text };
    assert.equal(resolveSourcedApplications(record, record, general), null, text);
  }
  const alreadyCovered = `${general} El controlador MOSFET se menciona en la descripción.`;
  assert.equal(resolveSourcedApplications(original, original, alreadyCovered), null);
  const unrelated = operatingRecord(controlledGamForklift(), "Barredora", "Barredoras",
    "El anuncio describe controlador MOSFET para la operación.");
  assert.equal(resolveSourcedApplications(unrelated, unrelated, general), null);
});
