import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { createLaneScheduler, executeTestLanes } from "../test-runner-execution.mjs";

const runScenario = (files, concurrency, split) => {
  const root = mkdtempSync(join(tmpdir(), "eqt-execution-"));
  try {
    for (const [name, content] of files) writeFileSync(join(root, name), content);
    const executionModule = new URL("../test-runner-execution.mjs", import.meta.url).href;
    const paths = files.map(([name]) => join(root, name));
    const lanes = split === undefined ? [{ name: "general", files: paths, concurrency }] : [
      { name: "intensiva", files: paths.slice(0, split.files), concurrency: split.concurrency, maxConcurrency: split.maxConcurrency },
      { name: "general", files: paths.slice(split.files), concurrency: concurrency - split.concurrency }
    ];
    const runner = `import { executeTestLanes } from ${JSON.stringify(executionModule)};
` +
      `const received = []; const summaries = []; const finished = []; const trace = [];
` +
      `await executeTestLanes(${JSON.stringify(lanes)}, (event, lane) => {
` +
      `if (event.type === 'runner:dispatch') trace.push({type: "dispatch", file: event.data.file, lane});
` +
      `if (event.type === 'test:summary' && event.data.file) { received.push(event.data.file); trace.push({type: "report", file: event.data.file, lane, success: event.data.success}); }
` +
      `if (event.type === 'test:summary' && !event.data.file) summaries.push(event.data.success);
` +
      `}, (lane) => { finished.push(lane); trace.push({type: "finish", lane}); });
` +
      `process.stdout.write(JSON.stringify({received, summaries, finished, trace}));
`;
    writeFileSync(join(root, "runner.mjs"), runner);
    const env = { ...process.env };
    delete env.NODE_TEST_CONTEXT;
    delete env.EQT_RUNNER_ISOLATION_PROBE;
    const result = spawnSync(process.execPath, [join(root, "runner.mjs")], { encoding: "utf8", env });
    assert.equal(result.status, 0, `${result.stdout}${result.stderr}`);
    return { ...JSON.parse(result.stdout), stderr: result.stderr };
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
};

test("distribuye archivos independientes y recibe el rápido antes de que termine el lento", () => {
  const result = runScenario([
    ["a-slow.test.mjs", 'import test from "node:test"; test("lenta", async () => { await new Promise((resolve) => setTimeout(resolve, 1100)); });\n'],
    ["b-fast.test.mjs", 'import test from "node:test"; test("rápida", () => {});\n']
  ], 2);
  assert.match(result.received[0], /b-fast\.test\.mjs$/);
  assert.match(result.received[1], /a-slow\.test\.mjs$/);
  assert.deepEqual(result.finished, ["general"]);
});

test("concurrencia uno conserva orden, aislamiento y continuidad tras un fallo", () => {
  const result = runScenario([
    ["first.test.mjs", 'import test from "node:test"; test("fallida", () => { process.env.EQT_RUNNER_ISOLATION_PROBE = "first"; throw new Error("error esperado"); });\n'],
    ["second.test.mjs", 'import assert from "node:assert/strict"; import test from "node:test"; test("correcta", () => { assert.equal(process.env.EQT_RUNNER_ISOLATION_PROBE, undefined); });\n']
  ], 1);
  assert.match(result.received[0], /first\.test\.mjs$/);
  assert.match(result.received[1], /second\.test\.mjs$/);
  assert.deepEqual(result.summaries, [false, true]);
});

test("distribuye concurrencia alta entre ejecutores sin acumular listeners de process", () => {
  const files = Array.from({ length: 16 }, (_, index) => [
    `parallel-${index}.test.mjs`,
    `import test from "node:test"; test("parallel-${index}", async () => { await new Promise((resolve) => setTimeout(resolve, 250)); });\n`
  ]);
  const result = runScenario(files, 12);
  assert.equal(result.received.length, files.length);
  assert.equal(result.summaries.length, files.length);
  assert.ok(result.summaries.every(Boolean));
  assert.doesNotMatch(result.stderr, /MaxListenersExceededWarning/);
  assert.deepEqual(result.finished, ["general"]);
});

test("un error al consumir resultados termina el ejecutor y propaga el fallo", async () => {
  const root = mkdtempSync(join(tmpdir(), "eqt-consumer-"));
  try {
    const file = join(root, "falla-consumidor.test.mjs");
    writeFileSync(file, 'import test from "node:test"; test("válida", () => {});\n');
    const finished = [];
    await assert.rejects(
      executeTestLanes([{ name: "general", files: [file], concurrency: 1 }], () => {
        throw new Error("consumidor interrumpido");
      }, (lane) => finished.push(lane)),
      /consumidor interrumpido/
    );
    assert.deepEqual(finished, ["general"]);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

const fast = 'import test from "node:test"; test("rápida", () => {});';
const isolated = 'import test from "node:test"; test("aislada", () => { process.env.EQT_RUNNER_ISOLATION_PROBE = "heavy"; });';
const failure = 'import test from "node:test"; test("fallida", () => { throw new Error("error esperado"); });';
const independent = 'import assert from "node:assert/strict"; import test from "node:test"; test("independiente", () => { assert.equal(process.env.EQT_RUNNER_ISOLATION_PROBE, undefined); });';

const verifyReports = (result, files, concurrency, intensiveLimit) => {
  const active = new Map();
  const dispatched = new Set();
  const failed = new Set(files.filter(([name]) => name.includes("failure")).map(([name]) => name));
  const names = new Set(files.map(([name]) => name));
  for (const event of result.trace) {
    if (event.type === "dispatch") {
      assert.ok(names.has(event.file.split(/[\\/]/).at(-1)));
      assert.ok(!dispatched.has(event.file));
      dispatched.add(event.file);
      active.set(event.file, event.lane);
      assert.ok(active.size <= concurrency);
      assert.ok([...active.values()].filter((lane) => lane === "intensiva").length <= intensiveLimit);
      assert.equal(event.lane, event.file.split(/[\\/]/).at(-1).startsWith("heavy-") ? "intensiva" : "general");
    } else if (event.type === "report") {
      assert.equal(active.get(event.file), event.lane);
      assert.equal(event.success, !failed.has(event.file.split(/[\\/]/).at(-1)));
      active.delete(event.file);
    } else {
      assert.ok(![...active.values()].includes(event.lane));
    }
  }
  assert.equal(active.size, 0);
  assert.equal(dispatched.size, files.length);
  assert.equal(new Set(result.received).size, files.length);
  assert.equal(result.received.length, files.length);
  assert.equal(result.summaries.filter(Boolean).length, files.length - failed.size);
  assert.equal(result.summaries.filter((success) => !success).length, failed.size);
  assert.doesNotMatch(result.stderr, /MaxListenersExceededWarning/);
};

test("los ejecutores reales conservan identidad, aislamiento, informes fallidos y límites en ambas colas", () => {
  const files = [["heavy-1.test.mjs", fast], ["heavy-2.test.mjs", isolated], ["heavy-3.test.mjs", independent],
    ["general-1.test.mjs", fast], ["general-failure.test.mjs", failure], ["general-3.test.mjs", independent]];
  const result = runScenario(files, 3, { files: 3, concurrency: 1, maxConcurrency: 2 });
  verifyReports(result, files, 3, 2);
  assert.deepEqual([...result.finished].sort(), ["general", "intensiva"]);
});

test("la capacidad intensiva libre toma pendientes generales sin esperar a otro informe", () => {
  const finished = [];
  const scheduler = createLaneScheduler([
    { name: "intensiva", files: ["h1", "h2"], concurrency: 1, maxConcurrency: 1 },
    { name: "general", files: ["g1", "g2", "g3"], concurrency: 1 }
  ], (name) => finished.push(name));
  assert.deepEqual(scheduler.takeJob("intensiva"), { file: "h1", laneName: "intensiva" });
  assert.deepEqual(scheduler.takeJob("general"), { file: "g1", laneName: "general" });
  assert.equal(scheduler.takeJob("general"), null);
  scheduler.completeJob("intensiva");
  assert.deepEqual(scheduler.takeJob("intensiva"), { file: "h2", laneName: "intensiva" });
  scheduler.completeJob("intensiva");
  assert.deepEqual(finished, ["intensiva"]);
  assert.deepEqual(scheduler.takeJob("intensiva"), { file: "g2", laneName: "general" });
  assert.equal(scheduler.takeJob("general"), null);
  scheduler.completeJob("general");
  assert.deepEqual(scheduler.takeJob("general"), { file: "g3", laneName: "general" });
  scheduler.completeJob("general");
  assert.deepEqual(finished, ["intensiva"]);
  scheduler.completeJob("general");
  scheduler.assertComplete();
  assert.deepEqual(finished, ["intensiva", "general"]);
});

test("la cola general cede plazas solo al agotar sus pendientes y hasta el máximo intensivo autorizado", () => {
  const finished = [];
  const scheduler = createLaneScheduler([
    { name: "intensiva", files: ["h1", "h2", "h3", "h4", "h5"], concurrency: 1, maxConcurrency: 2 },
    { name: "general", files: ["g1", "g2", "g3"], concurrency: 2 }
  ], (name) => finished.push(name));
  assert.equal(scheduler.takeJob("intensiva").file, "h1");
  assert.equal(scheduler.takeJob("general").file, "g1");
  assert.equal(scheduler.takeJob("general").file, "g2");
  scheduler.completeJob("general");
  assert.deepEqual(scheduler.takeJob("general"), { file: "g3", laneName: "general" });
  scheduler.completeJob("general");
  assert.deepEqual(scheduler.takeJob("general"), { file: "h2", laneName: "intensiva" });
  scheduler.completeJob("general");
  assert.deepEqual(finished, ["general"]);
  assert.equal(scheduler.takeJob("general"), null);
  scheduler.completeJob("intensiva");
  assert.deepEqual(scheduler.takeJob("general"), { file: "h3", laneName: "intensiva" });
  scheduler.completeJob("intensiva");
  assert.equal(scheduler.takeJob("intensiva").file, "h4");
  scheduler.completeJob("intensiva");
  assert.equal(scheduler.takeJob("general").file, "h5");
  scheduler.completeJob("intensiva");
  scheduler.completeJob("intensiva");
  scheduler.assertComplete();
  assert.deepEqual(finished, ["general", "intensiva"]);
});

test("los ejecutores de una misma cola comparten pendientes sin depender de su reparto inicial", () => {
  const finished = [];
  const files = Array.from({ length: 11 }, (_, index) => `shared-${index}`);
  const scheduler = createLaneScheduler([{ name: "general", files, concurrency: 9 }], (name) => finished.push(name));
  const first = Array.from({ length: 8 }, () => scheduler.takeJob("general").file);
  assert.deepEqual(first, files.slice(0, 8));
  assert.equal(scheduler.takeJob("general").file, files[8]);
  assert.equal(scheduler.takeJob("general"), null);
  scheduler.completeJob("general");
  assert.equal(scheduler.takeJob("general").file, files[9]);
  scheduler.completeJob("general");
  assert.equal(scheduler.takeJob("general").file, files[10]);
  scheduler.completeJob("general");
  assert.deepEqual(finished, []);
  for (const _ of first) scheduler.completeJob("general");
  scheduler.assertComplete();
  assert.deepEqual(finished, ["general"]);
});
