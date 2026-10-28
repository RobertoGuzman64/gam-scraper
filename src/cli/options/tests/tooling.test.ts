import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync, copyFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { runCampaignReferenceUpdate } from "../../campaign-reference.js";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../../../..");
const script = join(root, "scripts/tooling.mjs");
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
  for (const command of ["ayuda", "iniciar", "estado", "extraer", "revisar", "intervenir", "acreditar", "entregar", "comparar", "referencia", "recuperar", "extraer:proveedor", "intervenir:manual", "preparar", "validar", "cobertura", "seleccionar", "limpiar:almacen", "test", "build"]) {
    assert.ok(Object.hasOwn(scripts, command), command);
  }
  const names = Object.keys(scripts);
  assert.ok(names.every((name) => !name.startsWith("campana:")));
  for (const removed of ["scrape", "prepare:catalog", "select:publishable", "storage:clean", "compilar", "probar", "limpiar:compilado", "limpiar"]) {
    assert.ok(!Object.hasOwn(scripts, removed), removed);
  }
});

test("ayuda española y validación de proveedor funcionan sin compilar", async () => {
  const [help, commandHelp, missing, unknown, campaignHelp, referenceHelp, editorialHelp] = await Promise.all([
    run(script, ["ayuda"]),
    run(script, ["ayuda", "preparar"]),
    run(script, ["preparar"]),
    run(script, ["ayuda", "no-existe"]),
    run(script, ["ayuda", "extraer"]),
    run(script, ["ayuda", "referencia"]),
    run(script, ["ayuda", "acreditar"])
  ]);
  assert.equal(help.status, 0, help.stderr);
  assert.match(help.stdout, /npm ci instala dependencias sin extraer/);
  assert.match(help.stdout, /estado/);
  assert.match(help.stdout, /◆ EQUIPZILLA \/ AYUDA/);
  assert.match(help.stdout, /LECTURA/);
  assert.equal(commandHelp.status, 0, commandHelp.stderr);
  assert.match(commandHelp.stdout, /--origen/);
  assert.equal(missing.status, 1);
  assert.match(missing.stderr, /Falta el proveedor/);
  assert.equal(campaignHelp.status, 0);
  assert.match(campaignHelp.stdout, /--nueva/);
  assert.equal(referenceHelp.status, 0);
  assert.match(referenceHelp.stdout, /--actualizar/);
  assert.equal(editorialHelp.status, 0);
  assert.match(editorialHelp.stdout, /--decidir/);
  assert.match(editorialHelp.stdout, /--aprobar/);
  assert.equal(unknown.status, 1);
  assert.match(unknown.stderr, /^FAIL \| Comando de ayuda desconocido/);
});

test("el despachador utiliza comandos únicos y traduce las opciones antes de ejecutar", async () => {
  const temp = mkdtempSync(join(tmpdir(), "equipzilla-tooling-"));
  try {
    mkdirSync(join(temp, "scripts"));
    mkdirSync(join(temp, "dist/cli"), { recursive: true });
    writeFileSync(join(temp, "package.json"), '{"type":"module"}');
    copyFileSync(script, join(temp, "scripts/tooling.mjs"));
    copyFileSync(join(root, "scripts/terminal.mjs"), join(temp, "scripts/terminal.mjs"));
    writeFileSync(join(temp, "scripts/run-build.mjs"), "process.exitCode = 0;\n");
    const echo = 'console.log(JSON.stringify(process.argv.slice(2)));\n';
    for (const filename of ["prepare.js", "index.js", "storage-clean.js", "campaign-extract.js", "campaign-status.js", "campaign-review.js", "campaign-reference.js", "campaign-finalize.js", "catalog-content-gaps.js"]) {
      writeFileSync(join(temp, "dist/cli", filename), echo);
    }
    writeFileSync(join(temp, "dist/cli/campaign-intervene.js"), 'console.log("CAMPAIGN " + JSON.stringify(process.argv.slice(2)));\n');
    writeFileSync(join(temp, "dist/cli/intervene.js"), 'console.log("MANUAL " + JSON.stringify(process.argv.slice(2)));\n');
    const fake = join(temp, "scripts/tooling.mjs");
    const [spanish, providerExtract, validate, campaignHelp, cleanup, applied, simulation, denied, campaignExtract, campaignReview, campaignStatus, referenceRead, referenceUpdate, referenceRecovery, referenceExport, referenceImport, referenceDenied, gaps, legacyCatalog] = await Promise.all([
      run(fake, ["preparar", "gam", "--origen", "origen-catalog.json", "--simular"]),
      run(fake, ["extraer:proveedor", "gam", "--categoria", "venta"]),
      run(fake, ["validar", "gam", "--etapa", "preparacion", "--preparacion", "x-preparation.json"]),
      run(fake, ["extraer", "--help"]),
      run(fake, ["limpiar:almacen"]),
      run(fake, ["limpiar:almacen", "--aplicar"]),
      run(fake, ["limpiar:almacen", "--simular"]),
      run(fake, ["limpiar:almacen", "--aplicar", "--simular"]),
      run(fake, ["extraer", "--nueva"]),
      run(fake, ["revisar"]),
      run(fake, ["estado"]),
      run(fake, ["referencia"]),
      run(fake, ["referencia", "--actualizar"]),
      run(fake, ["referencia", "--recuperar"]),
      run(fake, ["referencia", "--exportar", "copia-nueva"]),
      run(fake, ["referencia", "--importar", "copia", "--sustituir"]),
      run(fake, ["referencia", "--aplicar"]),
      run(fake, ["huecos", "--catalogo", "fixture-catalog.json", "--top", "10"]),
      run(fake, ["preparar", "gam", "--catalogo", "fixture-catalog.json"])
    ]);
    const [campaignIntervention, manualIntervention] = await Promise.all([
      run(fake, ["intervenir", "gam", "--script", "interventions/gam/6002.ts", "--aplicar"]),
      run(fake, ["intervenir:manual", "gam", "--origen", "catalogo-catalog.json", "--aplicar"])
    ]);
    assert.equal(campaignIntervention.status, 0, campaignIntervention.stderr);
    assert.deepEqual(JSON.parse(campaignIntervention.stdout.slice("CAMPAIGN ".length)),
      ["gam", "--script", "interventions/gam/6002.ts", "--aplicar"]);
    assert.equal(manualIntervention.status, 0, manualIntervention.stderr);
    assert.deepEqual(JSON.parse(manualIntervention.stdout.slice("MANUAL ".length)),
      ["gam", "--source", "catalogo-catalog.json", "--aplicar"]);
    for (const previous of ["campana:extraer", "campana:finalizar", "scrape", "prepare:catalog"]) {
      const rejected = await run(fake, [previous]);
      assert.equal(rejected.status, 1, previous);
      assert.match(rejected.stderr, /Comando desconocido/);
    }
    assert.equal(spanish.status, 0, spanish.stderr);
    assert.deepEqual(JSON.parse(spanish.stdout.trim()), ["gam", "--source", "origen-catalog.json", "--dry-run"]);
    assert.equal(providerExtract.status, 0, providerExtract.stderr);
    assert.deepEqual(JSON.parse(providerExtract.stdout.trim()), ["scrape", "gam", "--category", "venta"]);
    assert.equal(validate.status, 0, validate.stderr);
    assert.deepEqual(JSON.parse(validate.stdout.trim()), ["validate", "gam", "--stage", "preparation", "--preparation", "x-preparation.json"]);
    assert.equal(campaignHelp.status, 0, campaignHelp.stderr);
    assert.match(campaignHelp.stdout, /extraer \[-- --nueva\]/);
    assert.equal(cleanup.status, 0, cleanup.stderr);
    assert.deepEqual(JSON.parse(cleanup.stdout.trim()), ["--dry-run"]);
    assert.equal(applied.status, 0, applied.stderr);
    assert.deepEqual(JSON.parse(applied.stdout.trim()), []);
    assert.equal(simulation.status, 0, simulation.stderr);
    assert.deepEqual(JSON.parse(simulation.stdout.trim()), ["--dry-run"]);
    assert.equal(campaignExtract.status, 0, campaignExtract.stderr);
    assert.deepEqual(JSON.parse(campaignExtract.stdout.trim()), ["--nueva"]);
    assert.equal(campaignReview.status, 0, campaignReview.stderr);
    assert.deepEqual(JSON.parse(campaignReview.stdout.trim()), []);
    assert.equal(campaignStatus.status, 0, campaignStatus.stderr);
    assert.deepEqual(JSON.parse(campaignStatus.stdout.trim()), []);
    assert.equal(referenceRead.status, 0, referenceRead.stderr);
    assert.deepEqual(JSON.parse(referenceRead.stdout.trim()), []);
    assert.equal(referenceRecovery.status, 0, referenceRecovery.stderr);
    assert.deepEqual(JSON.parse(referenceRecovery.stdout.trim()), ["--recuperar"]);
    assert.equal(referenceExport.status, 0, referenceExport.stderr);
    assert.deepEqual(JSON.parse(referenceExport.stdout.trim()), ["--exportar", "copia-nueva"]);
    assert.equal(referenceImport.status, 0, referenceImport.stderr);
    assert.deepEqual(JSON.parse(referenceImport.stdout.trim()), ["--importar", "copia", "--sustituir"]);
    assert.equal(referenceUpdate.status, 0, referenceUpdate.stderr);
    assert.deepEqual(JSON.parse(referenceUpdate.stdout.trim()), ["--actualizar"]);
    assert.equal(referenceDenied.status, 1);
    assert.equal(gaps.status, 0, gaps.stderr);
    assert.deepEqual(JSON.parse(gaps.stdout.trim()), ["--catalogo", "fixture-catalog.json", "--top", "10"]);
    assert.equal(legacyCatalog.status, 0, legacyCatalog.stderr);
    assert.deepEqual(JSON.parse(legacyCatalog.stdout.trim()), ["gam", "--catalog", "fixture-catalog.json"]);
    const decision = await run(fake, ["acreditar", "--decidir", "gam", "6682", "excluir",
      "--motivo", "Identidad contrastada por el operador", "--evidencia", "https://catalogo.example/ficha"]);
    assert.equal(decision.status, 0, decision.stderr);
    assert.deepEqual(JSON.parse(decision.stdout.trim()), ["--decidir", "gam", "6682", "excluir",
      "--motivo", "Identidad contrastada por el operador", "--evidencia", "https://catalogo.example/ficha"]);
    assert.equal(denied.status, 1);
    assert.match(denied.stderr, /No combines/);
  } finally {
    rmSync(temp, { recursive: true, force: true });
  }
});


test("la actualización de referencia no permite opciones implícitas ni mezcladas", async () => {
  await assert.rejects(runCampaignReferenceUpdate(["--actualizar", "--simular"]), /Opciones inválidas/);
  await assert.rejects(runCampaignReferenceUpdate(["--aplicar"]), /Opciones inválidas/);
  await assert.rejects(runCampaignReferenceUpdate(["--exportar"]), /Opciones inválidas/);
  await assert.rejects(runCampaignReferenceUpdate(["--importar", "copia", "--actualizar"]), /Opciones inválidas/);
});
