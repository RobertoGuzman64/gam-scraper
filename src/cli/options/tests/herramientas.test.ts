import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync, copyFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { runCampaignReferenceUpdate } from "../../campaign-reference.js";

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
  for (const command of ["ayuda", "campana:extraer", "campana:revisar", "preparar", "extraer", "validar", "cobertura", "seleccionar", "limpiar:almacen", "prepare:catalog", "campana:comparar", "campana:referencia", "test", "build"]) {
    assert.ok(Object.hasOwn(scripts, command), command);
  }
});

test("ayuda española y validación de proveedor funcionan sin compilar", async () => {
  const [help, commandHelp, missing, unknown, campaignHelp, referenceHelp] = await Promise.all([
    run(script, ["ayuda"]),
    run(script, ["ayuda", "preparar"]),
    run(script, ["preparar"]),
    run(script, ["ayuda", "no-existe"]),
    run(script, ["ayuda", "campana:extraer"]),
    run(script, ["ayuda", "campana:referencia"])
  ]);
  assert.equal(help.status, 0, help.stderr);
  assert.match(help.stdout, /npm ci instala dependencias sin extraer/);
  assert.equal(commandHelp.status, 0, commandHelp.stderr);
  assert.match(commandHelp.stdout, /--origen/);
  assert.equal(missing.status, 1);
  assert.match(missing.stderr, /Falta el proveedor/);
  assert.equal(campaignHelp.status, 0);
  assert.match(campaignHelp.stdout, /--nueva/);
  assert.equal(referenceHelp.status, 0);
  assert.match(referenceHelp.stdout, /--actualizar/);
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
    for (const filename of ["prepare.js", "index.js", "storage-clean.js", "campaign-extract.js", "campaign-review.js", "campaign-reference.js"]) {
      writeFileSync(join(temp, "dist/cli", filename), echo);
    }
    const fake = join(temp, "scripts/herramientas.mjs");
    const [spanish, legacy, validate, originalHelp, cleanup, applied, previous, denied, campaignExtract, campaignReview, referenceUpdate, referenceDenied] = await Promise.all([
      run(fake, ["preparar", "gam", "--origen", "origen-catalog.json", "--simular"]),
      run(fake, ["prepare:catalog", "gam", "--source", "origen-catalog.json", "--dry-run"]),
      run(fake, ["validar", "gam", "--etapa", "preparacion", "--preparacion", "x-preparation.json"]),
      run(fake, ["scrape", "gam", "--help"]),
      run(fake, ["limpiar:almacen"]),
      run(fake, ["limpiar:almacen", "--aplicar"]),
      run(fake, ["storage:clean"]),
      run(fake, ["limpiar:almacen", "--aplicar", "--simular"]),
      run(fake, ["campana:extraer", "--nueva"]),
      run(fake, ["campana:revisar"]),
      run(fake, ["campana:referencia", "--actualizar"]),
      run(fake, ["campana:referencia", "--aplicar"])
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
    assert.equal(campaignExtract.status, 0, campaignExtract.stderr);
    assert.deepEqual(JSON.parse(campaignExtract.stdout.trim()), ["--nueva"]);
    assert.equal(campaignReview.status, 0, campaignReview.stderr);
    assert.deepEqual(JSON.parse(campaignReview.stdout.trim()), []);
    assert.equal(referenceUpdate.status, 0, referenceUpdate.stderr);
    assert.deepEqual(JSON.parse(referenceUpdate.stdout.trim()), ["--actualizar"]);
    assert.equal(referenceDenied.status, 1);
    assert.equal(denied.status, 1);
    assert.match(denied.stderr, /No combines/);
  } finally {
    rmSync(temp, { recursive: true, force: true });
  }
});


test("la actualización de referencia no permite opciones implícitas ni mezcladas", async () => {
  await assert.rejects(runCampaignReferenceUpdate([]), /solo admite --actualizar/);
  await assert.rejects(runCampaignReferenceUpdate(["--actualizar", "--simular"]), /solo admite --actualizar/);
  await assert.rejects(runCampaignReferenceUpdate(["--aplicar"]), /solo admite --actualizar/);
});
