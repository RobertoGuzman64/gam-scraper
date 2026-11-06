import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { lstat, mkdir, mkdtemp, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test, { after } from "node:test";
import { createPreparedRetentionFixture } from "./prepared-retention-fixture.js";
import { readOfflinePreparation } from "../offline-preparation.js";
import { simulatePreparedRetention } from "../preparation-retention.js";
import { formatRetentionSimulation } from "../../../../cli/reporting/retention-simulation.js";

const fixtures = createPreparedRetentionFixture();
const { withWorkspace, saveVersion } = fixtures;
after(fixtures.close);

test("simula la retención de tres versiones completas sin borrar ningún archivo", async () => {
  await withWorkspace(async (root, source) => {
    const paths = await Promise.all([1, 2, 3].map((index) => saveVersion(root, source, index)));
    const before = await Promise.all(paths.map((path) => readFile(path)));
    const result = await simulatePreparedRetention(root, "gam");
    assert.equal(result.kept, 2);
    assert.equal(result.candidates, 1);
    assert.equal(result.candidateFiles, 3);
    assert.equal(result.protected, 0);
    assert.equal(result.actualDeletions, 0);
    assert.deepEqual(result.versions.filter((item) => item.action === "candidato").map((item) => item.id), ["lote-v1"]);
    assert.deepEqual(await Promise.all(paths.map((path) => readFile(path))), before);
    assert.ok(formatRetentionSimulation("gam", result).includes("Eliminaciones reales: 0"));
  });
});

test("una acreditación con SHA completo de preparación protege el conjunto referido", async () => {
  await withWorkspace(async (root, source) => {
    const first = await saveVersion(root, source, 1);
    await saveVersion(root, source, 2);
    await saveVersion(root, source, 3);
    const hash = createHash("sha256").update(await readFile(first)).digest("hex");
    const directory = join(root, "catalogs", "providers", "gam", "publications");
    await mkdir(directory, { recursive: true });
    await writeFile(join(directory, "active.json"), JSON.stringify({ preparationSha256: hash }));
    const result = await simulatePreparedRetention(root, "gam");
    assert.equal(result.protected, 1);
    assert.equal(result.candidates, 0);
    assert.match(result.versions[0]?.reason ?? "", /Referenciada/);
  });
});

test("preparación inválida, manifest ausente y entradas desconocidas se bloquean", async () => {
  await withWorkspace(async (root, source) => {
    const first = await saveVersion(root, source, 1);
    await saveVersion(root, source, 2);
    await saveVersion(root, source, 3);
    await rm(first.replace(/-preparation\.json$/, "-preparation.manifest.json"));
    let result = await simulatePreparedRetention(root, "gam");
    assert.equal(result.protected, 1);
    assert.equal(result.candidates, 0);
    await writeFile(join(root, "storage", "prepared", "gam", "extra-archivo.dat"), "desconocido");
    result = await simulatePreparedRetention(root, "gam");
    assert.equal(result.protected, 3);
    assert.equal(result.candidates, 0);
  });
});

test("referencias en rutas gestionadas, ilegibles o enlazadas bloquean candidatos", async () => {
  await withWorkspace(async (root, source) => {
    await saveVersion(root, source, 1);
    await saveVersion(root, source, 2);
    await saveVersion(root, source, 3);
    const runs = join(root, "storage", "runs");
    await mkdir(runs, { recursive: true });
    await writeFile(join(runs, "attachment.zip"), "contenido no inspeccionable");
    const result = await simulatePreparedRetention(root, "gam");
    assert.equal(result.protected, 3);
    assert.equal(result.candidates, 0);
    await rm(join(runs, "attachment.zip"));
    await symlink(join(root, "storage", "prepared", "gam"), join(runs, "enlace"), "dir");
    const linked = await simulatePreparedRetention(root, "gam");
    assert.equal(linked.protected, 3);
    assert.equal(linked.candidates, 0);
  });
});

test("archivos TypeScript y Markdown sin referencias no bloquean preparaciones", async () => {
  await withWorkspace(async (root, source) => {
    await saveVersion(root, source, 1);
    await saveVersion(root, source, 2);
    await saveVersion(root, source, 3);
    const scripts = join(root, "storage", "interventions", "lote", "scripts");
    const editorial = join(root, "storage", "interventions", "lote", "editorial");
    await mkdir(scripts, { recursive: true });
    await mkdir(editorial, { recursive: true });
    await writeFile(join(scripts, "identidad.ts"), 'export const identidad = "GAM-123";');
    await writeFile(join(editorial, "propuesta.md"), "Propuesta editorial pendiente de revisión");
    const result = await simulatePreparedRetention(root, "gam");
    assert.equal(result.kept, 2);
    assert.equal(result.candidates, 1);
    assert.equal(result.protected, 0);
    assert.equal(result.actualDeletions, 0);
  });
});

test("referencias de preparación en TypeScript y Markdown protegen sus versiones con procedencia", async () => {
  await withWorkspace(async (root, source) => {
    const first = await saveVersion(root, source, 1);
    const second = await saveVersion(root, source, 2);
    await saveVersion(root, source, 3);
    const firstName = first.split(/[\\/]/).at(-1);
    if (!firstName) throw new Error("Nombre de preparación ausente");
    const secondHash = createHash("sha256").update(await readFile(second)).digest("hex");
    const scripts = join(root, "storage", "interventions", "lote", "scripts");
    const editorial = join(root, "storage", "interventions", "lote", "editorial");
    await mkdir(scripts, { recursive: true });
    await mkdir(editorial, { recursive: true });
    await writeFile(join(scripts, "correcciones.ts"), `export const preparationFile = "${firstName}";`);
    await writeFile(join(editorial, "evidencia.md"), `Preparación acreditada: ${secondHash}`);
    const result = await simulatePreparedRetention(root, "gam");
    assert.equal(result.protected, 2);
    assert.equal(result.kept, 1);
    assert.equal(result.candidates, 0);
    const firstDecision = result.versions.find((item) => item.id === "lote-v1");
    const secondDecision = result.versions.find((item) => item.id === "lote-v2");
    assert.match(firstDecision?.reason ?? "", /correcciones\.ts \(nombre\)/);
    assert.match(secondDecision?.reason ?? "", /evidencia\.md \(SHA-256\)/);
  });
});

test("solo admite la raíz autorizada; el almacén preparado enlazado se rechaza", async () => {
  await withWorkspace(async (root, source) => {
    await saveVersion(root, source, 1);
    await assert.rejects(simulatePreparedRetention(root, "gam", join(root, "otro")), /predeterminado/);
    const path = join(root, "storage", "prepared", "gam");
    await rm(path, { recursive: true });
    await symlink(join(root, "storage", "scraped", "gam"), path, "dir");
    await assert.rejects(simulatePreparedRetention(root, "gam"), /enlazada/);
    assert.equal((await lstat(path)).isSymbolicLink(), true);
  });
});

test("un directorio inexistente devuelve cero sin crear estructuras", async () => {
  const root = await mkdtemp(join(tmpdir(), "equipzilla-retention-empty-"));
  try {
    const result = await simulatePreparedRetention(root, "gam");
    assert.equal(result.candidates, 0);
    assert.equal(result.actualDeletions, 0);
  } finally { await rm(root, { recursive: true, force: true }); }
});


test("las versiones reutilizan preparaciones acreditadas sin contaminar los workspaces", async () => {
  let originalHash: string | undefined;
  await withWorkspace(async (root, source) => {
    const first = await saveVersion(root, source, 1);
    const second = await saveVersion(root, source, 2);
    const firstPreparation = await readOfflinePreparation(first, "gam");
    const secondPreparation = await readOfflinePreparation(second, "gam");
    assert.equal(firstPreparation.preparedAt, "2026-10-01T12:00:00Z");
    assert.equal(secondPreparation.preparedAt, "2026-10-02T12:00:00Z");
    assert.deepEqual(firstPreparation.source, secondPreparation.source);
    assert.deepEqual(firstPreparation.products, secondPreparation.products);
    originalHash = createHash("sha256").update(await readFile(first)).digest("hex");
    assert.notEqual(originalHash, createHash("sha256").update(await readFile(second)).digest("hex"));
    await writeFile(first.replace(/-preparation\.json$/, "-diagnostics.json"), "{}");
  });
  await withWorkspace(async (root, source) => {
    const first = await saveVersion(root, source, 1);
    assert.equal(createHash("sha256").update(await readFile(first)).digest("hex"), originalHash);
    assert.equal((await simulatePreparedRetention(root, "gam")).kept, 1);
  });
});
