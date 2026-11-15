import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { loadEditorialKnowledge } from "../../../../infrastructure/filesystem/editorial/knowledge.js";
import { selectUnitKnowledge } from "../domain/editorial-knowledge.js";

const read = (path: string): unknown => JSON.parse(readFileSync(path, "utf8"));
const recordOf = (value: unknown): Readonly<Record<string, unknown>> | null =>
  typeof value === "object" && value !== null && !Array.isArray(value) ?
    Object.fromEntries(Object.entries(value)) : null;
const requiredRecord = (value: unknown): Readonly<Record<string, unknown>> => {
  const record = recordOf(value);
  assert.ok(record);
  return record;
};
const requiredString = (value: unknown): string => {
  assert.equal(typeof value, "string");
  if (typeof value !== "string") throw new Error("Cadena histórica inválida");
  return value;
};

const legacy = "data/editorial/evidence/legacy/mercaeleva/priority-platform-generals.json";

test("la fuente histórica de plataformas conserva sus cinco firmas y sus referencias de fabricante sin promover metadatos", () => {
  const inventory = requiredRecord(read("data/editorial/legacy-evidence-extraction.json"));
  assert.ok(Array.isArray(inventory.sources));
  const origins = inventory.sources.map(requiredRecord);
  const source = origins.find((entry) => entry.source === "src/preparation/mercaeleva/editorial/evidence/priority-platform-generals.ts");
  assert.ok(source);
  assert.ok(Array.isArray(source.rejected));
  assert.deepEqual(source.rejected.map(requiredRecord).map((entry) => ({
    symbol: entry.symbol, reason: entry.reason
  })), [{ symbol: "priorityPlatformManufacturerSources", reason: "unsupported expr: 80" }]);

  const archive = requiredRecord(read(legacy));
  const exports = requiredRecord(archive.exports);
  const records = requiredRecord(exports.verifiedPriorityPlatformGeneral);
  assert.equal(Object.keys(records).length, 5);
  const knowledge = loadEditorialKnowledge();
  for (const [reference, value] of Object.entries(records)) {
    const item = requiredRecord(value);
    const original = requiredRecord(item.source);
    const url = requiredString(item.sourceUrl);
    const digest = requiredString(item.sourceDigest);
    const general = requiredString(item.general);
    const manufacturer = requiredString(item.manufacturerSource);
    assert.match(manufacturer, /^https:\/\//u);
    assert.notEqual(manufacturer, url);
    assert.equal(item.usage, "fallback");
    const key = `mercaeleva:${reference}`;
    const matching = knowledge.units.get(key)?.filter((entry) => entry.evidenceSource === legacy) ?? [];
    assert.equal(matching.length, 1, key);
    assert.equal(matching[0]?.general, general);
    assert.equal(matching[0]?.sourceUrl, url);
    assert.equal(matching[0]?.sourceDigest, digest);
    const identity = { key, sourceUrl: url, brand: requiredString(original.brand), model: requiredString(original.model) };
    assert.equal(selectUnitKnowledge(identity, knowledge, digest).fallbackGeneral === general ||
      selectUnitKnowledge(identity, knowledge, digest).general === general, true, key);
    for (const changed of [
      { ...identity, key: `mercaeleva:${reference}-OTRA` },
      { ...identity, sourceUrl: `${url}?unidad=otra` },
      { ...identity, model: `${identity.model}-VARIANTE` },
      { ...identity, key: `gomariz:${reference}` }
    ]) {
      assert.equal(selectUnitKnowledge(changed, knowledge, digest).fallbackGeneral, null);
      assert.equal(selectUnitKnowledge(changed, knowledge, digest).general, null);
    }
    assert.equal(selectUnitKnowledge(identity, knowledge, `${digest.slice(0, -1)}${digest.at(-1) === "a" ? "b" : "a"}`).fallbackGeneral, null);
  }
});

test("los once descartes históricos mantienen ocho identidades rechazadas y ninguna firma se reincorpora", () => {
  const report = requiredRecord(read("data/editorial/knowledge/migration-report.json"));
  assert.equal(report.skippedEntries, 11);
  assert.ok(Array.isArray(report.skipped));
  const skipped = report.skipped.map(requiredRecord);
  assert.equal(skipped.length, 11);
  const expected = new Set([
    "gomariz:GR1113", "gomariz:RO1197", "gomariz:CAE1054", "gomariz:5051BDX",
    "gomariz:BA1262", "gomariz:1011JFB", "mercaeleva:EPL185", "mercaeleva:EFL303"
  ]);
  assert.deepEqual(new Set(skipped.map((item) => requiredString(item.key))), expected);
  const knowledge = loadEditorialKnowledge();
  for (const entry of skipped) {
    const key = requiredString(entry.key);
    const source = requiredString(entry.source);
    assert.equal(entry.reason, "procedencia_insuficiente_o_no_coincidente");
    assert.equal(knowledge.units.has(key), false, key);
    const payload = requiredRecord(read(source));
    const exports = requiredRecord(payload.exports);
    const archived = Object.values(exports).some((value) => {
      const records = recordOf(value);
      return records !== null && Object.keys(records).some((id) => id === key || key.endsWith(`:${id}`));
    });
    assert.equal(archived, true, `${key}: ${source}`);
  }
});
