import assert from "node:assert/strict";
import test from "node:test";
import type { ProductRecord } from "../../../../contracts/catalog.js";
import { accreditedSourceRecord } from "../../../../testing/domain-cases/accredited-source-samples.js";
import { prepareSourceProduct } from "../../../prepare-product.js";
import { resolveDocumentedEditorialTitle } from "../domain/editorial-documented-title.js";
import { resolveSourceEditorialClaims } from "../domain/editorial-source-claims.js";
import { cleanAuthenticatedSourceEditorial } from "../domain/editorial-text-hygiene.js";
import {
  controlledGamForklift, controlledGomarizForklift, controlledMercaelevaForklift
} from "./editorial-contract-records.js";

const documented = [
  { reference: "M855-6850", expected: /Carretilla todoterreno 4x4 Ausa C250HX4 de 2\.500 kg/u },
  { reference: "M736-5615", expected: /Dúmper giratorio Ausa D450AHG de 4\.500 kg/u },
  { reference: "M840-8278", expected: /Plataforma de tijera eléctrica JLG 1930ES de 8 m/u },
  { reference: "M200-9533", expected: /Manipulador telescópico JLG 4014PS de 14 m/u }
];

const newUnit = (record: ProductRecord): ProductRecord => {
  const reference = `${record.reference}-NUEVA`;
  return {
    ...record,
    reference,
    url: record.url?.replace(record.reference ?? "", reference) ?? null,
    year: null,
    horometer: null,
    serialNumber: null
  };
};

const claimGeneral = "La ficha técnica identifica las prestaciones documentadas de esta unidad.";

const forkliftFactories = [controlledGamForklift, controlledGomarizForklift, controlledMercaelevaForklift];

test("RE053: títulos documentados de fuentes históricas llegan a preparación sin mutaciones", () => {
  for (const { reference, expected } of documented) {
    const source = accreditedSourceRecord("mercaeleva-original", reference);
    const unchanged = JSON.stringify(source);
    assert.match(resolveDocumentedEditorialTitle(source) ?? "", expected, reference);
    const prepared = prepareSourceProduct(source);
    assert.match(prepared.product.title ?? "", expected, reference);
    assert.equal(prepared.product.sourceUrl, source.url);
    assert.equal(JSON.stringify(source), unchanged);
  }
});

test("RE053: nuevas referencias conservan la regla pero no los atributos de la unidad anterior", () => {
  for (const { reference, expected } of documented) {
    const source = accreditedSourceRecord("mercaeleva-original", reference);
    const incoming = newUnit(source);
    assert.notEqual(incoming.reference, source.reference);
    assert.notEqual(incoming.url, source.url);
    assert.match(resolveDocumentedEditorialTitle(incoming) ?? "", expected);
    const prepared = prepareSourceProduct(incoming).product;
    assert.match(prepared.title ?? "", expected);
    assert.equal(prepared.reference, incoming.reference);
    assert.equal(prepared.sourceUrl, incoming.url);
  }
});

test("RE053: no se transfiere un título documentado a identidad, procedencia o datos técnicos contradictorios", () => {
  for (const { reference } of documented) {
    const source = accreditedSourceRecord("mercaeleva-original", reference);
    const incoming = newUnit(source);
    const variants: ProductRecord[] = [
      { ...incoming, model: "MODELO-DIFERENTE" },
      { ...incoming, brand: "MARCA-DIFERENTE" },
      { ...incoming, providerId: "gomariz" },
      { ...incoming, url: "https://example.invalid/for-sale/machine/otra" },
      { ...incoming, condition: "Nuevo" },
      { ...incoming, specs: { ...incoming.specs, Estado: "Nuevo" } },
      { ...incoming, specs: { ...incoming.specs, "Título adicional": "OTRA MAQUINA" } }
    ];
    for (const incompatible of variants) assert.equal(resolveDocumentedEditorialTitle(incompatible), null, reference);
  }
  const source = accreditedSourceRecord("mercaeleva-original", "M855-6850");
  assert.equal(resolveDocumentedEditorialTitle({ ...source, specs: {
    ...source.specs, "Capacidad máxima de elevación": "3000 kg"
  } }), null);
  const platform = accreditedSourceRecord("mercaeleva-original", "M840-8278");
  assert.equal(resolveDocumentedEditorialTitle({ ...platform, specs: {
    ...platform.specs, "Altura de trabajo": "10 m"
  } }), null);
});

test("RE064: afirmaciones independientes se conservan, negadas y opcionales no se añaden", () => {
  for (const factory of forkliftFactories) {
    const source = factory();
    const stated: ProductRecord = { ...source,
      longDescription: "La carretilla incorpora dirección asistida. El frenado regenerativo no está incluido." };
    const result = resolveSourceEditorialClaims(stated, stated, claimGeneral) ?? "";
    assert.match(result, /declara dirección asistida/u);
    assert.doesNotMatch(result, /declara frenado regenerativo/u);
    const optional: ProductRecord = { ...source,
      longDescription: "La carretilla puede incorporar dirección asistida y frenado regenerativo según la versión." };
    assert.equal(resolveSourceEditorialClaims(optional, optional, claimGeneral), claimGeneral);
    const contradicted: ProductRecord = { ...source,
      longDescription: "La carretilla incorpora dirección asistida. La dirección asistida no está incluida." };
    assert.equal(resolveSourceEditorialClaims(contradicted, contradicted, claimGeneral), claimGeneral);
  }
});

test("RE064: ninguna afirmación de origen se asocia a otra unidad o identidad", () => {
  for (const factory of forkliftFactories) {
    const source: ProductRecord = {
      ...factory(), longDescription: "La carretilla incorpora frenado regenerativo y dirección asistida." };
    assert.match(resolveSourceEditorialClaims(source, source, claimGeneral) ?? "", /declara frenado regenerativo/u);
    for (const other of [
      { ...source, reference: `${source.reference}-OTRA` },
      { ...source, model: "MODELO-DISTINTO" },
      { ...source, providerId: "otro" },
      { ...source, url: "https://example.invalid/otra" }
    ]) assert.equal(resolveSourceEditorialClaims(source, other, claimGeneral), claimGeneral);
    const noDeclaration = newUnit(factory());
    assert.equal(resolveSourceEditorialClaims(noDeclaration, noDeclaration, claimGeneral), claimGeneral);
  }
});

test("RE064: el cierre limpia afirmaciones aisladas solo cuando texto y fuente coinciden", () => {
  for (const factory of forkliftFactories) {
    const record = factory();
    const text = "La ficha MARCA MODELO10 declara información comprobada. Sí. La configuración de esta unidad requiere verificación.";
    const source: ProductRecord = { ...record, longDescription: text };
    const clean = cleanAuthenticatedSourceEditorial(source, null, text);
    assert.equal(clean.general, "La ficha MARCA MODELO10 declara información comprobada. La configuración de esta unidad requiere verificación.");
    assert.equal(cleanAuthenticatedSourceEditorial(source, null, `${text} Otra frase.`).general, `${text} Otra frase.`);
    assert.equal(cleanAuthenticatedSourceEditorial({ ...source, model: "MODELO-DISTINTO" }, null, text).general, text);
    assert.equal(cleanAuthenticatedSourceEditorial({ ...source, url: "https://example.invalid/otra" }, null, text).general, text);
  }
});

test("RE064: la preparación no asciende un anuncio sin procedencia y deja intactos los originales", () => {
  for (const factory of forkliftFactories) {
    const source: ProductRecord = {
      ...factory(), title: "Máquina sin identidad", brand: null, model: null,
      url: "https://example.invalid/otra", specs: {}, shortDescription: null, longDescription: null
    };
    const snapshot = JSON.stringify(source);
    const prepared = prepareSourceProduct(source);
    assert.equal(prepared.status, "review");
    assert.equal(prepared.product.description, null);
    assert.equal(prepared.product.description_general, null);
    assert.equal(JSON.stringify(source), snapshot);
  }
});

test("RE064: el flujo completo solo incorpora prestaciones declaradas en los tres proveedores", () => {
  for (const factory of forkliftFactories) {
    const source = factory();
    for (const [declaration, accepted] of [
      ["La carretilla incorpora dirección asistida.", true],
      ["La carretilla puede incorporar dirección asistida según la versión.", false],
      ["La carretilla no incluye dirección asistida.", false]
    ] as const) {
      const incoming = newUnit({ ...source, longDescription: declaration });
      const snapshot = JSON.stringify(incoming);
      const prepared = prepareSourceProduct(incoming);
      assert.equal(prepared.status, "ready", source.providerId);
      assert.equal(/La descripción de origen declara dirección asistida/u.test(prepared.product.description_general ?? ""), accepted, source.providerId);
      assert.equal(JSON.stringify(incoming), snapshot);
    }
  }
});

test("RE064: la afirmación documentada de un original no se copia a una unidad nueva sin esa evidencia", () => {
  const historical = accreditedSourceRecord("gam-original", "6901");
  const originalGeneral = prepareSourceProduct(historical).product.description_general ?? "";
  assert.match(originalGeneral, /La descripción de origen declara mandos proporcionales/u);
  const incoming = newUnit({ ...historical, longDescription: null, shortDescription: null });
  const nextGeneral = prepareSourceProduct(incoming).product.description_general ?? "";
  assert.doesNotMatch(nextGeneral, /La descripción de origen declara mandos proporcionales/u);
  assert.equal(prepareSourceProduct(incoming).product.reference, incoming.reference);
});
