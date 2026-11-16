import assert from "node:assert/strict";
import test from "node:test";
import type { ProductRecord } from "../../../../contracts/catalog.js";
import { accreditedSourceRecord } from "../../../../testing/domain-cases/accredited-source-samples.js";
import { prepareSourceProduct } from "../../../prepare-product.js";
import { resolveEditorialFacts } from "../domain/editorial-facts.js";
import { editorialSourceDigest, loadEditorialKnowledge } from "../../../../infrastructure/filesystem/editorial/knowledge.js";
import { editorialModelKey, resolveModelReference, selectUnitKnowledge } from "../domain/editorial-knowledge.js";
import { resolveKnowledgeEditorial } from "../mapping/knowledge-editorial.js";
import { resolvePreparedEditorial } from "../mapping/prepared-editorial.js";
import { captureSourceEditorialEvidence } from "../mapping/source-editorial-evidence.js";

const get = (provider: string, reference: string): ProductRecord => {
  if (provider === "gam") return accreditedSourceRecord("gam-original", reference);
  if (provider === "gomariz") return accreditedSourceRecord("gomariz-original", reference);
  if (provider === "mercaeleva") return accreditedSourceRecord("mercaeleva-original", reference);
  throw new Error(`Proveedor desconocido: ${provider}`);
};

test("consume la evidencia declarativa de las tres fuentes sin narradores específicos", () => {
  const knowledge = loadEditorialKnowledge();
  assert.ok(knowledge.units.size >= 300);
  assert.ok(knowledge.models.size >= 100);
  assert.ok(Object.keys(knowledge.families).length >= 26);
  for (const [provider, reference] of [["gam", "2102"], ["gomariz", "TE1618"], ["mercaeleva", "M208-7097"]]) {
    if (!provider || !reference) continue;
    const source = get(provider, reference);
    const editorial = resolveKnowledgeEditorial(source);
    assert.ok(editorial.general);
    const prepared = prepareSourceProduct(source);
    assert.equal(prepared.product.description_general, editorial.general);
  }
});

test("la evidencia de una unidad exige referencia, URL, identidad y huella completas", () => {
  const source = get("gam", "2102");
  const knowledge = loadEditorialKnowledge();
  const initial = JSON.stringify(source);
  const identity = (record: ProductRecord) => ({
    key: `${record.providerId}:${record.reference ?? ""}`, sourceUrl: record.url,
    brand: record.brand ?? "", model: record.model ?? ""
  });
  const original = selectUnitKnowledge(identity(source), knowledge, editorialSourceDigest(source));
  assert.ok(original.general);
  for (const changed of [
    { ...source, reference: "2103" },
    { ...source, model: "OTRO" },
    { ...source, providerId: "gomariz" },
    { ...source, url: source.url.replace("/2102-", "/9999-") },
    { ...source, longDescription: `${source.longDescription ?? ""} Pendiente de comprobación.` },
    { ...source, specs: { ...source.specs, Peso: "5000 kg" } }
  ]) {
    const result = selectUnitKnowledge(identity(changed), knowledge, editorialSourceDigest(changed));
    assert.deepEqual(result, { short: null, general: null, fallbackGeneral: null, title: null });
    assert.notEqual(prepareSourceProduct(changed).product.description_general, original.general);
  }
  assert.equal(JSON.stringify(source), initial);
});

test("los consensos reconciliados distinguen magnitudes estables y configuraciones particulares", () => {
  const models = loadEditorialKnowledge().models;
  const reconciled = [
    { brand: "Ausa", model: "C250HX4", family: "carretilla-elevadora", stable: { liftingHeightM: 4.3, loadCapacityKg: 2500 }, samples: 2 },
    { brand: "Linde", model: "E16P-02", family: "carretilla-elevadora", stable: { loadCapacityKg: 1600 }, samples: 2 },
    { brand: "Nissan", model: "GQ02L30CU", family: "carretilla-elevadora", stable: { liftingHeightM: 6, loadCapacityKg: 3000 }, samples: 2 },
    { brand: "Nissan", model: "Q02L20CU", family: "carretilla-elevadora", stable: { liftingHeightM: 6, loadCapacityKg: 2000 }, samples: 2 },
    { brand: "Nissan", model: "Q02L25CU", family: "carretilla-elevadora", stable: { loadCapacityKg: 2500 }, samples: 2 },
    { brand: "Pramac", model: "GPW45P", family: "grupo-electrogeno", stable: { powerKva: 45, energy: "diésel" }, samples: 3 },
    { brand: "Toyota", model: "7FBEF15", family: "carretilla-elevadora", stable: { loadCapacityKg: 1500 }, samples: 2 }
  ] as const;
  for (const item of reconciled) {
    const entry = models.get(editorialModelKey(item.brand, item.model, item.family));
    assert.ok(entry);
    assert.equal(entry.samples, item.samples);
    assert.equal(new Set(entry.catalogReferences).size, item.samples);
    assert.deepEqual(entry.stable, item.stable);
  }
  const nissan = models.get(editorialModelKey("Nissan", "Q02L25CU", "carretilla-elevadora"));
  assert.ok(nissan);
  assert.deepEqual(nissan.catalogReferences, ["gomariz:CAE1207", "mercaeleva:M050-0294"]);
  const toyota = models.get(editorialModelKey("Toyota", "7FBEF15", "carretilla-elevadora"));
  assert.ok(toyota);
  assert.equal(toyota.stable.liftingHeightM, undefined);
});

test("la referencia de un modelo nuevo no atribuye medidas ausentes a otra unidad ni a otra variante", () => {
  const source = get("mercaeleva", "M855-6850");
  const snapshot = JSON.stringify(source);
  const next: ProductRecord = {
    ...source,
    reference: "M855-6850-ENTRANTE",
    url: source.url.replace("M855-6850", "M855-6850-ENTRANTE"),
    shortDescription: null,
    longDescription: null,
    year: null,
    horometer: null,
    serialNumber: null,
    specs: Object.fromEntries(Object.entries(source.specs ?? {}).filter(([key]) =>
      !["Altura máxima de elevación", "Año de fabricación", "Horas laborales", "Artículo No."].includes(key)))
  };
  const facts = resolveEditorialFacts(next);
  assert.ok(facts);
  assert.equal(facts.liftingHeightM, null);
  assert.equal(facts.loadCapacityKg, 2500);
  const models = loadEditorialKnowledge();
  const reference = resolveModelReference(facts, models);
  assert.match(reference ?? "", /otras fichas del catálogo del modelo Ausa C250HX4 publican altura de elevación de 4,3 m/u);
  assert.match(reference ?? "", /no acreditan por sí solos la configuración de esta unidad/u);
  assert.equal(resolveModelReference({ ...facts, model: "C250HX4-V" }, models), null);
  assert.equal(resolveModelReference({ ...facts, brand: "Linde" }, models), null);
  assert.equal(resolveModelReference({ ...facts, family: "grupo-electrogeno" }, models), null);
  assert.equal(resolveModelReference(resolveEditorialFacts(source) ?? facts, models), null);
  const result = prepareSourceProduct(next);
  assert.match(result.product.description_general ?? "", /Como referencia, otras fichas del catálogo del modelo Ausa C250HX4/u);
  assert.match(result.product.description_general ?? "", /no acreditan por sí solos la configuración de esta unidad/u);
  assert.doesNotMatch(result.product.description_general ?? "", /4\.257|4257|2017/u);
  assert.equal(JSON.stringify(source), snapshot);
});

test("una nueva unidad del mismo modelo recibe contexto, pero no hereda horas ni datos como propios", () => {
  const source = get("gomariz", "TE1591");
  const original = JSON.stringify(source);
  const next: ProductRecord = {
    ...source, reference: "TE199991", url: source.url.replace(/\/[^/]+\/$/u, "/lgmg-as0812-unidad-entrante/"),
    year: null, horometer: null, serialNumber: null,
    specs: Object.fromEntries(Object.entries(source.specs ?? {}).filter(([name]) => name !== "Altura plataforma"))
  };
  assert.ok(resolveEditorialFacts(next));
  const resolved = resolveKnowledgeEditorial(next);
  assert.match(resolved.modelReference ?? "", /otras fichas del catálogo del modelo LGMG AS0812/u);
  const prepared = prepareSourceProduct(next);
  assert.match(prepared.product.description_general ?? "", /datos no acreditan por sí solos la configuración de esta unidad/u);
  assert.doesNotMatch(prepared.product.description_general ?? "", /horas registradas/u);
  assert.equal(JSON.stringify(source), original);
});

test("un almacén vertical redacta capacidad por bandeja, sin fingir capacidad total", () => {
  const source = get("gam", "3434");
  const prepared = prepareSourceProduct(source);
  assert.equal(resolveEditorialFacts(source)?.family, "almacen-vertical");
  assert.match(prepared.product.description ?? "", /carga neta por bandeja de 350 kg/u);
  assert.match(prepared.product.description_general ?? "", /no equivale a la capacidad total/u);
});

test("la evidencia de fabricante distingue un elevador manual de una plataforma de personas", () => {
  const source = get("gomariz", "PV556");
  const record = prepareSourceProduct(source).product;
  assert.equal(resolveKnowledgeEditorial(source).familyOverride, "elevador-materiales");
  assert.match(record.description ?? "", /^Elevador de materiales Genie SLA15/u);
  assert.doesNotMatch(record.description ?? "", /plataforma eléctrica/u);
  assert.match(record.description_general ?? "", /elevador manual de material/u);
});

test("los títulos de unidad sólo se aplican cuando su huella de origen permanece intacta", () => {
  const source = get("gomariz", "BA1253");
  const knowledge = resolveKnowledgeEditorial(source);
  assert.ok(knowledge.title);
  assert.equal(prepareSourceProduct(source).product.title, knowledge.title);
  const changed = { ...source, title: `${source.title} edición nueva` };
  const changedTitle = resolveKnowledgeEditorial(changed);
  assert.equal(changedTitle.title, null);
  assert.notEqual(prepareSourceProduct(changed).product.title, knowledge.title);
});

test("el resumen corregido de origen se resuelve antes de publicar y no se propaga a variantes", () => {
  const source = get("gam", "5996");
  const editorial = resolveKnowledgeEditorial(source);
  assert.ok(editorial.short);
  const prepared = prepareSourceProduct(source).product;
  assert.equal(prepared.description, editorial.short);
  assert.notEqual(prepared.description, source.shortDescription);
  const changed = { ...source, reference: "OTRA-UNIDAD", url: source.url.replace("/5996-", "/OTRA-UNIDAD-") };
  assert.equal(resolveKnowledgeEditorial(changed).short, null);
  assert.notEqual(prepareSourceProduct(changed).product.description, editorial.short);
});

test("el conocimiento de GAM mantiene las identidades y no se propaga por parecido", () => {
  const knowledge = loadEditorialKnowledge();
  const samples = ["3997", "2212", "2102", "1713", "2370", "1210", "2097", "4733", "3993", "2218"] as const;
  for (const reference of samples) {
    const source = get("gam", reference);
    const matches = knowledge.units.get(`gam:${reference}`) ?? [];
    assert.ok(matches.some((entry) => entry.sourceUrl === source.url && entry.sourceDigest === editorialSourceDigest(source)));
    const editorial = resolveKnowledgeEditorial(source);
    assert.ok(editorial.general);
    assert.equal(resolvePreparedEditorial(source, source, captureSourceEditorialEvidence(source)).preparedLong, editorial.general);
    const changed = { ...source, specs: { ...source.specs, "Modelo": "VARIANTE-NO-ACREDITADA" } };
    const identity = { key: `gam:${reference}`, sourceUrl: source.url, brand: source.brand ?? "", model: source.model ?? "" };
    assert.deepEqual(selectUnitKnowledge(identity, knowledge, editorialSourceDigest(changed)),
      { short: null, general: null, fallbackGeneral: null, title: null });
  }
});

test("las generales firmadas quedan subordinadas a una composición más completa", () => {
  const preserved = [
    { provider: "gomariz", reference: "TE1858", required: /altura de plataforma de 4,3 m/u },
    { provider: "mercaeleva", reference: "M318-0509", required: /documentación técnica de referencia del modelo LGMG S1012E-2/u },
    { provider: "mercaeleva", reference: "M315-5925", required: /altura de referencia de 17,3 m/u }
  ];
  for (const item of preserved) {
    const source = get(item.provider, item.reference);
    const knowledge = resolveKnowledgeEditorial(source);
    assert.ok(knowledge.fallbackGeneral);
    assert.equal(knowledge.general, null);
    const published = prepareSourceProduct(source).product.description_general ?? "";
    assert.match(published, item.required);
    assert.notEqual(published, knowledge.fallbackGeneral);
  }
});

test("el respaldo firmado cubre huecos reales sin trasladar hechos a otras unidades", () => {
  for (const item of [
    { provider: "gomariz", reference: "OR1537", required: /motorización combinada eléctrica y de gasolina/u },
    { provider: "gomariz", reference: "BT1461", required: /15,60 m de altura de trabajo/u },
    { provider: "mercaeleva", reference: "M736-5615", required: /tolva con giro de hasta 180°/u }
  ]) {
    const source = get(item.provider, item.reference);
    const evidence = resolveKnowledgeEditorial(source);
    assert.ok(evidence.fallbackGeneral);
    assert.equal(evidence.general, null);
    const prepared = prepareSourceProduct(source);
    assert.match(prepared.product.description_general ?? "", item.required);
    for (const modified of [
      { ...source, reference: `${source.reference}-VARIANTE` },
      { ...source, url: `${source.url.replace(/\/$/u, "")}-otra-unidad` },
      { ...source, specs: { ...source.specs, "Ficha alterada": "dato diferente" } },
      { ...source, model: "VARIANTE-NO-ACREDITADA" }
    ]) {
      assert.equal(resolveKnowledgeEditorial(modified).fallbackGeneral, null);
      assert.notEqual(prepareSourceProduct(modified).product.description_general, evidence.fallbackGeneral);
    }
  }
});

test("las cortas documentadas se aplican por huella de unidad y no publican el texto de verificación", () => {
  const keys = ["gomariz:BA1465", "mercaeleva:M011-3720", "mercaeleva:M106-1389", "mercaeleva:M168-3277", "mercaeleva:M547-2372", "mercaeleva:M838-0666", "mercaeleva:M840-6795", "mercaeleva:M969-4655"] as const;
  const knowledge = loadEditorialKnowledge();
  const recovered = keys.flatMap((key) => (knowledge.units.get(key) ?? []).filter((entry) => entry.short));
  assert.equal(recovered.length, 8);
  assert.equal(new Set(recovered.map((entry) => entry.key)).size, 8);
  for (const entry of recovered) {
    const [provider, reference] = entry.key.split(":");
    if (!provider || !reference) throw new Error(`Clave de unidad inválida: ${entry.key}`);
    const original = get(provider, reference);
    assert.equal(entry.sourceDigest, editorialSourceDigest(original));
    assert.equal(entry.sourceUrl, original.url);
    assert.ok(entry.short);
    assert.equal(entry.general, null);
    assert.equal(entry.title, null);
    const prepared = prepareSourceProduct(original);
    const selected = resolveKnowledgeEditorial(original);
    assert.ok(selected.short);
    assert.ok(prepared.product.description_general?.trim());
    assert.equal(selectUnitKnowledge({
      key: entry.key, sourceUrl: original.url,
      brand: original.brand ?? "", model: original.model ?? ""
    }, knowledge, editorialSourceDigest(original)).short, selected.short);
    for (const altered of [
      { ...original, reference: `${reference}-VARIANTE` },
      { ...original, url: `${original.url.replace(/\/$/u, "")}-variante` },
      { ...original, title: `${original.title} variante` },
      { ...original, longDescription: `${original.longDescription} Información nueva` },
      { ...original, specs: { ...original.specs, "Ficha alterada": "valor diferente" } },
      { ...original, model: `${original.model}-VARIANTE` }
    ]) {
      const candidate = selectUnitKnowledge({
        key: `${altered.providerId}:${altered.reference ?? ""}`,
        sourceUrl: altered.url, brand: altered.brand ?? "", model: altered.model ?? ""
      }, knowledge, editorialSourceDigest(altered));
      assert.equal(candidate.short, null);
      assert.equal(candidate.general, null);
    }
  }
});

test("las cortas técnicas siguen siendo reutilizables para variantes nuevas sin transferir evidencias firmadas", () => {
  const originals = [get("gomariz", "BA1465"), get("mercaeleva", "M840-6795")];
  for (const original of originals) {
    const model = `${original.model}-VARIANTE`;
    const reference = `${original.reference}-NUEVA`;
    const variant: ProductRecord = {
      ...original,
      model,
      reference,
      title: original.title?.replace(original.model ?? "", model) ?? null,
      url: original.url.replace(original.model?.toLowerCase() ?? "", model.toLowerCase())
        .replace(original.reference ?? "", reference),
      specs: { ...original.specs, Modelo: model }
    };
    assert.equal(resolveKnowledgeEditorial(variant).short, null);
    const prepared = prepareSourceProduct(variant).product;
    assert.ok(prepared.description);
    assert.match(prepared.description, /VARIANTE/u);
    assert.notEqual(prepared.description, resolveKnowledgeEditorial(original).short);
    const contradicted = { ...variant, specs: { ...variant.specs, Modelo: "MODELO-DISTINTO" } };
    assert.equal(resolveKnowledgeEditorial(contradicted).short, null);
    assert.notEqual(prepareSourceProduct(contradicted).product.description, prepared.description);
  }
});

test("los textos y títulos firmados no atraviesan proveedor, condición ni unidad en una reconciliación", () => {
  const originals = [get("gam", "6971"), get("gam", "6689"), get("mercaeleva", "M294-4678")];
  for (const source of originals) {
    const signed = resolveKnowledgeEditorial(source, source);
    assert.equal(signed.identityOverride, true);
    assert.ok(signed.general || signed.short || signed.title);
    const prepared = prepareSourceProduct(source).product;
    if (signed.general) assert.equal(prepared.description_general, signed.general);
    if (signed.short) assert.equal(prepared.description, signed.short);
    const reconciled = { ...source, title: `${source.title ?? ""} reconciliado` };
    const recovered = resolveKnowledgeEditorial(reconciled, source);
    assert.equal(recovered.identityOverride, true);
    assert.equal(recovered.general, signed.general);
    assert.equal(recovered.short, signed.short);
    assert.equal(recovered.title, signed.title);
    const changed: readonly ProductRecord[] = [
      { ...reconciled, providerId: source.providerId === "gam" ? "gomariz" : "gam" },
      { ...reconciled, reference: `${source.reference}-OTRA` },
      { ...reconciled, reference: null },
      { ...reconciled, url: `${source.url}?otra-unidad=1` },
      { ...reconciled, condition: source.condition === "Nuevo" ? "Segunda mano" : "Nuevo" }
    ];
    for (const candidate of changed) {
      const actual = resolveKnowledgeEditorial(candidate, source);
      assert.equal(actual.identityOverride, false);
      assert.equal(actual.short, null);
      assert.equal(actual.general, null);
      assert.equal(actual.fallbackGeneral, null);
      assert.equal(actual.title, null);
    }
    const alteredSource = { ...source, specs: { ...source.specs, "Firma alterada": "no coincidente" } };
    assert.equal(resolveKnowledgeEditorial(reconciled, alteredSource).identityOverride, false);
  }
});
