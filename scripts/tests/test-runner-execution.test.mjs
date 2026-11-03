import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { executeTestLanes } from "../test-runner-execution.mjs";

const runScenario = (files, concurrency) => {
  const root = mkdtempSync(join(tmpdir(), "eqt-execution-"));
  try {
    for (const [name, content] of files) writeFileSync(join(root, name), content);
    const executionModule = new URL("../test-runner-execution.mjs", import.meta.url).href;
    const runner = `import { executeTestLanes } from ${JSON.stringify(executionModule)};
` +
      `const received = []; const summaries = []; const finished = [];
` +
      `await executeTestLanes([{name: 'general', files: ${JSON.stringify(files.map(([name]) => join(root, name)))}, concurrency: ${concurrency}}], (event) => {
` +
      `if (event.type === 'test:summary' && event.data.file) received.push(event.data.file);
` +
      `if (event.type === 'test:summary' && !event.data.file) summaries.push(event.data.success);
` +
      `}, (lane) => finished.push(lane));
` +
      `process.stdout.write(JSON.stringify({received, summaries, finished}));
`;
    writeFileSync(join(root, "runner.mjs"), runner);
    const env = { ...process.env };
    delete env.NODE_TEST_CONTEXT;
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

test("concurrencia uno conserva orden y los fallos de aserción no detienen la cola", () => {
  const result = runScenario([
    ["first.test.mjs", 'import test from "node:test"; test("fallida", () => { throw new Error("error esperado"); });\n'],
    ["second.test.mjs", 'import test from "node:test"; test("correcta", () => {});\n']
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
