import assert from "node:assert/strict";
import test from "node:test";
import type { ProductRecord } from "../../../../contracts/catalog.js";
import { accreditedSourceRecord, accreditedSourceSamples } from "../../../../testing/domain-cases/accredited-source-samples.js";
import { prepareSourceProduct } from "../../../prepare-product.js";
import { hasCrossedGamEditorialIdentity, hasGamModelTitleDisagreement } from "../../../gam/identity/evidence/gam-crossed-editorial-identity.js";
import { editorialFamilyOf } from "../domain/editorial-families.js";
import { resolveReusableEditorial } from "../domain/editorial-composition.js";
import { resolveKnowledgeEditorial } from "../mapping/knowledge-editorial.js";

const original = (reference: string): ProductRecord => accreditedSourceRecord("gam-editorial-cases", reference);
const newUnit = (source: ProductRecord, reference: string): ProductRecord => ({
  ...source,
  reference,
  url: source.url.replace(`/${source.reference}-`, `/${reference}-`),
  year: null,
  horometer: null,
  serialNumber: null
});

test("la identidad GAM cruzada conserva su advertencia histórica y no publica un ready contradictorio", () => {
  const source = original("2328");
  const snapshot = JSON.stringify(source);
  const signed = resolveKnowledgeEditorial(source, source);
  const result = prepareSourceProduct(source);
  assert.ok(signed.general);
  assert.equal(hasCrossedGamEditorialIdentity(source), true);
  assert.equal(result.status, "review");
  assert.ok(result.issues.includes("Identidad GAM contradictoria entre título, resumen y ficha técnica"));
  assert.equal(result.product.description, null);
  assert.equal(result.product.description_general, signed.general);
  assert.match(result.product.description_general ?? "", /no conciliadas/u);
  assert.match(result.product.description_general ?? "", /no debe presentarse como unidad de 9 toneladas/u);
  assert.equal(JSON.stringify(source), snapshot);
});

test("la contradicción cruzada de una nueva unidad no hereda la advertencia firmada ajena", () => {
  const source = original("2328");
  const changed = newUnit(source, "CONTROL-IDENTIDAD-NEW");
  const result = prepareSourceProduct(changed);
  assert.equal(hasCrossedGamEditorialIdentity(changed), true);
  assert.equal(resolveKnowledgeEditorial(changed, changed).general, null);
  assert.equal(result.status, "review");
  assert.ok(result.issues.includes("Identidad GAM contradictoria entre título, resumen y ficha técnica"));
  assert.equal(result.product.description, null);
  assert.equal(result.product.description_general, null);
  assert.notEqual(result.product.description_general, resolveKnowledgeEditorial(source, source).general);
});

test("la autenticidad, el modelo, el proveedor y la fuente condicionan la reconciliación GAM", () => {
  const source = original("2328");
  for (const changed of [
    { ...source, providerId: "gomariz" },
    { ...source, url: "https://otro.example/es/carretillas/2328-datos" },
    { ...source, url: `${source.url}?variante=2` },
    { ...source, reference: "OTRA-UNIDAD" },
    { ...source, specs: { ...source.specs, Modelo: "GP80SVX" } },
    { ...source, longDescription: source.longDescription?.replaceAll("GP90VX", "GDP/GLP80VX") ?? null }
  ]) {
    assert.equal(hasCrossedGamEditorialIdentity(changed), false);
    assert.equal(resolveKnowledgeEditorial(changed, changed).general, null);
  }
});

test("la identidad coherente de otra carretilla GAM no recibe el conflicto de otra referencia", () => {
  const source = original("4683");
  const changed = newUnit(source, "CONTROL-HELI-OTRA");
  const result = prepareSourceProduct(changed);
  assert.equal(hasCrossedGamEditorialIdentity(changed), false);
  assert.equal(result.status, "ready");
  assert.match(result.product.description ?? "", /HELI CPQYD25-RC1H/u);
  assert.match(result.product.description_general ?? "", /2\.500 kg/u);
  assert.doesNotMatch(result.product.description_general ?? "", /GP90VX|GP80SVX/u);
});

test("los originales GAM sin descripciones mantienen su completado histórico firmado", () => {
  for (const reference of ["4683", "4691"]) {
    const source = original(reference);
    const snapshot = JSON.stringify(source);
    const signed = resolveKnowledgeEditorial(source, source);
    const prepared = prepareSourceProduct(source);
    assert.equal(source.shortDescription, null);
    assert.equal(source.longDescription, null);
    assert.ok(signed.general);
    assert.equal(prepared.status, "ready");
    assert.equal(prepared.product.description_general, signed.general);
    assert.equal(prepared.product.description, signed.general?.split(/(?<=[.!?])\s+(?=[A-ZÁÉÍÓÚÑ])/u)[0]);
    assert.equal(JSON.stringify(source), snapshot);
  }
});

test("la composición de grúa horquilla GAM se reutiliza en nuevas unidades con su propia capacidad", () => {
  for (const [reference, capacity] of [["4683", "2500"], ["4691", "3000"]] as const) {
    const source = original(reference);
    const changed = newUnit(source, `${reference}-UNIDAD-NUEVA`);
    const knowledge = resolveKnowledgeEditorial(changed, changed);
    const reusable = resolveReusableEditorial(changed);
    const prepared = prepareSourceProduct(changed);
    assert.equal(knowledge.general, null);
    assert.equal(knowledge.short, null);
    assert.ok(reusable.short);
    assert.ok(reusable.general);
    assert.equal(prepared.status, "ready");
    assert.equal(prepared.product.description, reusable.short);
    assert.match(prepared.product.description ?? "", new RegExp(`(?:${Number(capacity).toLocaleString("de-DE")}|${capacity}) kg`, "u"));
    assert.ok(prepared.product.description_general?.startsWith(reusable.general));
    assert.notEqual(prepared.product.description_general, resolveKnowledgeEditorial(source, source).general);
  }
});

test("la nueva unidad compatible no copia la capacidad o la variante de su antecesora", () => {
  const source = original("4683");
  const changed: ProductRecord = {
    ...newUnit(source, "CONTROL-HELI-1800"),
    title: source.title?.replace("2500Kg", "1800Kg") ?? null,
    specs: { ...source.specs, "Capacidad de carga (kg)": "1800 KG" }
  };
  const prepared = prepareSourceProduct(changed);
  assert.equal(prepared.status, "ready");
  assert.match(prepared.product.description ?? "", /1\.800 kg/u);
  assert.match(prepared.product.description_general ?? "", /1\.800 kg/u);
  assert.doesNotMatch(prepared.product.description_general ?? "", /2\.500 kg/u);
  assert.equal(resolveKnowledgeEditorial(changed, changed).general, null);
});

test("una familia incompatible, una magnitud inconsistente y una fuente ajena impiden el completado", () => {
  const source = newUnit(original("4683"), "CONTROL-HELI-CHECK");
  assert.equal(editorialFamilyOf("Grúa horquilla GLP"), "carretilla-elevadora");
  assert.equal(editorialFamilyOf("Grúa puente para naves"), null);
  for (const changed of [
    { ...source, specs: { ...source.specs, "Capacidad de carga (kg)": "3000 m" } },
    { ...source, model: "CPQYD30-RC1H" },
    { ...source, specs: { ...source.specs, Modelo: "CPQYD30-RC1H" } },
    { ...source, providerId: "proveedor-ajeno" },
    { ...source, url: `${source.url}?revisado=1` }
  ]) {
    const result = prepareSourceProduct(changed);
    assert.equal(result.status, "review");
    assert.equal(result.product.description_general, null);
  }
  const accessory = accreditedSourceRecord("gam-original", "2364");
  const preparedAccessory = prepareSourceProduct(accessory);
  assert.equal(preparedAccessory.status, "ready");
  assert.match(preparedAccessory.product.description ?? "", /BRAVI SKY DECK/u);
  assert.match(preparedAccessory.product.description_general ?? "", /4,2 kg/u);
});

const documentedModelDisagreements = ["4736"] as const;

const corroboratedModelDisagreements = ["4737", "4802", "4751", "4752", "6274", "6422", "6745"] as const;

test("el aviso firmado prevalece cuando la identidad GAM sigue sin corroboración suficiente", () => {
  const available = [...accreditedSourceSamples("gam-original"), ...accreditedSourceSamples("gam-source-cases")];
  for (const reference of documentedModelDisagreements) {
    const source = available.find((record) => record.reference === reference);
    assert.ok(source, reference);
    const before = JSON.stringify(source);
    const signed = resolveKnowledgeEditorial(source, source);
    const prepared = prepareSourceProduct(source);
    assert.equal(hasGamModelTitleDisagreement(source), true, reference);
    assert.ok(signed.general, reference);
    assert.equal(prepared.status, "review", reference);
    assert.ok(prepared.issues.some((issue) => issue.startsWith("Identidad GAM contradictoria")), reference);
    assert.equal(prepared.product.description_general, signed.general, reference);
    assert.equal(JSON.stringify(source), before);
  }
});

test("reconcilia antes de componer únicamente las identidades corroboradas en el origen", () => {
  const available = [...accreditedSourceSamples("gam-original"), ...accreditedSourceSamples("gam-source-cases"),
    ...accreditedSourceSamples("gam-editorial-cases")];
  for (const reference of corroboratedModelDisagreements) {
    const source = available.find((record) => record.reference === reference);
    assert.ok(source, reference);
    const before = JSON.stringify(source);
    const prepared = prepareSourceProduct(source);
    assert.equal(hasGamModelTitleDisagreement(source), true, reference);
    assert.equal(prepared.status, "ready", reference);
    assert.deepEqual(prepared.issues, [], reference);
    assert.equal(prepared.product.spec.Modelo, prepared.product.title?.includes("XCMG")
      ? source.title?.match(/XCMG\s+([\w-]+)/u)?.[1] : source.model, reference);
    assert.equal(prepared.product.reference, reference);
    assert.equal(prepared.product.sourceUrl, source.url);
    assert.equal(JSON.stringify(source), before);
    for (const altered of [
      { ...source, url: `${source.url}?variante=distinta` },
      { ...source, url: source.url.replace("online.gamrentals.com", "example.com") },
      { ...source, longDescription: "Identidad de modelo no acreditada" }
    ]) {
      const blocked = prepareSourceProduct(altered);
      assert.equal(blocked.status, "review", `${reference}:variante`);
    }
  }
});

test("la firma de un modelo GAM ambiguo no pasa a otra unidad ni a una variante reconciliada", () => {
  const source = accreditedSourceRecord("gam-original", "6274");
  const signed = resolveKnowledgeEditorial(source, source).general;
  assert.ok(signed);
  const original = prepareSourceProduct(source);
  assert.equal(original.status, "ready");
  assert.deepEqual(original.issues, []);
  assert.notEqual(original.product.description_general, signed);
  assert.equal(original.product.spec.Modelo, source.model);
  const changed = [
    { ...source, reference: "6274-OTRA", url: source.url.replace("/6274-", "/6274-OTRA-") },
    { ...source, model: "H12XD-12", specs: { ...source.specs, Modelo: "H12XD-12" } },
    { ...source, providerId: "gomariz" },
    { ...source, url: `${source.url}?origen=distinto` },
    { ...source, specs: { ...source.specs, "Altura de elevación (mm)": "4750 mm" } }
  ];
  for (const candidate of changed) {
    assert.equal(resolveKnowledgeEditorial(candidate, candidate).general, null);
    assert.notEqual(prepareSourceProduct(candidate).product.description_general, signed);
  }
  assert.equal(hasGamModelTitleDisagreement(changed[1]!), false);
});
