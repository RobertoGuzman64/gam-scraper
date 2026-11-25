import assert from "node:assert/strict";
import test from "node:test";
import type { CommercialExportPlan } from "../../projection/export-projection.js";
import { validateCommercialExportFiles } from "../commercial-export-verification.js";
import { filesForProvider, planWithProduct } from "./commercial-export-verification-fixture.js";

test("el preflight del paquete rechaza especificaciones peligrosas aunque el manifiesto tenga hashes correctos", () => {
  const plan = planWithProduct();
  const product = plan.products[0];
  assert.ok(product);
  assert.doesNotThrow(() => validateCommercialExportFiles(filesForProvider(plan)));
  for (const invalid of [
    { "Altura Plataforma": "6085 metros" },
    { "Altura Plataforma": "24 V / 400 Ah" },
    { "Capacidad de la batería": "1000mm" },
    { "Altura de elevación (mm)": "#VALUE! mm" }
  ]) {
    const altered = { ...plan, products: [{ ...product, spec: invalid }] };
    assert.throws(() => validateCommercialExportFiles(filesForProvider(altered)), /Totales o procedencia/);
  }
});

test("rechaza una normalización editorial omitida con manifiesto y hashes reconstruidos", () => {
  const base = planWithProduct();
  const original = base.products[0];
  assert.ok(original);
  for (const change of [
    { description: "Carretilla tríplex tríplex de 4.500 mm" },
    { description: "Carretilla Hyster en GAM Online. Somos distribuidores oficiales de Hyster en España." },
    { description: "Carretilla con altura 4.500mm" },
    { description_general: "Máquina con elevación de 2.449mm y carga de 2.000 kg." }
  ]) {
    const altered: CommercialExportPlan = { ...base, products: [{ ...original, ...change }] };
    assert.throws(() => validateCommercialExportFiles(filesForProvider(altered)), /Presentación editorial no normalizada/);
  }
  assert.doesNotThrow(() => validateCommercialExportFiles(filesForProvider({
    ...base, products: [{ ...original, description: "Carretilla con altura 4.500 mm" }]
  })));
});

test("verifica una cita literal del anuncio sin reescribir la presentación comercial", () => {
  const base = planWithProduct();
  const original = base.products[0];
  assert.ok(original);
  const cited = {
    ...original,
    description_general: "El anuncio declara «4.30mm», pero el campo técnico documenta 4.300 mm de elevación."
  };
  assert.doesNotThrow(() => validateCommercialExportFiles(filesForProvider({
    ...base, products: [cited]
  })));
  assert.throws(() => validateCommercialExportFiles(filesForProvider({
    ...base, products: [{ ...cited, description: "Carretilla con elevación 4.30mm" }]
  })), /Presentación editorial no normalizada/);
});

test("bloquea títulos de unidad repetidos sin excepción y motorizaciones ausentes en el JSON final", () => {
  const base = planWithProduct();
  const original = base.products[0];
  assert.ok(original);
  const repeated = {
    ...original, sourceUrl: "https://example.com/another-unit", reference: "product-2"
  };
  const duplicatePlan: CommercialExportPlan = {
    ...base, total: 2, products: [original, repeated],
    summary: { ...base.summary, exported: 2, categorized: 2, attributes: 2, withLogo: 2, withPrice: 2 }
  };
  assert.throws(() => validateCommercialExportFiles(filesForProvider(duplicatePlan)), /Presentación de identidad comercial incoherente/);
  const justified: CommercialExportPlan = {
    ...duplicatePlan,
    exceptions: [original, repeated].map((product) => ({
      identity: `gam:ref:${product.reference}`, reference: product.reference,
      sourceUrl: product.sourceUrl, reason: "titulo-unidad-no-diferenciada"
    }))
  };
  assert.doesNotThrow(() => validateCommercialExportFiles(filesForProvider(justified)));
  assert.throws(() => validateCommercialExportFiles(filesForProvider({
    ...base, exceptions: justified.exceptions
  })), /Excepción comercial sin producto válido|Presentación de identidad comercial incoherente/);

  const gomProduct = {
    ...original, providerId: "gomariz", title: "Plataforma de tijera LGMG AS0812",
    description_title: "Plataforma de tijera LGMG AS0812", spec: { Motor: "Eléctrico" }
  };
  const gomPlan: CommercialExportPlan = {
    ...base, providerId: "gomariz", products: [gomProduct]
  };
  assert.throws(() => validateCommercialExportFiles(filesForProvider(gomPlan)), /Presentación de identidad comercial incoherente/);
  assert.doesNotThrow(() => validateCommercialExportFiles(filesForProvider({
    ...gomPlan, products: [{ ...gomProduct, title: "Plataforma de tijera eléctrica LGMG AS0812" }]
  })));
  assert.doesNotThrow(() => validateCommercialExportFiles(filesForProvider({
    ...gomPlan, products: [{ ...gomProduct, title: "Camión cesta LGMG AS0812" }]
  })));
});

test("rechaza alturas adulteradas aunque el manifiesto y los hashes se hayan recalculado", () => {
  const base = planWithProduct();
  const existing = base.products[0];
  assert.ok(existing);
  const valid = { ...existing,
    title: "Plataforma sobre camión 25 m CTE ZED 25 HV FIB",
    description_title: "Plataforma sobre camión 25 m CTE ZED 25 HV FIB",
    description: "Plataforma de 25 metros de altura",
    spec: { "Altura de trabajo (m)": "25 m" }
  };
  const source: CommercialExportPlan = { ...base, products: [valid] };
  assert.doesNotThrow(() => validateCommercialExportFiles(filesForProvider(source)));
  const changed = { ...valid, title: "Plataforma sobre camión 20 m CTE ZED 25 HV FIB" };
  assert.throws(() => validateCommercialExportFiles(filesForProvider({ ...source, products: [changed] })),
    /Altura comercial sin normalizar/);
  const unresolved = { ...valid,
    title: "Plataforma sobre camión 32 m CTE ZED 25 HV FIB",
    spec: { "Altura de elevación (m)": "25 m" }
  };
  assert.throws(() => validateCommercialExportFiles(filesForProvider({ ...source, products: [unresolved] })),
    /Discordancia de altura no declarada/);
  const documented: CommercialExportPlan = {
    ...source, products: [unresolved], exceptions: [{ identity: "gam:ref:product-1", reference: unresolved.reference,
      sourceUrl: unresolved.sourceUrl, reason: "altura-titulo-resumen-discordante" }]
  };
  assert.doesNotThrow(() => validateCommercialExportFiles(filesForProvider(documented)));
});

test("bloquea años de fabricación contradictorios y exige justificar discrepancias frente a URL", () => {
  const base = planWithProduct();
  const original = base.products[0];
  assert.ok(original);
  const url = "https://online.gamrentals.com/es/plataformas-elevadoras-tijera-electricas-segunda-mano/6869-2008-genie-gs-3246";
  const product = { ...original, reference: "6869", sourceUrl: url,
    attributes: [{ attributeID: 117, value: 2016 }],
    description_general: "Fabricada en el año 2008, esta plataforma es fiable." };
  const plan: CommercialExportPlan = { ...base, products: [product] };
  assert.throws(() => validateCommercialExportFiles(filesForProvider(plan)), /Año de fabricación contradictorio/);
  const cleaned = { ...product, description_general: "Esta plataforma es fiable." };
  const cleanedPlan: CommercialExportPlan = { ...plan, products: [cleaned] };
  assert.throws(() => validateCommercialExportFiles(filesForProvider(cleanedPlan)), /Discrepancia de año no declarada/);
  const issue = { identity: "gam:ref:6869", reference: "6869", sourceUrl: url,
    reason: "ano-url-atributo-discordante" };
  const recognized: CommercialExportPlan = { ...cleanedPlan, exceptions: [issue] };
  assert.doesNotThrow(() => validateCommercialExportFiles(filesForProvider(recognized)));
  const corrected = { ...cleaned, attributes: [{ attributeID: 117, value: 2008 }] };
  const unjustified: CommercialExportPlan = { ...recognized, products: [corrected] };
  assert.throws(() => validateCommercialExportFiles(filesForProvider(unjustified)), /Excepción de año no justificada/);
});

test("rechaza excepciones de capacidad ausentes o inventadas aunque las huellas sean coherentes", () => {
  const base = planWithProduct();
  const product = base.products[0]!;
  const contradictory = { ...product,
    title: "Carretilla elevadora 3000 kg", spec: { "Capacidad de carga (kg)": "2500 kg" } };
  assert.throws(() => validateCommercialExportFiles(filesForProvider({ ...base,
    products: [contradictory] })), /Discrepancia de capacidad no declarada/);
  const issue = { identity: "gam:ref:product-1", reference: product.reference,
    sourceUrl: product.sourceUrl, reason: "capacidad-titulo-spec-discordante" };
  const accepted = { ...base, products: [contradictory], exceptions: [issue] };
  assert.doesNotThrow(() => validateCommercialExportFiles(filesForProvider(accepted)));
  assert.throws(() => validateCommercialExportFiles(filesForProvider({ ...accepted,
    products: [product] })), /Excepción de capacidad no justificada/);
});

test("rechaza excepciones de especificaciones expuestas o sin un código reconocido", () => {
  const base = planWithProduct();
  const product = base.products[0]!;
  const issue = { identity: "gam:ref:product-1", reference: product.reference,
    sourceUrl: product.sourceUrl, reason: "spec-residuo-hoja-calculo:Altura" };
  assert.doesNotThrow(() => validateCommercialExportFiles(filesForProvider({ ...base, exceptions: [issue] })));
  assert.throws(() => validateCommercialExportFiles(filesForProvider({ ...base,
    exceptions: [issue], products: [{ ...product, spec: { Altura: "2 m" } }]
  })), /Excepción técnica no justificada/);
  assert.throws(() => validateCommercialExportFiles(filesForProvider({ ...base,
    exceptions: [{ ...issue, reason: "spec-inventado:Altura" }]
  })), /Excepción técnica no justificada/);
});
