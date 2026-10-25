import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync, copyFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../../../..");
const script = join(root, "scripts/herramientas.mjs");
const packageFile = join(root, "package.json");

const run = (file: string, args: readonly string[]) => spawnSync(process.execPath, [file, ...args], {
  encoding: "utf8", windowsHide: true
});

test("npm ci no ejecuta preparación de catálogos como lifecycle", () => {
  const pkg: unknown = JSON.parse(readFileSync(packageFile, "utf8"));
  assert.ok(typeof pkg === "object" && pkg !== null && "scripts" in pkg);
  const scripts = pkg.scripts;
  assert.ok(typeof scripts === "object" && scripts !== null);
  assert.equal(Object.hasOwn(scripts, "prepare"), false);
  assert.equal(Object.hasOwn(scripts, "preinstall"), false);
  assert.equal(Object.hasOwn(scripts, "postinstall"), false);
  assert.equal(Object.hasOwn(scripts, "prepack"), false);
  for (const command of ["ayuda", "preparar", "extraer", "validar", "cobertura", "seleccionar", "limpiar:almacen", "prepare:catalog", "test", "build"]) {
    assert.ok(Object.hasOwn(scripts, command), command);
  }
});

test("ayuda española y validación de proveedor funcionan sin compilar", () => {
  const help = run(script, ["ayuda"]);
  assert.equal(help.status, 0, help.stderr);
  assert.match(help.stdout, /npm ci instala dependencias sin extraer/);
  const commandHelp = run(script, ["ayuda", "preparar"]);
  assert.equal(commandHelp.status, 0, commandHelp.stderr);
  assert.match(commandHelp.stdout, /--origen/);
  const missing = run(script, ["preparar"]);
  assert.equal(missing.status, 1);
  assert.match(missing.stderr, /Falta el proveedor/);
  const unknown = run(script, ["ayuda", "no-existe"]);
  assert.equal(unknown.status, 1);
});

test("el despachador conserva la compatibilidad y traduce las opciones antes de ejecutar", () => {
  const temp = mkdtempSync(join(tmpdir(), "equipzilla-tooling-"));
  try {
    mkdirSync(join(temp, "scripts"));
    mkdirSync(join(temp, "dist/cli"), { recursive: true });
    writeFileSync(join(temp, "package.json"), '{"type":"module"}');
    copyFileSync(script, join(temp, "scripts/herramientas.mjs"));
    writeFileSync(join(temp, "scripts/run-build.mjs"), "process.exitCode = 0;\n");
    const echo = 'console.log(JSON.stringify(process.argv.slice(2)));\n';
    for (const filename of ["prepare.js", "index.js", "storage-clean.js"]) {
      writeFileSync(join(temp, "dist/cli", filename), echo);
    }
    const fake = join(temp, "scripts/herramientas.mjs");
    const spanish = run(fake, ["preparar", "gam", "--origen", "origen-catalog.json", "--simular"]);
    assert.equal(spanish.status, 0, spanish.stderr);
    assert.deepEqual(JSON.parse(spanish.stdout.trim()), ["gam", "--source", "origen-catalog.json", "--dry-run"]);
    const legacy = run(fake, ["prepare:catalog", "gam", "--source", "origen-catalog.json", "--dry-run"]);
    assert.equal(legacy.status, 0, legacy.stderr);
    assert.deepEqual(JSON.parse(legacy.stdout.trim()), ["gam", "--source", "origen-catalog.json", "--dry-run"]);
    const validate = run(fake, ["validar", "gam", "--etapa", "preparacion", "--preparacion", "x-preparation.json"]);
    assert.equal(validate.status, 0, validate.stderr);
    assert.deepEqual(JSON.parse(validate.stdout.trim()), ["validate", "gam", "--stage", "preparation", "--preparation", "x-preparation.json"]);
    const originalHelp = run(fake, ["scrape", "gam", "--help"]);
    assert.equal(originalHelp.status, 0, originalHelp.stderr);
    assert.deepEqual(JSON.parse(originalHelp.stdout.trim()), ["scrape", "gam", "--help"]);
    const cleanup = run(fake, ["limpiar:almacen"]);
    assert.equal(cleanup.status, 0, cleanup.stderr);
    assert.deepEqual(JSON.parse(cleanup.stdout.trim()), ["--dry-run"]);
    const applied = run(fake, ["limpiar:almacen", "--aplicar"]);
    assert.equal(applied.status, 0, applied.stderr);
    assert.deepEqual(JSON.parse(applied.stdout.trim()), []);
    const previous = run(fake, ["storage:clean"]);
    assert.equal(previous.status, 0, previous.stderr);
    assert.deepEqual(JSON.parse(previous.stdout.trim()), []);
    const denied = run(fake, ["limpiar:almacen", "--aplicar", "--simular"]);
    assert.equal(denied.status, 1);
    assert.match(denied.stderr, /No combines/);
  } finally {
    rmSync(temp, { recursive: true, force: true });
  }
});
