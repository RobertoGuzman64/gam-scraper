import assert from "node:assert/strict";
import test from "node:test";
import type { ProductRecord } from "../../../../contracts/catalog.js";
import { prepareSourceProduct } from "../../../prepare-product.js";
import { resolveEditorialFacts } from "../domain/editorial-facts.js";
import { resolveTechnicalModelReference } from "../domain/editorial-model-technical-reference.js";
import { resolveVerifiedEditorialUnitContext } from "../domain/editorial-unit-context.js";
import { loadEditorialKnowledge } from "../../../../infrastructure/filesystem/editorial/knowledge.js";
import { resolveKnowledgeEditorial } from "../mapping/knowledge-editorial.js";
import { controlledGomarizPlatform, controlledMercaelevaPlatform } from "./editorial-contract-records.js";

const documentedGomariz = (): ProductRecord => ({
  ...controlledGomarizPlatform(),
  brand: "LGMG", model: "AS1212E",
  title: "Plataforma de tijera eléctrica LGMG AS1212E",
  url: "https://www.gomarizrent.com/producto/lgmg-as1212e/",
  longDescription: "Plataforma de tijera eléctrica LGMG AS1212E para trabajos en altura.",
  specs: { "Altura de trabajo": "14 m", Capacidad: "320 kg", Motor: "Eléctrico" }
});

const documentedMercaeleva = (): ProductRecord => ({
  ...controlledMercaelevaPlatform(),
  brand: "LGMG", model: "AS1212E",
  title: "Plataforma de tijera eléctrica LGMG AS1212E",
  longDescription: "Plataforma de tijera eléctrica LGMG AS1212E para trabajos en altura.",
  specs: { "Altura de trabajo": "14 m", "Tipo de motor": "Eléctrico" }
});

const newlyArrived = (): ProductRecord => ({
  ...documentedGomariz(),
  reference: "CONTROL-NUEVA",
  url: "https://www.gomarizrent.com/producto/lgmg-as1212e-unidad/",
  year: null, horometer: null, serialNumber: null
});

test("los documentos técnicos se obtienen del conocimiento tipado y no de narradores de proveedor", () => {
  const references = loadEditorialKnowledge().technicalReferences;
  assert.ok(references.size > 0);
  for (const models of references.values()) for (const model of models) {
    assert.match(model.sourceUrl, /^https:\/\//u);
    assert.ok(model.brand.trim() && model.model.trim() && model.family.trim());
    assert.ok(model.advertisedWorkHeight && model.documentedWorkHeight && model.platformHeight && model.nominalCapacity);
  }
});

test("la referencia técnica se reutiliza entre proveedores sin atribuir sus capacidades a la unidad", () => {
  const mercaeleva = documentedMercaeleva();
  const gomariz = documentedGomariz();
  const initial = [JSON.stringify(mercaeleva), JSON.stringify(gomariz)];
  const referenceMercaeleva = resolveKnowledgeEditorial(mercaeleva).modelReference;
  const referenceGomariz = resolveKnowledgeEditorial(gomariz).modelReference;
  const technical = (value: string | null): string =>
    value?.slice(value.indexOf("La documentación técnica de referencia")) ?? "";
  assert.ok(technical(referenceMercaeleva));
  assert.equal(technical(referenceMercaeleva), technical(referenceGomariz));
  assert.match(referenceMercaeleva ?? "", /modelo LGMG AS1212E.*altura de trabajo de 14 m.*altura de plataforma de 12 m.*capacidad nominal de 320 kg/u);
  assert.match(referenceMercaeleva ?? "", /no acreditan la configuración ni las prestaciones de esta unidad/u);
  for (const record of [mercaeleva, gomariz]) {
    const output = prepareSourceProduct(record).product;
    assert.match(output.description_general ?? "", /La documentación técnica de referencia del modelo LGMG AS1212E/u);
    assert.doesNotMatch(output.description_general ?? "", /horómetro de 10000 horas/u);
  }
  assert.deepEqual([JSON.stringify(mercaeleva), JSON.stringify(gomariz)], initial);
});

test("una ficha entrante conserva el modelo pero no hereda atributos exclusivos de otra unidad", () => {
  const incoming = newlyArrived();
  assert.equal(resolveEditorialFacts(incoming)?.workingHeightM, 14);
  const knowledge = resolveKnowledgeEditorial(incoming);
  assert.match(knowledge.modelReference ?? "", /altura de plataforma de 12 m/u);
  assert.equal(knowledge.general, null);
  const result = prepareSourceProduct(incoming).product;
  assert.match(result.description_general ?? "", /Las magnitudes corresponden al modelo o versión documentada/u);
  assert.doesNotMatch(result.description_general ?? "", /CONTROL-01\b/u);
});

test("familia, altura, motorización, identidad y variantes incompatibles impiden la extrapolación", () => {
  const source = newlyArrived();
  const variants: ProductRecord[] = [
    { ...source, specs: { ...source.specs, "Altura de trabajo": "10 m" } },
    { ...source, specs: { ...source.specs, Capacidad: "450 kg" } },
    { ...source, title: "Plataforma de tijera diésel LGMG AS1212E", specs: { ...source.specs, Motor: "Diésel" } },
    { ...source, model: "AS1212E-OTRA", title: "Plataforma de tijera eléctrica LGMG AS1212E-OTRA" },
    { ...source, title: "Plataforma articulada eléctrica LGMG AS1212E" }
  ];
  for (const incompatible of variants) {
    assert.equal(Boolean(resolveKnowledgeEditorial(incompatible).modelReference?.includes("La documentación técnica de referencia")), false);
  }
  assert.equal(resolveKnowledgeEditorial({ ...source, reference: null }).modelReference, null);
});

test("documentaciones contradictorias para el mismo modelo y variante no se fusionan arbitrariamente", () => {
  const knowledge = loadEditorialKnowledge();
  const entries = knowledge.technicalReferences.get("haulotte|optimum 8");
  if (!entries || entries.length < 2) throw new Error("Faltan variantes documentadas del modelo");
  assert.notEqual(entries[0]?.documentedWorkHeight, entries[1]?.documentedWorkHeight);
  const record: ProductRecord = {
    ...documentedGomariz(), brand: "Haulotte", model: "Optimum 8",
    title: "Plataforma de tijera eléctrica Haulotte Optimum 8",
    url: "https://www.gomarizrent.com/producto/haulotte-optimum-8/",
    longDescription: "Plataforma de tijera eléctrica Haulotte Optimum 8 para trabajos en altura.",
    specs: { "Altura de trabajo": "8 m", Capacidad: "230 kg", Motor: "Eléctrico" }
  };
  const facts = resolveEditorialFacts(record);
  if (!facts) throw new Error("La familia de la ficha de prueba no es verificable");
  assert.equal(resolveTechnicalModelReference(facts, knowledge), null);
});

test("referencia de vendedor, horas y etiquetas comerciales requieren concordancia de la misma unidad", () => {
  const source: ProductRecord = {
    ...documentedMercaeleva(), horometer: "145",
    specs: { ...documentedMercaeleva().specs, "Artículo No.": "REF-145", "Horas laborales": "145 h" }
  };
  const base = "Ficha técnica del equipo anunciado.";
  const details = resolveVerifiedEditorialUnitContext(source, base, source) ?? "";
  assert.match(details, /Referencia comercial declarada por el vendedor: REF-145/u);
  assert.match(details, /declara 145 h de uso/u);
  assert.doesNotMatch(resolveVerifiedEditorialUnitContext(source, base, { ...source, reference: "OTRA-UNIDAD" }) ?? "", /Referencia comercial declarada/u);
  const changed = { ...source, specs: { ...source.specs, "Artículo No.": "OTRA-REFERENCIA", "Horas laborales": "99999 h" } };
  assert.doesNotMatch(resolveVerifiedEditorialUnitContext(source, base, changed) ?? "", /REF-145|145 h/u);
  const marketing = { ...source, longDescription: `${source.longDescription ?? ""} SECOND LIFE` };
  assert.match(resolveVerifiedEditorialUnitContext(marketing, base) ?? "", /sin acreditar una rehabilitación concreta/u);
  const painted = { ...source, longDescription: `${source.longDescription ?? ""} PINTADA` };
  assert.match(resolveVerifiedEditorialUnitContext(painted, base) ?? "", /no acredita una revisión mecánica/u);
});


test("RE073 acredita la documentación de fabricante para unidades nuevas sin copiar la configuración individual", () => {
  const originals = [documentedGomariz(), documentedMercaeleva()];
  for (const source of originals) {
    const incoming: ProductRecord = {
      ...source,
      reference: "CONTROL-RE073",
      url: source.providerId === "gomariz" ?
        "https://www.gomarizrent.com/producto/lgmg-as1212e-control-re073/" :
        "https://sales.mercaeleva.com/es/for-sale/machine/lgmg-as1212e-CONTROL-RE073",
      horometer: "145",
      serialNumber: "SERIE-RE073"
    };
    const snapshot = JSON.stringify(incoming);
    const reference = resolveKnowledgeEditorial(incoming).modelReference;
    assert.match(reference ?? "", /La documentación técnica de referencia del modelo LGMG AS1212E/u);
    assert.match(reference ?? "", /no acreditan la configuración ni las prestaciones de esta unidad/u);
    const result = prepareSourceProduct(incoming);
    assert.match(result.product.description_general ?? "", /La documentación técnica de referencia del modelo LGMG AS1212E/u);
    assert.doesNotMatch(reference ?? "", /145 horas|SERIE-RE073/u);
    assert.equal(JSON.stringify(incoming), snapshot);
    for (const invalid of [
      { ...incoming, brand: "OTRA MARCA" },
      { ...incoming, specs: { ...incoming.specs, "Altura de trabajo": "10 m" } },
      { ...incoming, title: "Plataforma articulada eléctrica LGMG AS1212E" },
      { ...incoming, url: "https://example.invalid/unidad" }
    ]) {
      assert.doesNotMatch(resolveKnowledgeEditorial(invalid).modelReference ?? "", /La documentación técnica de referencia/u);
      assert.doesNotMatch(prepareSourceProduct(invalid).product.description_general ?? "", /La documentación técnica de referencia del modelo LGMG AS1212E/u);
    }
  }
});
