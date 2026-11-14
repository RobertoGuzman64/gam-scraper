import assert from "node:assert/strict";
import test from "node:test";
import { accreditedSourceSamples } from "../../../../testing/domain-cases/accredited-source-samples.js";
import type { ProductRecord } from "../../../../contracts/catalog.js";
import { editorialSourceDigest, loadEditorialKnowledge } from "../../../../infrastructure/filesystem/editorial/knowledge.js";
import { prepareSourceProduct } from "../../../prepare-product.js";
import { selectUnitKnowledge } from "../domain/editorial-knowledge.js";
import { resolveKnowledgeEditorial } from "../mapping/knowledge-editorial.js";

const providers = ["gam", "gomariz", "mercaeleva"] as const;

const originals = (provider: typeof providers[number]): readonly ProductRecord[] =>
  accreditedSourceSamples(`${provider}-original`);

const identity = (record: ProductRecord) => ({
  key: `${record.providerId}:${record.reference ?? ""}`,
  sourceUrl: record.url,
  brand: record.brand ?? "",
  model: record.model ?? ""
});

const empty = { short: null, general: null, fallbackGeneral: null, title: null };

test("las firmas indexadas de los tres proveedores seleccionan por campo y unidad original íntegra", () => {
  const knowledge = loadEditorialKnowledge();
  const totals = { gam: 0, gomariz: 0, mercaeleva: 0 };
  let multipleEntries = 0;
  let scanned = 0;
  for (const provider of providers) {
    for (const record of originals(provider)) {
      scanned++;
      if (!record.reference) continue;
      const entries = knowledge.units.get(identity(record).key) ?? [];
      const digest = editorialSourceDigest(record);
      const matched = entries.filter((entry) => entry.sourceUrl === record.url && entry.sourceDigest === digest &&
        entry.brand.normalize("NFD").toLocaleLowerCase("es") === (record.brand ?? "").normalize("NFD").toLocaleLowerCase("es") &&
        entry.model.normalize("NFD").toLocaleLowerCase("es") === (record.model ?? "").normalize("NFD").toLocaleLowerCase("es"));
      const selected = selectUnitKnowledge(identity(record), knowledge, digest);
      if (matched.length === 0) {
        assert.deepEqual(selected, empty, `${provider}:${record.reference}`);
        continue;
      }
      totals[provider]++;
      if (matched.length > 1) multipleEntries++;
      assert.deepEqual(selected, {
        short: matched.find((entry) => entry.short?.trim())?.short ?? null,
        general: matched.find((entry) => entry.usage !== "fallback" && entry.general?.trim())?.general ?? null,
        fallbackGeneral: matched.find((entry) => entry.usage === "fallback" && entry.general?.trim())?.general ?? null,
        title: matched.find((entry) => entry.title?.trim())?.title ?? null
      }, `${provider}:${record.reference}`);
      const mapped = resolveKnowledgeEditorial(record, record);
      assert.equal(mapped.short, selected.short, `${provider}:${record.reference}:short`);
      assert.equal(mapped.general, selected.general, `${provider}:${record.reference}:general`);
      assert.equal(mapped.fallbackGeneral, selected.fallbackGeneral, `${provider}:${record.reference}:fallback`);
      assert.equal(mapped.title, selected.title, `${provider}:${record.reference}:title`);
    }
  }
  assert.equal(scanned, 767);
  assert.ok(totals.gam > 0);
  assert.ok(totals.gomariz > 0);
  assert.ok(totals.mercaeleva > 0);
  assert.ok(multipleEntries > 0);
});

test("la firma no se conserva al mutar identidad, origen o contenido técnico de la unidad", () => {
  const knowledge = loadEditorialKnowledge();
  for (const [provider, reference] of [
    ["gam", "6689"], ["gomariz", "TE1618"], ["mercaeleva", "M940-4770"]
  ] as const) {
    const source = originals(provider).find((record) => record.reference === reference);
    assert.ok(source);
    const original = JSON.stringify(source);
    const selected = selectUnitKnowledge(identity(source), knowledge, editorialSourceDigest(source));
    assert.ok(selected.short || selected.general || selected.title);
    for (const changed of [
      { ...source, providerId: `${source.providerId}-otro` },
      { ...source, reference: `${reference}-otra` },
      { ...source, url: `${source.url}?cambio=1` },
      { ...source, brand: `${source.brand}-OTRA` },
      { ...source, model: `${source.model}-VARIANTE` },
      { ...source, condition: source.condition === "Nuevo" ? "Segunda mano" as const : "Nuevo" as const },
      { ...source, title: `${source.title} revisado` },
      { ...source, specs: { ...source.specs, "Dato incompatible": "no acreditado" } },
      { ...source, longDescription: `${source.longDescription ?? ""} Texto añadido sin firmar.` }
    ]) {
      assert.deepEqual(selectUnitKnowledge(identity(changed), knowledge, editorialSourceDigest(changed)), empty);
      const result = resolveKnowledgeEditorial(changed, changed);
      assert.equal(result.short, null);
      assert.equal(result.general, null);
      assert.equal(result.fallbackGeneral, null);
      assert.equal(result.title, null);
    }
    assert.equal(JSON.stringify(source), original);
  }
});

test("corta y general de firmas distintas se conservan juntas y no se transfieren a otra unidad", () => {
  for (const [provider, reference] of [["gam", "6689"], ["mercaeleva", "M940-4770"]] as const) {
    const source = originals(provider).find((record) => record.reference === reference);
    assert.ok(source);
    const knowledge = loadEditorialKnowledge();
    const entries = knowledge.units.get(identity(source).key) ?? [];
    const matching = entries.filter((entry) => entry.sourceDigest === editorialSourceDigest(source) && entry.sourceUrl === source.url);
    assert.ok(matching.some((entry) => entry.short && !entry.general));
    assert.ok(matching.some((entry) => entry.general && !entry.short));
    const selected = selectUnitKnowledge(identity(source), knowledge, editorialSourceDigest(source));
    assert.ok(selected.short);
    assert.ok(selected.general);
    const prepared = prepareSourceProduct(source).product;
    assert.equal(prepared.description, selected.short);
    assert.equal(prepared.description_general, selected.general);
    const next = { ...source, reference: `${reference}-NUEVA`, url: `${source.url}?unidad=nueva` };
    const nextSelected = resolveKnowledgeEditorial(next, next);
    assert.equal(nextSelected.short, null);
    assert.equal(nextSelected.general, null);
    assert.notEqual(prepareSourceProduct(next).product.description_general, selected.general);
  }
});
