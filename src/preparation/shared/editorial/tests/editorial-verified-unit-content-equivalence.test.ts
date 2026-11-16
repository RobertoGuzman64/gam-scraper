import assert from "node:assert/strict";
import test from "node:test";
import type { ProductRecord } from "../../../../contracts/catalog.js";
import { accreditedSourceRecord } from "../../../../testing/domain-cases/accredited-source-samples.js";
import { prepareSourceProduct } from "../../../prepare-product.js";
import { resolveReusableEditorial } from "../domain/editorial-composition.js";
import { resolveKnowledgeEditorial } from "../mapping/knowledge-editorial.js";
import {
  controlledGamForklift, controlledGomarizPlatform, controlledMercaelevaForklift
} from "./editorial-contract-records.js";

type Provider = "gam" | "gomariz" | "mercaeleva";

const original = (provider: Provider, reference: string): ProductRecord =>
  accreditedSourceRecord(`${provider}-original`, reference);

test("conserva textos de unidad GAM firmados y compuestos por campo", () => {
  for (const reference of ["6650", "6689"]) {
    const source = original("gam", reference);
    const snapshot = JSON.stringify(source);
    const knowledge = resolveKnowledgeEditorial(source, source);
    const prepared = prepareSourceProduct(source);
    assert.ok(knowledge.short, reference);
    assert.ok(knowledge.general, reference);
    assert.equal(prepared.status, "ready", reference);
    assert.equal(prepared.product.description, knowledge.short, reference);
    assert.equal(prepared.product.description_general, knowledge.general, reference);
    assert.notEqual(prepared.product.description, prepared.product.description_general);
    assert.equal(JSON.stringify(source), snapshot);
  }
});

test("acepta la limpieza de una firma GAM sin convertirla en pérdida de procedencia", () => {
  const source = original("gam", "6196");
  const signed = resolveKnowledgeEditorial(source, source);
  const prepared = prepareSourceProduct(source);
  assert.ok(signed.general);
  assert.ok(prepared.product.description_general);
  assert.notEqual(prepared.product.description_general, signed.general);
  assert.match(signed.general, /«Plataforma Tijera Eléctrica 8M JLG 1930ES»/u);
  assert.match(prepared.product.description_general, /«Plataforma Tijera Eléctrica 8M JLG 1930ES»/u);
  assert.match(prepared.product.description_general, /8 m/u);
  assert.match(prepared.product.description_general, /B200021461/u);
});

test("conserva el título, la general y la corta cuando Gomariz acredita cada campo", () => {
  for (const [reference, field] of [
    ["TE1618", "general"], ["BA1465", "short"], ["BA1253", "title"]
  ] as const) {
    const source = original("gomariz", reference);
    const snapshot = JSON.stringify(source);
    const knowledge = resolveKnowledgeEditorial(source, source);
    const prepared = prepareSourceProduct(source);
    const asserted = knowledge[field];
    assert.ok(asserted, reference);
    assert.equal(prepared.status, "ready", reference);
    assert.equal(field === "general" ? prepared.product.description_general :
      field === "short" ? prepared.product.description : prepared.product.title, asserted, reference);
    assert.equal(JSON.stringify(source), snapshot);
  }
});

test("respeta que una general de reserva Gomariz ceda a hechos técnicos más sólidos", () => {
  const source = original("gomariz", "TE1772");
  const knowledge = resolveKnowledgeEditorial(source, source);
  const shared = resolveReusableEditorial(source);
  const prepared = prepareSourceProduct(source);
  assert.ok(knowledge.fallbackGeneral);
  assert.ok(shared.general);
  assert.equal(prepared.status, "ready");
  assert.ok(prepared.product.description_general?.startsWith(shared.general));
  assert.notEqual(prepared.product.description_general, knowledge.fallbackGeneral);
  assert.match(prepared.product.description_general ?? "", /7,8 m/u);
});

test("conserva cortas, generales y reserva validada por unidad Mercaeleva", () => {
  for (const [reference, field] of [
    ["M940-4770", "general"], ["M239-6301", "short"],
    ["M208-7097", "general"], ["M736-5615", "fallbackGeneral"]
  ] as const) {
    const source = original("mercaeleva", reference);
    const knowledge = resolveKnowledgeEditorial(source, source);
    const prepared = prepareSourceProduct(source);
    const asserted = knowledge[field];
    assert.ok(asserted, reference);
    assert.equal(prepared.status, "ready", reference);
    assert.equal(field === "short" ? prepared.product.description : prepared.product.description_general,
      asserted, reference);
  }
});

test("no reatribuyen evidencias firmadas al variar unidad, proveedor o fuente", () => {
  for (const [provider, reference] of [
    ["gam", "6689"], ["gomariz", "TE1618"], ["mercaeleva", "M940-4770"]
  ] as const) {
    const source = original(provider, reference);
    const signed = resolveKnowledgeEditorial(source, source);
    assert.ok(signed.short || signed.general || signed.title);
    for (const changed of [
      { ...source, reference: `${reference}-OTRA` },
      { ...source, providerId: `${provider}-otro` },
      { ...source, url: `${source.url}?cambio=1` },
      { ...source, model: `${source.model}-otra` },
      { ...source, year: "2039" },
      { ...source, specs: { ...source.specs, "Identidad no acreditada": "otra" } }
    ]) {
      const rejected = resolveKnowledgeEditorial(changed, changed);
      assert.equal(rejected.short, null, `${provider}:${reference}:short`);
      assert.equal(rejected.general, null, `${provider}:${reference}:general`);
      assert.equal(rejected.fallbackGeneral, null, `${provider}:${reference}:fallbackGeneral`);
      assert.equal(rejected.title, null, `${provider}:${reference}:title`);
    }
  }
});

test("reutilizan reglas en nuevas unidades sin copiar evidencias particulares", () => {
  for (const create of [controlledGamForklift, controlledGomarizPlatform, controlledMercaelevaForklift]) {
    const source = create();
    const snapshot = JSON.stringify(source);
    const knowledge = resolveKnowledgeEditorial(source, source);
    const shared = resolveReusableEditorial(source);
    const prepared = prepareSourceProduct(source);
    assert.equal(knowledge.short, null, source.providerId);
    assert.equal(knowledge.general, null, source.providerId);
    assert.equal(knowledge.fallbackGeneral, null, source.providerId);
    assert.equal(knowledge.title, null, source.providerId);
    assert.ok(shared.short, source.providerId);
    assert.ok(shared.general, source.providerId);
    assert.equal(prepared.status, "ready", source.providerId);
    assert.equal(prepared.product.description, shared.short, source.providerId);
    assert.ok(prepared.product.description_general?.startsWith(shared.general), source.providerId);
    assert.equal(JSON.stringify(source), snapshot);
  }
});

test("no convierten una firma histórica en aprobación de contradicciones", () => {
  const gam = original("gam", "6909");
  const gamSigned = resolveKnowledgeEditorial(gam, gam);
  const gamPrepared = prepareSourceProduct(gam);
  assert.ok(gamSigned.general);
  assert.equal(gamPrepared.status, "ready");
  assert.deepEqual(gamPrepared.issues, []);
  assert.match(gamPrepared.product.description ?? "", /SJIII-3220M/u);
  assert.match(gamPrepared.product.description ?? "", /2008/u);
  assert.equal(gamPrepared.product.description_general, gamSigned.general);

  const mercaeleva = original("mercaeleva", "M486-0114");
  const mercaSigned = resolveKnowledgeEditorial(mercaeleva, mercaeleva);
  const mercaPrepared = prepareSourceProduct(mercaeleva);
  assert.ok(mercaSigned.general);
  assert.equal(mercaPrepared.status, "ready");
  assert.deepEqual(mercaPrepared.issues, []);
  assert.equal(mercaPrepared.product.description_general, mercaSigned.general);
});

test("la motorización documentada sustituye la cautela histórica sin modificar el conocimiento firmado", () => {
  const source = original("gomariz", "RE454");
  const snapshot = JSON.stringify(source);
  const signed = resolveKnowledgeEditorial(source, source);
  const prepared = prepareSourceProduct(source);
  assert.match(signed.fallbackGeneral ?? "", /motor eléctrico.*no se traslada.*no estar corroborado/su);
  assert.equal(prepared.status, "ready");
  assert.deepEqual(prepared.issues, []);
  assert.notEqual(prepared.product.description_general, signed.fallbackGeneral);
  assert.match(prepared.product.title ?? "", /Excavadora diésel Jcb 1CX/u);
  assert.match(prepared.product.description ?? "", /diésel/u);
  assert.doesNotMatch(`${prepared.product.description} ${prepared.product.description_general}`, /motor eléctrico/iu);
  assert.equal(prepared.product.spec.Motor, "Diésel");
  assert.equal(source.specs?.Motor, "Eléctrico");
  assert.equal(JSON.stringify(source), snapshot);
});

test("una unidad distinta no hereda ni la advertencia histórica ni la motorización de una firma ajena", () => {
  const source = original("gomariz", "RE454");
  const changed: ProductRecord = {
    ...source,
    reference: "RE454-OTRA",
    url: source.url.replace(/\/$/u, "-otra/")
  };
  const knowledge = resolveKnowledgeEditorial(changed, changed);
  const prepared = prepareSourceProduct(changed);
  assert.equal(knowledge.fallbackGeneral, null);
  assert.equal(prepared.status, "ready");
  assert.ok(!prepared.issues.some((issue) => issue.includes("Motorización de origen no corroborada")));
  assert.match(prepared.product.title ?? "", /eléctrica/u);
  assert.doesNotMatch(prepared.product.description_general ?? "", /no estar corroborado frente a la identidad/u);
});

test("una huella, modelo, proveedor o URL incompatibles no habilitan la cautela histórica", () => {
  const source = original("gomariz", "RE454");
  for (const changed of [
    { ...source, reference: "RE454-OTRA" },
    { ...source, url: `${source.url}?revision=1` },
    { ...source, providerId: "gam" },
    { ...source, model: "1CX-OTRA" },
    { ...source, specs: { ...source.specs, Motor: "Diésel" } }
  ]) {
    assert.equal(resolveKnowledgeEditorial(changed, changed).fallbackGeneral, null);
    const prepared = prepareSourceProduct(changed);
    assert.ok(!prepared.issues.includes("Motorización de origen no corroborada por evidencia histórica firmada"));
  }
});

test("una reconciliación de capacidad documentada conserva la corta y general firmadas del original", () => {
  const source = original("mercaeleva", "M582-1882");
  const snapshot = JSON.stringify(source);
  const signed = resolveKnowledgeEditorial(source, source);
  const prepared = prepareSourceProduct(source);
  assert.ok(signed.short);
  assert.ok(signed.general);
  assert.equal(prepared.status, "ready");
  assert.equal(prepared.product.description, signed.short);
  assert.equal(prepared.product.description_general, signed.general);
  assert.doesNotMatch(prepared.product.title ?? "", /3\.000 kg/u);
  assert.match(prepared.product.description_general ?? "", /mástil triple/u);
  assert.equal(prepared.product.spec["Capacidad máxima de elevación"], "2500 kg");
  assert.equal(JSON.stringify(source), snapshot);
});

test("firmas de capacidad no autorizan reconciliaciones distintas ni otras unidades", () => {
  const source = original("mercaeleva", "M582-1882");
  const wrongCapacity: ProductRecord = {
    ...source,
    title: source.title?.replace("3000 KG", "2800 KG") ?? null,
    longDescription: source.longDescription?.replace("3000 KG", "2800 KG") ?? null,
    specs: { ...source.specs, "Título adicional": "CARRETILLA ELEVADORA DIESEL 2800 KG" }
  };
  const changedSources: ProductRecord[] = [
    { ...source, reference: "M582-1882-NUEVA", url: `${source.url}-nueva` },
    { ...source, model: "E2D2A30-OTRA", specs: { ...source.specs, Modelo: "E2D2A30-OTRA" } },
    { ...source, providerId: "gomariz" },
    { ...source, url: `${source.url}?actualizado=1` },
    { ...source, specs: { ...source.specs, "Capacidad máxima de elevación": "2800 kg" } }
  ];
  for (const candidate of changedSources) {
    const result = resolveKnowledgeEditorial(candidate, candidate);
    assert.equal(result.general, null);
    assert.equal(result.short, null);
  }
  const knowledge = resolveKnowledgeEditorial(wrongCapacity, source);
  assert.equal(knowledge.general, null);
  assert.equal(knowledge.short, null);
});

test("una unidad nueva compatible usa su propia ficha sin heredar una firma de capacidad reconciliada", () => {
  const source = original("mercaeleva", "M582-1882");
  const fresh: ProductRecord = {
    ...source,
    reference: "M582-1882-NUEVA",
    url: `${source.url}-NUEVA`,
    title: source.title?.replace("3000 KG", "2500 KG") ?? null,
    longDescription: source.longDescription?.replace("MER0987", "MER0999").replace("3000 KG", "2500 KG").replace("8142", "370") ?? null,
    horometer: "370",
    specs: {
      ...source.specs,
      "Título adicional": "CARRETILLA ELEVADORA DIESEL 2500 KG",
      "Artículo No.": "MER0999",
      "Horas laborales": "370 h"
    }
  };
  const knowledge = resolveKnowledgeEditorial(fresh, fresh);
  const prepared = prepareSourceProduct(fresh);
  assert.equal(knowledge.short, null);
  assert.equal(knowledge.general, null);
  assert.equal(prepared.status, "ready");
  assert.match(prepared.product.description_general ?? "", /2\.500 kg/u);
  assert.doesNotMatch(`${prepared.product.description} ${prepared.product.description_general}`, /MER0987|8\.142 horas|reconciliación individual acreditada/u);
});

test("el modelo base reconciliado conserva las cortas firmadas y los datos propios de cada unidad", () => {
  for (const [reference, hours] of [["M838-0666", "4.212"], ["M969-4655", "3.912"]] as const) {
    const source = original("mercaeleva", reference);
    const snapshot = JSON.stringify(source);
    const signed = resolveKnowledgeEditorial(source, source);
    const prepared = prepareSourceProduct(source);
    assert.ok(signed.short, reference);
    assert.equal(prepared.status, "ready", reference);
    assert.equal(prepared.product.description, signed.short, reference);
    assert.match(prepared.product.description ?? "", new RegExp(`${hours.replace(".", "\\.")} horas`, "u"));
    assert.match(prepared.product.title ?? "", /JLG 450 AJ/u);
    assert.doesNotMatch(prepared.product.title ?? "", /SII|SIII/u);
    assert.equal(prepared.product.spec.Modelo, "450 AJ");
    assert.equal(JSON.stringify(source), snapshot);
  }
});

test("la reconciliación de modelo no autoriza transferir firmas entre unidades ni alteraciones de procedencia", () => {
  const source = original("mercaeleva", "M838-0666");
  const sourceSigned = resolveKnowledgeEditorial(source, source);
  assert.ok(sourceSigned.short);
  const candidates: ProductRecord[] = [
    { ...source, reference: "M838-0666-OTRA" },
    { ...source, providerId: "gam" },
    { ...source, url: `${source.url}?otro=1` },
    { ...source, year: "2014", specs: { ...source.specs, "Año de fabricación": "2014" } },
    { ...source, horometer: "9999", specs: { ...source.specs, "Horas laborales": "9999 h" } },
    { ...source, model: "450 AJ SII", specs: { ...source.specs, Modelo: "450 AJ SII" } },
    { ...source, longDescription: source.longDescription?.replace("450 AJ SII", "450 AJ SIII") ?? null }
  ];
  for (const candidate of candidates) {
    const selected = resolveKnowledgeEditorial(candidate, candidate);
    assert.equal(selected.short, null, candidate.reference ?? "sin referencia");
    const prepared = prepareSourceProduct(candidate);
    assert.notEqual(prepared.product.description, sourceSigned.short, candidate.reference ?? "sin referencia");
  }
  const other = original("mercaeleva", "M969-4655");
  assert.notEqual(prepareSourceProduct(other).product.description, sourceSigned.short);
});

test("una máquina nueva compatible no hereda horas ni firma histórica de una variante reconciliada", () => {
  const source = original("mercaeleva", "M838-0666");
  const fresh: ProductRecord = {
    ...source,
    reference: "M838-0666-NUEVA",
    url: source.url.replace("M838-0666", "M838-0666-NUEVA"),
    title: "JLG 450 AJ PLATAFORMA ARTICULADA DIESEL 16 MT",
    model: "450 AJ",
    horometer: "130",
    longDescription: "PLATAFORMA ARTICULADA DIESEL ALTURA DE TRABAJO 16 MT JLG 450 AJ HORAS: 130 AÑO DE FABRICACION 2013",
    specs: {
      ...source.specs,
      Modelo: "450 AJ",
      "Horas laborales": "130 h"
    }
  };
  const knowledge = resolveKnowledgeEditorial(fresh, fresh);
  const prepared = prepareSourceProduct(fresh);
  assert.equal(knowledge.short, null);
  assert.equal(prepared.status, "ready");
  assert.notEqual(prepared.product.description, resolveKnowledgeEditorial(source, source).short);
  assert.doesNotMatch(prepared.product.description ?? "", /4\.212|3\.912/u);
  assert.match(prepared.product.description_general ?? "", /130 horas/u);
});

test("las firmas históricas conservan identificadores técnicos y citas literales de los originales", () => {
  const alternator = original("gam", "1210");
  const signedAlternator = resolveKnowledgeEditorial(alternator, alternator);
  const preparedAlternator = prepareSourceProduct(alternator);
  assert.match(signedAlternator.general ?? "", /Mecc Alte ECP 32 2M B/u);
  assert.match(preparedAlternator.product.description_general ?? "", /Mecc Alte ECP 32 2M B/u);
  assert.equal(preparedAlternator.status, "ready");

  const source = original("mercaeleva", "M855-6850");
  const signed = resolveKnowledgeEditorial(source, source);
  const prepared = prepareSourceProduct(source);
  assert.match(signed.general ?? "", /«4\.30mm»/u);
  assert.match(prepared.product.description_general ?? "", /«4\.30mm»/u);
  assert.match(prepared.product.description_general ?? "", /4\.300 mm/u);
  assert.equal(prepared.status, "ready");
});


test("una firma de alturas diferenciadas conserva la denominación literal del original", () => {
  const source = original("mercaeleva", "M486-0114");
  const snapshot = JSON.stringify(source);
  const signed = resolveKnowledgeEditorial(source, source).general;
  assert.ok(signed);
  assert.match(signed, /«14 MT»/u);
  const prepared = prepareSourceProduct(source);
  assert.equal(prepared.status, "ready");
  assert.deepEqual(prepared.issues, []);
  assert.equal(prepared.product.description_general, signed);
  assert.match(prepared.product.description_general ?? "", /16 m de altura de trabajo.*«14 MT»/u);
  assert.equal(JSON.stringify(source), snapshot);
});
