import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
import test from "node:test";

const root = resolve(".");
const run = (...args) => spawnSync(process.execPath, ["scripts/tooling.mjs", ...args], {
  cwd: root,
  encoding: "utf8",
  timeout: 10000,
  env: { ...process.env, CI: "true", NO_COLOR: "1", TERM: "dumb", FORCE_COLOR: "0" }
});

test("ayuda CLI sin stdin ni TTY termina con cero y sin ANSI", () => {
  const result = run("ayuda", "acreditar:proveedor");
  assert.equal(result.error, undefined);
  assert.equal(result.status, 0);
  assert.equal(result.stderr, "");
  assert.match(result.stdout, /--detalle/);
  assert.equal(result.stdout.includes("\u001b"), false);
});

test("comando inválido devuelve error por stderr, código 1 y salida limpia", () => {
  const result = run("comando-inexistente");
  assert.equal(result.error, undefined);
  assert.equal(result.status, 1);
  assert.equal(result.stdout, "");
  assert.match(result.stderr, /FAIL \| Comando desconocido/);
  assert.equal(result.stderr.includes("\u001b"), false);
});

test("ayuda nativa del comando conserva UTF-8, stderr vacío y cierre", () => {
  const result = run("ayuda", "huecos");
  assert.equal(result.error, undefined);
  assert.equal(result.status, 0);
  assert.equal(result.stderr, "");
  assert.match(result.stdout, /calidad editorial de publicaciones acreditadas/);
  assert.equal(result.stdout.includes("\u001b"), false);
});

test("normalización se expone como diagnóstico independiente y no como paso de FINISH", () => {
  const result = run("ayuda", "normalizar:auditar");
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /Diagnóstico de desarrollo bajo demanda/u);
  assert.match(result.stdout, /--top 20/u);
  assert.match(result.stdout, /--json/u);
  assert.equal(result.stderr, "");
  const finish = run("ayuda", "catalogo:publicar");
  assert.equal(finish.status, 0, finish.stderr);
  assert.doesNotMatch(finish.stdout, /normalizar:auditar|huecos/u);
});
