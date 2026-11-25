import assert from "node:assert/strict";
import { lstat, mkdir, readdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import test from "node:test";
import { consolidate, runPublishIndividual } from "../../cli/commands/catalog/individual/publish-individual.js";
import { preflightIndividualAccreditations } from "../individual/individual-accreditation.js";
import { publishIndividualCatalogs } from "../individual/individual-finish.js";
import { createIndividualFinishWorkspace, publishIndividualTestWorkspace } from "../../testing/builders/individual-finish-fixture.js";

const withWorkspace = createIndividualFinishWorkspace();

test("FINISH reutiliza una publicación para comprobar cierre y reacreditación", async (context) => {
  await withWorkspace(async (root, desktop) => {
    await context.test("CLI FINISH conserva selección, retención e informe idempotente", async () => {
      let retentionCount = 0;
      const dry = await runPublishIndividual(["--proveedor", "gomariz", "--simular"], root, {
        retention: () => { retentionCount++; }
      });
      assert.equal(dry?.mode, "simulation");
      assert.equal(retentionCount, 0);
      assert.equal((await readdir(desktop)).filter((name) => name.startsWith("equipzilla-informe-")).length, 0);
      const finished = await runPublishIndividual([], root, {
        desktopDirectory: desktop, retention: () => { retentionCount++; }
      });
      assert.equal(finished?.mode, "complete");
      assert.equal(retentionCount, 1);
      assert.deepEqual(await readdir(desktop), []);
      assert.ok((await lstat(join(root, "catalogs", "reports", "individual-finish", "active.json"))).isFile());
      const second = await runPublishIndividual([], root, {
        desktopDirectory: desktop, retention: () => { retentionCount++; }
      });
      assert.ok(second?.providers.every((item) => item.status === "YA VIGENTE"));
      assert.equal(retentionCount, 1);
      assert.deepEqual(await readdir(desktop), []);
      assert.ok((await lstat(join(root, "catalogs", "reports", "individual-finish", "active.json"))).isFile());
    });

    await context.test("FINISH reacredita sin interacción las exclusiones idénticas de la publicación vigente", async () => {
      const providers = ["gam"] as const;
      const contexts = await preflightIndividualAccreditations(root, providers);
      const gam = contexts[0];
      assert.ok(gam?.existing);
      await rm(gam.existing.draftFile);
      const preview = await publishIndividualCatalogs({
        workspace: root, providers, dryRun: true, desktopDirectory: null
      });
      assert.equal(preview.providers[0]?.excluded, 2);
      await assert.rejects(lstat(gam.existing.draftFile), { code: "ENOENT" });
      const renewed = await publishIndividualTestWorkspace(root, desktop, providers);
      assert.deepEqual(renewed.providers.map((item) => item.providerId), providers);
      assert.equal(renewed.providers[0]?.excluded, 2);
      const updated = await preflightIndividualAccreditations(root, providers);
      assert.equal(updated[0]?.existing?.inspection.approved, true);
      assert.equal(updated[0]?.existing?.inspection.completed, 2);
      assert.ok(updated[0]?.existing?.accreditation.approvalReason?.includes("automática"));
    });
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
    await assert.rejects(consolidate(root), /RETENCIÓN PENDIENTE.*código 5/);
  }, "original");
});

test("FINISH conserva publicaciones si falla el informe y permite reintentar sin republicar", async () => {
  await withWorkspace(async (root, desktop) => {
    await assert.rejects(runPublishIndividual([], root, {
      desktopDirectory: desktop, retention: () => undefined,
      reporter: async () => { throw new Error("Informe interno sin permiso"); }
    }), /INFORME PENDIENTE.*Informe interno sin permiso/);
    const archives = (await readdir(desktop)).filter((name) => /^equipzilla-(gam|gomariz|mercaeleva)-/.test(name));
    assert.equal(archives.length, 0);
    const recovered = await runPublishIndividual([], root, {
      desktopDirectory: desktop, retention: () => undefined
    });
    assert.ok(recovered?.providers.every((item) => item.status === "YA VIGENTE"));
    assert.deepEqual(await readdir(desktop), []);
    assert.ok((await lstat(join(root, "catalogs", "reports", "individual-finish", "active.json"))).isFile());
  });
});
