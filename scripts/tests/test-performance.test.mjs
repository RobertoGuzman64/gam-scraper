import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { planTestLanes } from "../test-performance.mjs";
import assert from "node:assert/strict";
import test from "node:test";
import { recommendedTestConcurrency } from "../test-performance.mjs";

test("la concurrencia de tests no supera los procesadores disponibles", () => {
  assert.equal(recommendedTestConcurrency(1), 1);
  assert.equal(recommendedTestConcurrency(4), 4);
  assert.equal(recommendedTestConcurrency(8), 8);
});

test("la concurrencia conserva el límite superior para equipos grandes", () => {
  assert.equal(recommendedTestConcurrency(16), 12);
  assert.equal(recommendedTestConcurrency(32), 12);
});


test("la planificación mantiene el límite global y separa las suites intensivas", () => {
  const heavy = [
    "pipeline/publication/tests/individual-finish.test.js",
    "pipeline/publication/tests/individual-accreditation-session.test.js"
  ];
  const files = [...heavy.map((file) => `dist/${file}`), ...Array.from({ length: 24 }, (_, index) => `dist/test-${index}.test.js`)];
  const lanes = planTestLanes(files, 12, null, heavy);
  assert.equal(lanes.length, 2);
  assert.equal(lanes.reduce((total, lane) => total + lane.concurrency, 0), 12);
  assert.equal(lanes[0].concurrency, 4);
  assert.deepEqual(lanes[0].files, heavy.map((file) => `dist/${file}`));
  assert.deepEqual(new Set(lanes.flatMap((lane) => lane.files)), new Set(files));
  assert.deepEqual(planTestLanes(files, 4, null, heavy), [{ name: "general", files, concurrency: 4 }]);
  assert.deepEqual(planTestLanes([], 12, null, heavy), []);
});

test("las medidas reales determinan la cola y descartan prioridades históricas ya rápidas", () => {
  const files = Array.from({ length: 25 }, (_, index) => `dist/test-${index}.test.js`);
  const measured = new Map(files.map((name, index) => [name, index < 3 ? 24000 : 200]));
  const lanes = planTestLanes(files, 8, measured, ["test-24.test.js"]);
  assert.deepEqual(lanes[0].files, files.slice(0, 3));
  assert.equal(lanes[0].concurrency, 2);
  assert.equal(lanes[1].concurrency, 6);
  assert.ok(lanes[1].files.includes(files[24]));
});

test("los perfiles guardan las duraciones de distintas concurrencias y siguen leyendo el formato anterior", () => {
  const temporary = mkdtempSync(join(tmpdir(), "equipzilla-durations-"));
  try {
    const moduleUrl = new URL("../test-performance.mjs", import.meta.url).href;
    const command = `import { mkdirSync } from 'node:fs'; mkdirSync('dist');
      import { saveTestDurations, loadTestDurations } from ${JSON.stringify(moduleUrl)};
      saveTestDurations(4, [{file: 'dist/slow.test.js', milliseconds: 12000}]);
      saveTestDurations(12, [{file: 'dist/slow.test.js', milliseconds: 17000}]);
      saveTestDurations(8, [{file: 'dist/slow.test.js', milliseconds: 15000}]);
      if (loadTestDurations(4)?.get('dist/slow.test.js') !== 12000 ||
          loadTestDurations(12)?.get('dist/slow.test.js') !== 17000 ||
          loadTestDurations(8)?.get('dist/slow.test.js') !== 15000) process.exitCode = 1;`;
    const execution = spawnSync(process.execPath, ["--input-type=module", "--eval", command],
      { cwd: temporary, encoding: "utf8" });
    assert.equal(execution.status, 0, `${execution.stdout}${execution.stderr}`);
    const profile = JSON.parse(readFileSync(join(temporary, "dist", ".test-runner-durations.json"), "utf8"));
    assert.deepEqual(Object.keys(profile.profiles).sort(), ["12", "4", "8"]);
    assert.equal(profile.durations["dist/slow.test.js"], 15000);
  } finally {
    rmSync(temporary, { recursive: true, force: true });
  }
});
