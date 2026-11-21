import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { before, test } from "node:test";
import { fileURLToPath } from "node:url";
import { readPortableOriginal } from "../../../infrastructure/filesystem/catalog/portable-original.js";
import { recoverGamStabilizedTechnicalSpecs } from "../../../preparation/gam/technical/gam-technical-recovery.js";
import { exactAddedKeys, inspectSpecProvenance } from "../spec-provenance-inspection.js";
import type { SpecProvenanceInspection } from "../spec-provenance-inspection.js";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../../../..");
let report: SpecProvenanceInspection;

before(async () => { report = await inspectSpecProvenance(root); });

test("mide las 2898 incorporaciones históricas con clasificación exclusiva del motor", () => {
  assert.deepEqual(report.totals, {
    additions: 2898, own: 1840, reused: 334, pending: 724, reproduced: 2838,
    classifiedReproduced: 2124, pendingReproduced: 714, notReproduced: 60,
    gamRecovery: 1590, documentedRecovery: 1081, originalYear: 167
  });
  assert.equal(report.classificationChanged, false);
  assert.equal(report.mode, "solo-lectura");
  assert.equal(report.candidates.length, report.totals.additions);
});

test("separa proveedores y distingue las rutas de reproducción sin solapamientos", () => {
  assert.deepEqual(report.providers.map((provider) => ({
    providerId: provider.providerId, additions: provider.totals.additions,
    reproduced: provider.totals.reproduced, notReproduced: provider.totals.notReproduced
  })), [
    { providerId: "gam", additions: 1990, reproduced: 1935, notReproduced: 55 },
    { providerId: "gomariz", additions: 167, reproduced: 167, notReproduced: 0 },
    { providerId: "mercaeleva", additions: 741, reproduced: 736, notReproduced: 5 }
  ]);
  assert.equal(report.candidates.filter((item) => item.currentKind === "pending" &&
    item.mechanisms.length === 1 && item.mechanisms[0] === "documentedRecovery").length, 702);
  assert.equal(report.candidates.filter((item) => item.mechanisms.length > 1).length, 0);
});

test("exige identidad de campo y valor sin atribuir aplicación histórica", () => {
  const identities = new Set<string>();
  for (const item of report.candidates) {
    const identity = JSON.stringify([item.providerId, item.reference, item.sourceUrl, item.field]);
    assert.ok(!identities.has(identity), identity);
    identities.add(identity);
    assert.equal(item.historicalApplication, "not-demonstrated");
    if (item.sourceKindProof === "original-field-compatible") {
      assert.ok(item.mechanisms.includes("gamRecovery") || item.mechanisms.includes("originalYear"));
      assert.ok(item.reason === "verified-original-field-source-compatible" ||
        item.reason === "verified-original-year-source-compatible");
    }
    assert.equal(item.reproduction === "exact", item.mechanisms.length > 0);
    if (item.currentKind === "pending") {
      assert.ok([
        "documented-value-matches-source-scope-not-proven",
        "not-reproduced-by-inspected-mechanisms",
        "verified-original-field-source-compatible",
        "exact-value-match-not-historical-provenance"
      ].includes(item.reason));
    }
  }
  assert.equal(report.candidates.filter((item) => item.reproduction === "not-reproduced" &&
    item.currentKind === "own").length, 50);
  assert.equal(report.candidates.filter((item) => item.sourceKindProof === "original-field-compatible").length, 1068);
  assert.equal(report.candidates.filter((item) => item.sourceKindProof === "original-field-compatible" &&
    item.providerId === "gam").length, 901);
  assert.equal(report.candidates.filter((item) => item.sourceKindProof === "original-field-compatible" &&
    item.providerId === "gomariz").length, 167);
});

test("descarta valores distintos y no confunde un campo conservado con una incorporación", async () => {
  const item = report.candidates.find((candidate) => candidate.mechanisms.includes("gamRecovery"));
  assert.ok(item);
  const catalog = await readPortableOriginal(root, "gam");
  const original = catalog.products.find((record) => record.reference === item.reference && record.url === item.sourceUrl);
  assert.ok(original);
  const input = original.specs ?? {};
  const output = recoverGamStabilizedTechnicalSpecs(original, original);
  const additions = exactAddedKeys(input, output);
  assert.ok(additions.has(JSON.stringify([item.field, item.value])));
  assert.ok(!additions.has(JSON.stringify([item.field, `${item.value} (otro valor)`])));
  assert.equal(exactAddedKeys(input, input).size, 0);
});

test("no modifica originales, publicaciones ni el HTML autónomo durante la inspección", async () => {
  const paths = ["panel/index.html",
    ...report.providers.flatMap((provider) => [provider.originalPath, provider.publicationPath])];
  const hashes = async (): Promise<readonly string[]> => Promise.all(paths.map(async (path) =>
    createHash("sha256").update(await readFile(join(root, path))).digest("hex")));
  const before = await hashes();
  await inspectSpecProvenance(root);
  assert.deepEqual(await hashes(), before);
});
