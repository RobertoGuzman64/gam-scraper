import assert from "node:assert/strict";
import test from "node:test";
import type { ProductRecord } from "../../../contracts/catalog.js";
import { prepareSourceProduct } from "../../prepare-product.js";
import { resolveEditorialFacts } from "../core/editorial-facts.js";
import { resolveVerifiedEditorialUnitContext } from "../identity/editorial-unit-context.js";
import { loadEditorialKnowledge } from "../../../infrastructure/filesystem/editorial/knowledge.js";
import { resolveKnowledgeEditorial } from "../core/knowledge-editorial.js";
import { controlledGomarizPlatform, controlledMercaelevaPlatform } from "../core/editorial-contract-records.js";

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

test("el texto comercial conserva la altura acreditada sin explicar documentación ni consenso del modelo", () => {
  const source = documentedMercaeleva();
  const result = prepareSourceProduct(source);
  assert.equal(result.status, "ready");
  assert.match(result.product.description_general ?? "", /altura de trabajo de 14 m/u);
  assert.match(result.product.description_general ?? "", /verificar la capacidad de cesta/u);
  assert.doesNotMatch(result.product.description_general ?? "",
    /documentación técnica (?:de referencia )?del modelo|otras fichas del catálogo|no acreditan la configuración ni las prestaciones de esta unidad/iu);
});

const documentaryNarrative = /documentación técnica (?:de referencia )?del modelo|otras fichas del catálogo|no acreditan la configuración ni las prestaciones de esta unidad|las magnitudes corresponden al modelo o versión documentada/iu;

test("el conocimiento de modelo permanece interno y no atribuye sus capacidades a unidades de distintos proveedores", () => {
  const records = [documentedMercaeleva(), documentedGomariz()];
  const initial = records.map((record) => JSON.stringify(record));
  for (const record of records) {
    const result = prepareSourceProduct(record);
    assert.equal(result.status, "ready");
    assert.deepEqual(result.product.spec, record.specs);
    assert.ok(result.technicalProvenance);
    assert.deepEqual(result.technicalProvenance.entries, []);
    assert.match(result.product.description_general ?? "", /altura de trabajo de 14 m/u);
    assert.doesNotMatch(result.product.description_general ?? "", documentaryNarrative);
    assert.doesNotMatch(result.product.description_general ?? "", /altura de plataforma de 12 m|horómetro de 10000 horas/u);
  }
  assert.deepEqual(records.map((record) => JSON.stringify(record)), initial);
});

test("una ficha entrante conserva el modelo pero no hereda atributos exclusivos de otra unidad", () => {
  const incoming = newlyArrived();
  assert.equal(resolveEditorialFacts(incoming)?.workingHeightM, 14);
  assert.equal(resolveKnowledgeEditorial(incoming).general, null);
  const result = prepareSourceProduct(incoming);
  assert.deepEqual(result.product.spec, incoming.specs);
  assert.doesNotMatch(result.product.description_general ?? "", documentaryNarrative);
  assert.doesNotMatch(result.product.description_general ?? "", /CONTROL-01\b|altura de plataforma de 12 m/u);
});

test("familia, altura, motorización, identidad y variantes incompatibles impiden la extrapolación", () => {
  const source = newlyArrived();
  const variants: ProductRecord[] = [
    { ...source, specs: { ...source.specs, "Altura de trabajo": "10 m" } },
    { ...source, specs: { ...source.specs, Capacidad: "450 kg" } },
    { ...source, title: "Plataforma de tijera diésel LGMG AS1212E", specs: { ...source.specs, Motor: "Diésel" } },
    { ...source, model: "AS1212E-OTRA", title: "Plataforma de tijera eléctrica LGMG AS1212E-OTRA" },
    { ...source, title: "Plataforma articulada eléctrica LGMG AS1212E" },
    { ...source, reference: null }
  ];
  for (const incompatible of variants) {
    const result = prepareSourceProduct(incompatible);
    assert.doesNotMatch(result.product.description_general ?? "", documentaryNarrative);
    assert.doesNotMatch(result.product.description_general ?? "", /altura de plataforma de 12 m|0,9 m de extensión de plataforma/u);
  }
});

test("documentaciones contradictorias para el mismo modelo y variante permanecen separadas del texto", () => {
  const knowledge = loadEditorialKnowledge();
  const entries = knowledge.technicalReferences.get("haulotte|optimum 8");
  if (!entries || entries.length < 2) throw new Error("Faltan variantes documentadas del modelo");
  assert.notEqual(entries[0]?.documentedWorkHeight, entries[1]?.documentedWorkHeight);
  const snapshot = JSON.stringify(entries);
  const record: ProductRecord = {
    ...documentedGomariz(), brand: "Haulotte", model: "Optimum 8",
    title: "Plataforma de tijera eléctrica Haulotte Optimum 8",
    url: "https://www.gomarizrent.com/producto/haulotte-optimum-8/",
    longDescription: "Plataforma de tijera eléctrica Haulotte Optimum 8 para trabajos en altura.",
    specs: { "Altura de trabajo": "8 m", Capacidad: "230 kg", Motor: "Eléctrico" }
  };
  const result = prepareSourceProduct(record);
  assert.deepEqual(result.product.spec, record.specs);
  assert.match(result.product.description_general ?? "", /altura de trabajo de 8 m/u);
  assert.doesNotMatch(result.product.description_general ?? "", documentaryNarrative);
  assert.equal(JSON.stringify(entries), snapshot);
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


test("las unidades nuevas conservan la identidad y sus valores sin narrar documentación de fabricante", () => {
  const originals = [documentedGomariz(), documentedMercaeleva()];
  for (const source of originals) {
    const incoming: ProductRecord = {
      ...source,
      reference: "CONTROL-SEMANTICO-073",
      url: source.providerId === "gomariz" ?
        "https://www.gomarizrent.com/producto/lgmg-as1212e-control-re073/" :
        "https://sales.mercaeleva.com/es/for-sale/machine/lgmg-as1212e-CONTROL-SEMANTICO-073",
      horometer: "145",
      serialNumber: "SERIE-PRUEBA"
    };
    const snapshot = JSON.stringify(incoming);
    const result = prepareSourceProduct(incoming);
    assert.match(result.product.description_general ?? "", /altura de trabajo de 14 m/u);
    assert.doesNotMatch(result.product.description_general ?? "", documentaryNarrative);
    assert.doesNotMatch(result.product.description_general ?? "", /altura de plataforma de 12 m/u);
    assert.equal(JSON.stringify(incoming), snapshot);
    for (const invalid of [
      { ...incoming, brand: "OTRA MARCA" },
      { ...incoming, specs: { ...incoming.specs, "Altura de trabajo": "10 m" } },
      { ...incoming, title: "Plataforma articulada eléctrica LGMG AS1212E" },
      { ...incoming, url: "https://example.invalid/unidad" }
    ]) {
      assert.doesNotMatch(prepareSourceProduct(invalid).product.description_general ?? "", documentaryNarrative);
    }
  }
});
