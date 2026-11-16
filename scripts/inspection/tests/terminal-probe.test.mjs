import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
import test from "node:test";

const probe = resolve("scripts/inspection/terminal-probe.mjs");
const run = (mode) => spawnSync(process.execPath, [probe, mode], {
  encoding: "utf8", env: { ...process.env, NO_COLOR: "1" }
});

test("JSON de diagnóstico solo en stdout, UTF-8 y sin escapes", () => {
  const output = run("--json");
  assert.equal(output.status, 0);
  assert.equal(output.stderr, "");
  assert.equal(output.stdout.includes("\u001b"), false);
  const parsed = JSON.parse(output.stdout);
  assert.equal(parsed.text, "á é í ó ú ñ █ ✓");
  assert.equal(parsed.stdoutTTY, false);
  assert.equal(parsed.stderrTTY, false);
});

test("stdout y stderr conservan bytes UTF-8 y código de salida distinto de cero", () => {
  const output = run("--streams");
  assert.equal(output.status, 17);
  assert.equal(output.stdout, "SALIDA | á é í ó ú ñ █ ✓\n");
  assert.equal(output.stderr, "ERROR | á é í ó ú ñ █ ✓\n");
});

test("la excepción diagnóstica y argumento inválido no cuelgan", () => {
  const failure = run("--exception");
  assert.equal(failure.status, 1);
  assert.match(failure.stderr, /Excepción de diagnóstico: á é í ó ú ñ/);
  assert.equal(run("--desconocido").status, 1);
});
