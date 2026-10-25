import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync, copyFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../../../..");
const script = join(root, "scripts/herramientas.mjs");
const packageFile = join(root, "package.json");

type CommandResult = { readonly status: number | null; readonly stdout: string; readonly stderr: string };

const run = (file: string, args: readonly string[]): Promise<CommandResult> => new Promise((resolve, reject) => {
  const child = spawn(process.execPath, [file, ...args], { windowsHide: true, stdio: ["ignore", "pipe", "pipe"] });
  let stdout = "";
  let stderr = "";
  child.stdout.setEncoding("utf8").on("data", (chunk: string) => { stdout += chunk; });
  child.stderr.setEncoding("utf8").on("data", (chunk: string) => { stderr += chunk; });
  child.once("error", reject);
  child.once("close", (status) => resolve({ status, stdout, stderr }));
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

test("ayuda española y validación de proveedor funcionan sin compilar", async () => {
  const [help, commandHelp, missing, unknown] = await Promise.all([
    run(script, ["ayuda"]),
    run(script, ["ayuda", "preparar"]),
    run(script, ["preparar"]),
    run(script, ["ayuda", "no-existe"])
  ]);
  assert.equal(help.status, 0, help.stderr);
  assert.match(help.stdout, /npm ci instala dependencias sin extraer/);
  assert.equal(commandHelp.status, 0, commandHelp.stderr);
  assert.match(commandHelp.stdout, /--origen/);
  assert.equal(missing.status, 1);
  assert.match(missing.stderr, /Falta el proveedor/);
  assert.equal(unknown.status, 1);
});

test("el despachador conserva la compatibilidad y traduce las opciones antes de ejecutar", async () => {
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
    const [spanish, legacy, validate, originalHelp, cleanup, applied, previous, denied] = await Promise.all([
      run(fake, ["preparar", "gam", "--origen", "origen-catalog.json", "--simular"]),
      run(fake, ["prepare:catalog", "gam", "--source", "origen-catalog.json", "--dry-run"]),
      run(fake, ["validar", "gam", "--etapa", "preparacion", "--preparacion", "x-preparation.json"]),
      run(fake, ["scrape", "gam", "--help"]),
      run(fake, ["limpiar:almacen"]),
      run(fake, ["limpiar:almacen", "--aplicar"]),
      run(fake, ["storage:clean"]),
      run(fake, ["limpiar:almacen", "--aplicar", "--simular"])
    ]);
    assert.equal(spanish.status, 0, spanish.stderr);
    assert.deepEqual(JSON.parse(spanish.stdout.trim()), ["gam", "--source", "origen-catalog.json", "--dry-run"]);
    assert.equal(legacy.status, 0, legacy.stderr);
    assert.deepEqual(JSON.parse(legacy.stdout.trim()), ["gam", "--source", "origen-catalog.json", "--dry-run"]);
    assert.equal(validate.status, 0, validate.stderr);
    assert.deepEqual(JSON.parse(validate.stdout.trim()), ["validate", "gam", "--stage", "preparation", "--preparation", "x-preparation.json"]);
    assert.equal(originalHelp.status, 0, originalHelp.stderr);
    assert.deepEqual(JSON.parse(originalHelp.stdout.trim()), ["scrape", "gam", "--help"]);
    assert.equal(cleanup.status, 0, cleanup.stderr);
    assert.deepEqual(JSON.parse(cleanup.stdout.trim()), ["--dry-run"]);
    assert.equal(applied.status, 0, applied.stderr);
    assert.deepEqual(JSON.parse(applied.stdout.trim()), []);
    assert.equal(previous.status, 0, previous.stderr);
    assert.deepEqual(JSON.parse(previous.stdout.trim()), []);
    assert.equal(denied.status, 1);
    assert.match(denied.stderr, /No combines/);
  } finally {
    rmSync(temp, { recursive: true, force: true });
  }
});
