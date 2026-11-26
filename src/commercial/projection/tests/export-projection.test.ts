import assert from "node:assert/strict";
import test from "node:test";
import type { CommercialBaselineInput } from "../../diagnostics/commercial-baseline.js";
import type { ProductRecord, SpecsMap } from "../../../contracts/catalog.js";
import { inspectTechnicalCoherence, inspectTechnicalSpecifications } from "../../../catalog/validation/technical-specifications.js";
import { normalizeOriginalTechnicalPresentation, normalizeTechnicalPresentation } from "../../../preparation/technical/technical-presentation.js";
import { recoverGamCrossedTechnicalSpecs } from "../../../preparation/gam/technical/crossed-specifications.js";
import { projectCommercialPresentation } from "../presentation-projection.js";
import { projectPresentableSpecifications } from "../spec-projection.js";
import { planCommercialExport } from "../export-projection.js";
import { accreditCommercialPlan } from "../../diagnostics/commercial-accreditation.js";
import { catalog, logos, entry, plan, source, published } from "./export-projection-fixture.js";

test("deriva contenido, metadata, categoría y atributos sin alterar la publicación técnica", () => {
  const input = entry("100");
  const snapshot = JSON.stringify(input);
  const output = plan([input]);
  assert.equal(output.total, 1);
  assert.equal(output.summary.exported, 1);
  assert.equal(output.summary.categorized, 1);
  assert.equal(output.summary.withLogo, 1);
  assert.equal(output.summary.attributes, 1);
  assert.equal(output.products[0]?.reference, "100");
  assert.equal(output.products[0]?.externalReference, "VISIBLE-1");
  assert.equal(output.products[0]?.title, "JCB AB123");
  assert.equal(output.products[0]?.category, "Articuladas");
  assert.equal(output.products[0]?.categorySellID, 29);
  assert.equal(output.products[0]?.logoID, 16);
  assert.deepEqual(output.products[0]?.attributes, [{ attributeID: 115, value: "JCB" }]);
  assert.deepEqual(output.products[0]?.metadata.tags, ["maquinaria", "segunda-mano", "articuladas", "jcb"]);
  assert.equal(output.products[0]?.metadata.featured, false);
  assert.deepEqual(output.products[0]?.spec, input.published.spec);
  assert.deepEqual(output.products[0]?.images, input.published.images);
  assert.equal(output.products[0]?.companyID, undefined);
  assert.deepEqual(output.exceptions, []);
  assert.equal(JSON.stringify(input), snapshot);
  assert.deepEqual(plan([input]), output);
});

test("dos máquinas con la misma referencia comercial mantienen identidades propias", () => {
  const output = plan([entry("104"), entry("105")]);
  assert.deepEqual(output.products.map((item) => item.reference), ["104", "105"]);
  assert.deepEqual(output.products.map((item) => item.externalReference), ["VISIBLE-1", "VISIBLE-1"]);
  assert.notEqual(output.products[0]?.sourceUrl, output.products[1]?.sourceUrl);
});

test("companyID solo se incorpora con entorno explícito", () => {
  assert.equal(plan([entry("106")]).products[0]?.companyID, undefined);
  assert.equal(plan([entry("106")], "production", 208).products[0]?.companyID, 208);
  assert.throws(() => plan([entry("106")], null, 208), /entorno explícito/);
  assert.throws(() => plan([entry("106")], "develop", null), /entorno explícito/);
});

test("asigna Otras Marcas si la marca no tiene logo acreditado, sin inventar precio", () => {
  const sample = entry("107");
  const published = { ...sample.published, title: "Equipo SIN MARCA", spec: { Modelo: "AB123" } };
  const output = plan([{ ...sample, published }]);
  assert.equal(output.products[0]?.logoID, 18);
  assert.equal(output.products[0]?.price, null);
  assert.deepEqual(output.exceptions, []);
  assert.equal(output.summary.withLogo, 1);
  assert.equal(output.summary.withPrice, 0);
});

test("el logo genérico se aplica solo cuando no existe correspondencia acreditada", () => {
  const generic = entry("logo-generico");
  const unidentified = { ...generic, source: { ...generic.source, brand: "FABRICANTE SIN LOGO" },
    published: { ...generic.published, title: "Equipo FABRICANTE SIN LOGO", spec: { Marca: "FABRICANTE SIN LOGO" } } };
  const output = plan([unidentified]);
  assert.equal(output.products[0]?.logoID, 18);
  assert.equal(output.summary.withLogo, 1);
  assert.equal(accreditCommercialPlan([unidentified], output, catalog, logos, null).summary.blocking, 0);
  assert.throws(() => planCommercialExport([unidentified], "gam", "a".repeat(64), catalog,
    logos.filter((logo) => logo.id !== 18), null, null), /Otras Marcas/);
});

test("atribuye solo valores compatibles y registra rechazos sin borrar fichas", () => {
  const sample = entry("108");
  const changed = { ...sample, mapped: { ...sample.mapped, product: {
    ...sample.mapped.product,
    attributes: [{ attributeID: 115, value: "JCB" }, { attributeID: 24, value: "De bandaje" }]
  } } };
  const output = plan([changed]);
  assert.deepEqual(output.products[0]?.attributes, [{ attributeID: 115, value: "JCB" }]);
  assert.ok(output.exceptions.some((item) => item.reason === "atributo-24:opcion-invalida"));
});

test("la exportación conserva atributos válidos posteriores a rechazos del mismo ID", () => {
  const input = entry("asignacion-valida");
  const updated: CommercialBaselineInput = { ...input, mapped: {
    ...input.mapped, product: { ...input.mapped.product, attributes: [
      { attributeID: 24, value: "De bandaje" },
      { attributeID: 24, value: "Macizos" },
      { attributeID: 115, value: "" },
      { attributeID: 115, value: "JCB" },
      { attributeID: 24, value: "Superelásticos" }
    ] }
  } };
  const output = plan([updated]);
  assert.deepEqual(output.products[0]?.attributes, [
    { attributeID: 24, value: "Macizos" },
    { attributeID: 115, value: "JCB" }
  ]);
  assert.equal(output.summary.attributes, 2);
  assert.deepEqual(output.exceptions.map((item) => item.reason), [
    "atributo-24:opcion-invalida", "atributo-115:tipo-invalido", "atributo-24:atributo-duplicado"
  ]);
  assert.equal(accreditCommercialPlan([updated], output, catalog, logos, null).summary.blocking, 0);
});

test("filtra magnitudes incompatibles, declara las revisiones y acredita la conservación deliberada", () => {
  const input = entry("308");
  const contaminated: CommercialBaselineInput = {
    ...input,
    published: { ...input.published,
      title: "Carretilla JCB AB123 1600 kg",
      spec: { ...input.published.spec, "Capacidad de carga (kg)": "1800 KG",
        "Altura Plataforma": "6085 metros", "Altura de elevación (mm)": "#VALUE! mm" }
    }
  };
  const before = JSON.stringify(contaminated);
  const result = plan([contaminated]);
  const product = result.products[0];
  assert.ok(product);
  assert.equal(product.spec["Altura Plataforma"], undefined);
  assert.equal(product.spec["Altura de elevación (mm)"], undefined);
  assert.equal(product.spec["Capacidad de carga (kg)"], "1800 KG");
  assert.deepEqual(result.exceptions.map(({ reason }) => reason).sort(), [
    "spec-longitud-fisicamente-implausible:Altura Plataforma",
    "spec-residuo-hoja-calculo:Altura de elevación (mm)",
    "capacidad-titulo-spec-discordante"
  ].sort());
  const audit = accreditCommercialPlan([contaminated], result, catalog, logos, null);
  assert.equal(audit.summary.blocking, 0);
  assert.equal(audit.summary.pending, 2);
  assert.ok(audit.decisions[0]?.differences.some((difference) => difference.field === "spec" && difference.status === "normalized"));
  const illegal = { ...product, spec: { ...product.spec, "Altura Plataforma": "6085 metros" } };
  const rejected = accreditCommercialPlan([contaminated], { ...result, products: [illegal] }, catalog, logos, null);
  assert.ok(rejected.blocking.some(({ reason }) => reason === "especificaciones-incompatibles-expuestas"));
  assert.equal(JSON.stringify(contaminated), before);
});


const yaleSource = (family: string, title: string, model: string, specs: SpecsMap): ProductRecord => ({
  ...source("10001"), url: `https://online.gamrentals.com/es/${family}/10001-equipo-prueba`,
  title, longDescription: `Ficha de prueba ${model}`, condition: "Nuevo", brand: "YALE", model,
  specs: { Marca: "YALE", Modelo: model, ...specs }
});

const projectedSpecs = (record: ProductRecord, spec: SpecsMap): SpecsMap => {
  const publication = { ...published(record), spec };
  const before = JSON.stringify([record, publication]);
  const output = projectCommercialPresentation(record, publication, null).spec;
  assert.deepEqual(inspectTechnicalSpecifications(output), []);
  assert.deepEqual(inspectTechnicalCoherence(output), []);
  assert.equal(JSON.stringify([record, publication]), before);
  return output;
};

const preparedSpecs = (record: ProductRecord): SpecsMap => normalizeOriginalTechnicalPresentation(
  normalizeTechnicalPresentation(recoverGamCrossedTechnicalSpecs(record)), record.specs ?? {});

test("la proyección conserva magnitudes físicas y retira valores incompatibles sin inventar unidades", () => {
  const spec = {
    "Altura Plataforma": "9,5 metros", "Radio de giro": "1,98 m", "Radio de giro (exterior)": "1601 mm",
    "Capacidad de la batería": "24 V / 400 Ah", "Altura de elevación (mm)": "16900 mm", "Número de serie": "12345"
  };
  assert.deepEqual(inspectTechnicalSpecifications(spec), []);
  assert.deepEqual(projectPresentableSpecifications(spec), spec);
  assert.deepEqual(projectPresentableSpecifications({
    ...spec, "Altura Plataforma": "9225 metros", "Radio de giro": "24V / 400Ah(V/Ah)",
    "Capacidad de la batería": "1000mm", "Altura de elevación (mm)": "#VALUE! mm"
  }), { "Radio de giro (exterior)": "1601 mm", "Número de serie": "12345" });
  assert.deepEqual(projectPresentableSpecifications({
    "Distancia del centro de gravedad": "−1 mm", "Horas laborales": "−1 h", "Centro de carga": "600 mm"
  }), { "Centro de carga": "600 mm" });
});

test("la proyección conserva alternativas completas y rechaza campos multivalor contaminados", () => {
  assert.deepEqual(projectPresentableSpecifications({
    "Altura Plataforma": ["8 m", "24 V / 400 Ah"],
    "Capacidad de la batería": ["24 V / 400 Ah", "48 V / 500 Ah"],
    "Radio de giro": "6085mm metros", Anchura: "24V / 840-1000Ah(V/Ah)", Modelo: "MPC14"
  }), { "Capacidad de la batería": ["24 V / 400 Ah", "48 V / 500 Ah"], Modelo: "MPC14" });
});

test("la proyección de apiladores Yale recupera campos cruzados únicamente con evidencia concordante", () => {
  for (const [model, capacity, weight] of [["MC12", 1200, 2280], ["MC15", 1500, 2360]] as const) {
    const record = yaleSource("apiladores-yale", `Apilador eléctrico a pie Yale ${model}`, `${model} (pedestrian)`, {
      "Centro de carga": "5076 mm", Longitud: "2892 mm", "Capacidad de carga (kg)": `${capacity} KG`,
      "Capacidad de la batería": String(weight), "Radio de giro": "24V / 400Ah(V/Ah)"
    });
    const original = record.specs ?? {};
    const result = projectedSpecs(record, original);
    assert.equal(result["Centro de carga"], undefined);
    assert.equal(result["Radio de giro"], undefined);
    assert.equal(result["Capacidad de la batería"], undefined);
    assert.equal(result["Altura de elevación (mm)"], "5076 mm");
    assert.equal(result.Peso, `${weight} kg`);
    assert.equal(result["Batería (V / Ah)"], "24 V / 400 Ah");
    for (const rejected of [
      projectPresentableSpecifications({ ...original, "Centro de carga": "500 mm" }, record),
      projectPresentableSpecifications(original, { ...record, model: "OTRO" })
    ]) {
      assert.equal(rejected["Altura de elevación (mm)"], undefined);
      assert.equal(rejected.Peso, undefined);
      assert.equal(rejected["Batería (V / Ah)"], undefined);
    }
    const prepared = preparedSpecs(record);
    assert.deepEqual(projectedSpecs(record, prepared), prepared);
  }
});

test("la proyección conserva la batería acreditada con independencia de la evolución de su etiqueta", () => {
  const record = yaleSource("transpaletas-yale", "Transpaleta eléctrica a pie Yale MP20X", "MP20X", {
    "Capacidad de carga (kg)": "2000 KG", "Altura Plataforma": "24V / 210 - 500Ah(V/Ah) metros",
    "Capacidad de la batería": "24 V / 250 Ah", Peso: "678 kg"
  });
  const legacy = { Marca: "YALE", Modelo: "MP20X", "Capacidad de la batería": "24 V / 250 Ah", Peso: "678 kg" };
  const prepared = preparedSpecs(record);
  assert.equal(prepared["Batería (V / Ah)"], "24 V / 250 Ah");
  assert.equal(prepared["Capacidad de la batería"], undefined);
  assert.equal(prepared["Altura Plataforma"], undefined);
  assert.deepEqual(projectedSpecs(record, legacy), legacy);
  assert.deepEqual(projectedSpecs(record, prepared), prepared);
});

test("la proyección exige coincidencia de identidad y evidencia para recuperar baterías cruzadas", () => {
  for (const [model, capacity] of [["MP25X", "2500 KG"], ["MP30X", "3000 KG"]] as const) {
    const record = yaleSource("transpaletas-yale", `Transpaleta eléctrica a pie Yale ${model}`, model, {
      "Capacidad de carga (kg)": capacity, "Altura Plataforma": "24V / 315-500Ah(V/Ah) metros",
      "Capacidad de la batería": "678", Peso: "678 kg"
    });
    const original = record.specs ?? {};
    const recovered = projectedSpecs(record, original);
    assert.equal(recovered["Batería (V / Ah)"], "24V / 315-500Ah(V/Ah)");
    assert.equal(recovered["Capacidad de la batería"], undefined);
    assert.equal(recovered["Altura Plataforma"], undefined);
    assert.equal(recovered.Peso, "678 kg");
    assert.equal(projectPresentableSpecifications(original, { ...record, model: "OTRO" })["Batería (V / Ah)"], undefined);
    assert.equal(projectPresentableSpecifications({ ...original, "Capacidad de carga (kg)": "999 KG" }, record)["Batería (V / Ah)"], undefined);
    const prepared = preparedSpecs(record);
    assert.deepEqual(projectedSpecs(record, prepared), prepared);
  }
});

test("la proyección recupera altura de elevación acreditada sin confundirla con altura de plataforma", () => {
  const record = yaleSource("recogepedidos-yale", "Preparapedidos eléctrico Yale MO10S", "MO10S", {
    "Capacidad de carga (kg)": "1000 KG", Altura: "3720 mm", "Centro de carga": "8895 mm",
    Longitud: "3242 mm", "Altura Plataforma": "14 metros"
  });
  const original = record.specs ?? {};
  const recovered = projectedSpecs(record, original);
  assert.equal(recovered["Centro de carga"], undefined);
  assert.equal(recovered["Altura de elevación (mm)"], "8895 mm");
  assert.equal(recovered["Altura Plataforma"], "14 metros");
  assert.equal(projectPresentableSpecifications(original, { ...record, model: "OTRO" })["Altura de elevación (mm)"], undefined);
  assert.equal(projectPresentableSpecifications({ ...original, "Capacidad de carga (kg)": "999 KG" }, record)["Altura de elevación (mm)"], undefined);
  const prepared = preparedSpecs(record);
  assert.equal(prepared["Altura de plataforma"], "14 m");
  assert.deepEqual(projectedSpecs(record, prepared), prepared);
});
