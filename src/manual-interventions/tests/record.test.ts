import assert from "node:assert/strict";
import test from "node:test";
import { parseAppliedInterventionRecord } from "../record.js";

const proposal = {
  providerId: "gam", identity: "gam:ref:6002", field: "brand", expected: "YALE", next: "HYSTER",
  reason: "Marca acreditada", evidence: "https://proveedor.example/6002"
};
const legacy = {
  version: 1, status: "applied", campaign: "lote-actual", appliedAt: "2026-10-26T12:00:00.000Z",
  providerId: "gam", sourceCatalogSha256: "a".repeat(64), planSha256: "b".repeat(64),
  derivedCatalogSha256: "c".repeat(64), analyzedProducts: 3, affectedProducts: 1,
  changes: [proposal], scripts: ["correcciones-gam.ts"]
};
const versioned = {
  ...legacy, version: 2, scripts: ["6002.ts"],
  scriptVersions: [{ id: "gam-6002", script: "interventions/gam/6002.ts", sha256: "d".repeat(64) }]
};

test("expedientes: mantiene lectura íntegra del formato anterior", () => {
  assert.deepEqual(parseAppliedInterventionRecord(legacy), legacy);
  const { scripts: _scripts, ...withoutScripts } = legacy;
  assert.deepEqual(parseAppliedInterventionRecord(withoutScripts), withoutScripts);
});

test("expedientes: versión 2 conserva identidad, ruta y SHA y rechaza procedencia alterada", () => {
  assert.deepEqual(parseAppliedInterventionRecord(versioned), versioned);
  const altered = [
    { ...versioned, scriptVersions: [] },
    { ...versioned, scriptVersions: [{ ...versioned.scriptVersions[0], sha256: "invalida" }] },
    { ...versioned, scriptVersions: [{ ...versioned.scriptVersions[0], id: "gomariz-6002" }] },
    { ...versioned, scriptVersions: [{ ...versioned.scriptVersions[0], script: "interventions/gomariz/6002.ts" }] },
    { ...versioned, scriptVersions: [{ ...versioned.scriptVersions[0], script: "../6002.ts" }] },
    { ...versioned, scriptVersions: [{ ...versioned.scriptVersions[0], script: "interventions/gam/otro.ts" }] },
    { ...versioned, scriptVersions: [...versioned.scriptVersions, ...versioned.scriptVersions] },
    { ...legacy, scriptVersions: versioned.scriptVersions }
  ];
  for (const record of altered) {
    assert.throws(() => parseAppliedInterventionRecord(record), /Expediente de intervención inválido/);
  }
});
