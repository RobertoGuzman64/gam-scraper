import assert from "node:assert/strict";
import test from "node:test";
import { planRetentionSimulation, type RetentionVersion } from "../simulation.js";

const version = (id: string, timestamp: number, group = "gam:origen", blockers: readonly string[] = []): RetentionVersion => ({
  id, group, timestamp, members: [`${id}-preparation.json`, `${id}-diagnostics.json`, `${id}-preparation.manifest.json`],
  bytes: 200, blockers
});

test("conserva dos versiones por origen y simula excedentes por conjuntos", () => {
  const result = planRetentionSimulation([
    version("v1", 100), version("v3", 300), version("v2", 200), version("g1", 50, "gomariz:otro")
  ]);
  assert.equal(result.kept, 3);
  assert.equal(result.candidates, 1);
  assert.equal(result.candidateFiles, 3);
  assert.equal(result.candidateBytes, 200);
  assert.equal(result.actualDeletions, 0);
  assert.deepEqual(result.versions.filter((item) => item.action === "candidato").map((item) => item.id), ["v1"]);
});

test("un conjunto referenciado queda protegido aunque exceda la cuota", () => {
  const result = planRetentionSimulation([version("v1", 100, "gam:origen", ["Referenciado"]), version("v2", 200), version("v3", 300)]);
  assert.equal(result.protected, 1);
  assert.equal(result.candidates, 0);
  assert.equal(result.kept, 2);
});

test("versiones incompletas o con fecha/identidad dudosa no son candidatas", () => {
  const result = planRetentionSimulation([version("v1", 100, "gam:origen", ["Manifest incompleto"]),
    { ...version("v2", 200), group: null }, { ...version("v3", 300), timestamp: null }]);
  assert.equal(result.protected, 3);
  assert.equal(result.candidates, 0);
});

test("fechas ambiguas bloquean el grupo completo para no decidir por nombre", () => {
  const result = planRetentionSimulation([version("v1", 100), version("v2", 100), version("v3", 300), version("v4", 400)]);
  assert.equal(result.protected, 4);
  assert.equal(result.candidates, 0);
});

test("el orden de exploración no influye en la simulación", () => {
  const versions = [version("v1", 100), version("v2", 200), version("v3", 300), version("v4", 400)];
  assert.deepEqual(planRetentionSimulation(versions), planRetentionSimulation([...versions].reverse()));
});

test("identidades duplicadas y cuota inválida se rechazan", () => {
  assert.throws(() => planRetentionSimulation([version("v1", 100), version("v1", 200)]), /duplicadas/);
  assert.throws(() => planRetentionSimulation([], 0), /Cuota/);
});
