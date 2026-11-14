import assert from "node:assert/strict";
import test from "node:test";
import type { ProductRecord } from "../../../../contracts/catalog.js";
import { accreditedSourceRecord } from "../../../../testing/domain-cases/accredited-source-samples.js";
import { prepareSourceProduct } from "../../../prepare-product.js";
import { resolveReusableEditorial } from "../domain/editorial-composition.js";
import { resolveKnowledgeEditorial } from "../mapping/knowledge-editorial.js";

const documentedNewUnit = (original: ProductRecord): ProductRecord => {
  const reference = `${original.reference ?? ""}-NUEVA`;
  return {
    ...original,
    reference,
    url: original.url?.replace(original.reference ?? "", reference) ?? null,
    year: null,
    horometer: null,
    serialNumber: null,
    longDescription: original.longDescription?.replace(/^Ref\.\s*\d+\s*/iu, "")
      .replace(/\bHORAS\s+\d+\b/giu, "")
      .replace(/\bAÑO DE FABRICACION\s+\d{4}\b/giu, "") ?? null,
    specs: Object.fromEntries(Object.entries(original.specs ?? {}).filter(([key]) =>
      !["Año de fabricación", "Horas laborales", "Artículo No."].includes(key)))
  };
};

test("RE059 compone una general extensa con hechos de origen y referencia documental separada", () => {
  for (const reference of ["M318-0509", "M940-3556"]) {
    const original = accreditedSourceRecord("mercaeleva-original", reference);
    const snapshot = JSON.stringify(original);
    const composed = resolveReusableEditorial(original);
    const prepared = prepareSourceProduct(original);
    const general = prepared.product.description_general ?? "";
    assert.equal(prepared.status, "ready", reference);
    assert.ok(composed.general, reference);
    assert.ok(general.startsWith(composed.general), reference);
    assert.match(general, /La documentación técnica de referencia del modelo/u, reference);
    assert.match(general, /no acreditan la configuración ni las prestaciones de esta unidad/u, reference);
    assert.doesNotMatch(general, /NUEVA!!!|\bHORAS\s+4341\b/u, reference);
    assert.equal(JSON.stringify(original), snapshot);
  }
});

test("RE059 reutiliza la general en una unidad nueva sin copiar los datos individuales de la histórica", () => {
  const original = accreditedSourceRecord("mercaeleva-original", "M940-3556");
  const incoming = documentedNewUnit(original);
  const prepared = prepareSourceProduct(incoming);
  assert.equal(prepared.status, "ready");
  assert.ok(prepared.product.description_general?.startsWith(resolveReusableEditorial(incoming).general ?? ""));
  assert.match(prepared.product.description_general ?? "", /modelo Genie Z135/u);
  assert.match(prepared.product.description_general ?? "", /altura de trabajo anunciada de 43 m/u);
  assert.doesNotMatch(prepared.product.description_general ?? "", /4\.341 horas|4341 h|Referencia comercial declarada por el vendedor: 234/u);
  assert.equal(resolveKnowledgeEditorial(incoming, incoming).general, null);
  assert.notEqual(prepared.product.description_general, prepareSourceProduct(original).product.description_general);
});

test("RE059 mantiene la general firmada en su unidad sin aplicarla a otra referencia del modelo", () => {
  const original = accreditedSourceRecord("gam-original", "6650");
  const knowledge = resolveKnowledgeEditorial(original, original);
  assert.ok(knowledge.general);
  assert.equal(prepareSourceProduct(original).product.description_general, knowledge.general);
  const incoming: ProductRecord = {
    ...original,
    reference: "CONTROL-RE059",
    url: "https://online.gamrentals.com/es/plataformas-elevadoras-articuladas-electricas-segunda-mano/CONTROL-RE059-jlg-e300ajp",
    year: null,
    horometer: null,
    serialNumber: null,
    specs: Object.fromEntries(Object.entries(original.specs ?? {}).filter(([key]) =>
      !["Año de fabricación", "Horómetro", "Nº de serie"].includes(key)))
  };
  const otherKnowledge = resolveKnowledgeEditorial(incoming, incoming);
  assert.equal(otherKnowledge.general, null);
  assert.notEqual(prepareSourceProduct(incoming).product.description_general, knowledge.general);
});

test("RE060 añade referencias de modelos documentados a originales y a otra unidad compatible", () => {
  for (const reference of ["M318-0509", "M940-3556"]) {
    const original = accreditedSourceRecord("mercaeleva-original", reference);
    const incoming = documentedNewUnit(original);
    for (const record of [original, incoming]) {
      const description = resolveKnowledgeEditorial(record, record).modelReference ?? "";
      const prepared = prepareSourceProduct(record);
      assert.match(description, /La documentación técnica de referencia del modelo/u, reference);
      assert.match(description, /Las magnitudes corresponden al modelo o versión documentada/u, reference);
      assert.ok(prepared.product.description_general?.includes(description.slice(description.indexOf("La documentación técnica de referencia"))), reference);
    }
  }
});

test("RE060 no atribuye documentación a otra identidad, familia, energía, altura o procedencia", () => {
  const original = accreditedSourceRecord("mercaeleva-original", "M318-0509");
  const incoming = documentedNewUnit(original);
  const incompatible: ProductRecord[] = [
    { ...incoming, model: "S1012E-OTRA", title: "LGMG S1012E-OTRA PLATAFORMA TIJERA ELECTRICA 12 MT" },
    { ...incoming, brand: "OTRA MARCA" },
    { ...incoming, title: "LGMG S1012E-2 PLATAFORMA ARTICULADA ELECTRICA 12 MT" },
    { ...incoming, title: "LGMG S1012E-2 PLATAFORMA TIJERA DIESEL 12 MT", specs: { ...incoming.specs, "Tipo de motor": "Diésel" } },
    { ...incoming, specs: { ...incoming.specs, "Altura de trabajo": "10 m" } },
    { ...incoming, url: "https://example.invalid/otra-unidad" }
  ];
  for (const record of incompatible) {
    assert.doesNotMatch(resolveKnowledgeEditorial(record, record).modelReference ?? "", /La documentación técnica de referencia/u);
    assert.doesNotMatch(prepareSourceProduct(record).product.description_general ?? "", /La documentación técnica de referencia/u);
  }
});
