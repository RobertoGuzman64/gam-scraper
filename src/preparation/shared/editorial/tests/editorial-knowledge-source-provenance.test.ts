import assert from "node:assert/strict";
import test from "node:test";
import { accreditedSourceRecord } from "../../../../testing/domain-cases/accredited-source-samples.js";
import { editorialSourceDigest, loadEditorialKnowledge } from "../../../../infrastructure/filesystem/editorial/knowledge.js";
import { selectUnitKnowledge } from "../domain/editorial-knowledge.js";

const references = ["M572-8190", "M205-2951", "M178-6194", "M005-4474", "M030-7485"] as const;

test("cinco unidades conservan procedencia documental sin compartirla con variantes", () => {
  const knowledge = loadEditorialKnowledge();
  for (const reference of references) {
    const record = accreditedSourceRecord("mercaeleva-original", reference);
    const key = `mercaeleva:${reference}`;
    const matching = knowledge.units.get(key) ?? [];
    const item = matching.find((entry) => entry.usage === "fallback");
    assert.ok(item?.general);
    assert.ok(item.manufacturerSource?.startsWith("https://"));
    assert.notEqual(item.manufacturerSource, record.url);
    const identity = { key, sourceUrl: record.url, brand: record.brand ?? "", model: record.model ?? "" };
    const digest = editorialSourceDigest(record);
    assert.equal(item.sourceDigest, digest);
    assert.equal(selectUnitKnowledge(identity, knowledge, digest).fallbackGeneral, item.general);
    for (const changed of [
      { ...identity, key: `${key}-OTRA` },
      { ...identity, sourceUrl: `${identity.sourceUrl}?unidad=otra` },
      { ...identity, model: `${identity.model}-VARIANTE` },
      { ...identity, key: `gomariz:${reference}` }
    ]) {
      assert.equal(selectUnitKnowledge(changed, knowledge, digest).fallbackGeneral, null);
    }
    assert.equal(selectUnitKnowledge(identity, knowledge, `${digest.slice(0, -1)}${digest.at(-1) === "a" ? "b" : "a"}`).fallbackGeneral, null);
  }
});

test("el índice no admite conocimiento sin procedencia acreditada", () => {
  const knowledge = loadEditorialKnowledge();
  const rejected = ["gomariz:GR1113", "gomariz:RO1197", "gomariz:CAE1054", "gomariz:5051BDX",
    "gomariz:BA1262", "gomariz:1011JFB", "mercaeleva:EPL185", "mercaeleva:EFL303"] as const;
  for (const key of rejected) assert.equal(knowledge.units.has(key), false, key);
});
