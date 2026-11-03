import assert from "node:assert/strict";
import test from "node:test";
import { resolve } from "node:path";
import { createRunnerTimeline } from "../test-runner-observability.mjs";

const a = "dist/suite-a.test.js";
const b = "dist/suite-b.test.js";
const c = "dist/suite-c.test.js";
const lanes = [
  { name: "intensiva", files: [a], concurrency: 1 },
  { name: "general", files: [b], concurrency: 2 }
];

test("separa suites iniciadas de informes recibidos y de archivos reutilizados", () => {
  let time = 0;
  const timeline = createRunnerTimeline([a, b, c], [c], lanes, () => time);
  assert.deepEqual({ ...timeline.progress(), oldest_without_report: [] }, {
    total: 3, reused: 1, started: 0, reported: 1, not_started: 2,
    without_report: 0, remaining: 2, oldest_without_report: []
  });
  time = 10;
  timeline.register({ type: "test:dequeue", data: { name: a } }, "intensiva");
  time = 15;
  timeline.register({ type: "test:dequeue", data: { name: b } }, "general");
  time = 20;
  timeline.register({ type: "test:pass", data: { name: "escenario", details: { type: "test" } } }, "intensiva");
  const before = timeline.progress();
  assert.equal(before.started, 2);
  assert.equal(before.reported, 1);
  assert.equal(before.without_report, 2);
  assert.equal(before.remaining, 2);
  assert.equal(before.oldest_without_report[0].file, resolve(a));
  time = 40;
  timeline.register({ type: "test:summary", data: { file: b } }, "general");
  assert.equal(timeline.progress().reported, 2);
  assert.equal(timeline.progress().without_report, 1);
  time = 60;
  timeline.register({ type: "test:summary", data: { file: a } }, "intensiva");
  timeline.register({ type: "test:summary", data: {} }, "intensiva");
  timeline.finishLane("intensiva");
  assert.equal(timeline.progress().reported, 3);
  assert.equal(timeline.progress().remaining, 0);
  assert.equal(timeline.metrics().lanes[0].finished_ms, 60);
  assert.equal(timeline.metrics().lanes[0].global_summary_ms, 60);
  assert.equal(timeline.metrics().last_report_ms, 60);
});

test("evita duplicados y contabiliza fallos de archivo sin resumen individual", () => {
  let time = 5;
  const timeline = createRunnerTimeline([a, b], [], [{ name: "general", files: [a, b], concurrency: 2 }], () => time);
  timeline.register({ type: "test:dequeue", data: { name: a } }, "general");
  timeline.register({ type: "test:dequeue", data: { name: a } }, "general");
  timeline.register({ type: "test:dequeue", data: { name: "otra prueba" } }, "general");
  time = 12;
  timeline.register({ type: "test:fail", data: { name: a, details: { type: "test-file" } } }, "general");
  timeline.register({ type: "test:summary", data: { file: a } }, "general");
  timeline.register({ type: "test:fail", data: { name: b, details: { type: "test" } } }, "general");
  const state = timeline.sample({ passed: 1, failed: 1 });
  assert.equal(state.started, 1);
  assert.equal(state.reported, 1);
  assert.equal(state.not_started, 1);
  assert.equal(state.without_report, 0);
  assert.equal(timeline.metrics().lanes[0].reported, 1);
  assert.equal(timeline.metrics().snapshots[0].failed, 1);
  assert.equal(timeline.metrics().last_start_ms, 5);
});

test("no acepta eventos asignados a una cola desconocida", () => {
  const timeline = createRunnerTimeline([a], [], lanes, () => 0);
  assert.throws(() => timeline.register({ type: "test:dequeue", data: { name: a } }, "otra"), /Cola de pruebas desconocida/);
});
