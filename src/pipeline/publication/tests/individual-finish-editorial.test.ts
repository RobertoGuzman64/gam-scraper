import assert from "node:assert/strict";
import { lstat, mkdir, readdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import test from "node:test";
import { consolidate, runPublishIndividual } from "../../../cli/commands/catalog/publish-individual.js";
import { preflightIndividualAccreditations } from "../individual-accreditation.js";
import { publishIndividualCatalogs } from "../individual-finish.js";
import { createIndividualFinishWorkspace, finishProviders, publishIndividualTestWorkspace } from "../../../testing/builders/individual-finish-fixture.js";

const withWorkspace = createIndividualFinishWorkspace();

test("FINISH reacredita sin interacción las exclusiones idénticas de la publicación vigente", async () => {
  await withWorkspace(async (root, desktop) => {
    await publishIndividualTestWorkspace(root, desktop);
    const contexts = await preflightIndividualAccreditations(root, finishProviders);
    const gam = contexts[0];
    assert.ok(gam?.existing);
    await rm(gam.existing.draftFile);
    const preview = await publishIndividualCatalogs({
      workspace: root, providers: finishProviders, dryRun: true, desktopDirectory: null
    });
    assert.equal(preview.providers[0]?.excluded, 2);
    await assert.rejects(lstat(gam.existing.draftFile), { code: "ENOENT" });
    const result = await publishIndividualTestWorkspace(root, desktop);
    assert.equal(result.providers[0]?.excluded, 2);
    const updated = await preflightIndividualAccreditations(root, ["gam"]);
    assert.equal(updated[0]?.existing?.inspection.approved, true);
    assert.equal(updated[0]?.existing?.inspection.completed, 2);
    assert.ok(updated[0]?.existing?.accreditation.approvalReason?.includes("automática"));
  });
});

test("CLI FINISH conserva colores de reporting, admite selección y ejecuta retención y auditor al cerrar", async () => {
  await withWorkspace(async (root, desktop) => {
    let retentionCount = 0;
    let auditorCount = 0;
    const dry = await runPublishIndividual(["--proveedor", "gomariz", "--simular"], root, {
      retention: () => { retentionCount++; }, auditor: async () => { auditorCount++; }
    });
    assert.equal(dry?.mode, "simulation");
    assert.equal(retentionCount, 0);
    assert.equal((await readdir(desktop)).filter((name) => name.startsWith("equipzilla-informe-")).length, 0);
    const finished = await runPublishIndividual([], root, {
      desktopDirectory: desktop, retention: () => { retentionCount++; }, auditor: async () => { auditorCount++; }
    });
    assert.equal(finished?.mode, "complete");
    assert.equal(retentionCount, 1);
    assert.equal(auditorCount, 1);
    assert.equal((await readdir(desktop)).filter((name) => name.startsWith("equipzilla-informe-")).length, 1);
    const second = await runPublishIndividual([], root, {
      desktopDirectory: desktop, retention: () => { retentionCount++; }, auditor: async () => { auditorCount++; }
    });
    assert.ok(second?.providers.every((item) => item.status === "YA VIGENTE"));
    assert.equal(retentionCount, 2);
    assert.equal(auditorCount, 2);
    assert.equal((await readdir(desktop)).filter((name) => name.startsWith("equipzilla-informe-")).length, 1);
  });
});


test("FINISH muestra actividad mientras espera la poda y conserva su código de error", async () => {
  await withWorkspace(async (root) => {
    const maintenance = join(root, "scripts", "maintenance");
    await mkdir(maintenance, { recursive: true });
    const script = join(maintenance, "consolidate-local-artifacts.mjs");
    await writeFile(script, 'await new Promise((resolve) => setTimeout(resolve, 40)); console.log("CONSOLIDACIÓN CORRECTA");\n');
    await consolidate(root);
    await writeFile(script, 'console.error("BLOQUEO REAL"); process.exitCode = 5;\n');
    await assert.rejects(consolidate(root), /ARCHIVADO PENDIENTE.*código 5/);
  });
});

test("FINISH conserva publicaciones si falla el informe y permite reintentar sin republicar", async () => {
  await withWorkspace(async (root, desktop) => {
    await assert.rejects(runPublishIndividual([], root, {
      desktopDirectory: desktop, retention: () => undefined, auditor: async () => undefined,
      reporter: async () => { throw new Error("Escritorio sin permiso"); }
    }), /INFORME PENDIENTE.*Escritorio sin permiso/);
    const archives = (await readdir(desktop)).filter((name) => /^equipzilla-(gam|gomariz|mercaeleva)-/.test(name));
    assert.equal(archives.length, 3);
    const recovered = await runPublishIndividual([], root, {
      desktopDirectory: desktop, retention: () => undefined, auditor: async () => undefined
    });
    assert.ok(recovered?.providers.every((item) => item.status === "YA VIGENTE"));
    assert.equal((await readdir(desktop)).filter((name) => name.startsWith("equipzilla-informe-")).length, 1);
  });
});
