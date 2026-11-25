import assert from "node:assert/strict";
import test from "node:test";
import type { CommercialBaselineInput } from "../../diagnostics/commercial-baseline.js";
import { planCommercialExport } from "../export-projection.js";
import { accreditCommercialPlan } from "../../diagnostics/commercial-accreditation.js";
import { catalog, logos, entry, plan } from "./export-projection-fixture.js";

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
