import assert from "node:assert/strict";
import { lstat, readFile, readdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { createHash } from "node:crypto";
import test from "node:test";
import { runAccreditProvider } from "../../cli/commands/catalog/accredit-provider.js";
import { runPublishIndividual } from "../../cli/commands/catalog/publish-individual.js";
import { listIndividualFinishJournals } from "../../infrastructure/filesystem/catalog/individual-finish-journal.js";
import { preflightIndividualAccreditations } from "../individual-accreditation.js";
import { retainPublishedWorkReport } from "../../cli/reporting/published-work-archive.js";
import { createZipArchive } from "../../infrastructure/archive/zip.js";
import { retainRepositoryArtifact } from "../../infrastructure/filesystem/catalog/repository-artifact-snapshot.js";
import { completeIndividualFinishClosure } from "../individual-finish-closure.js";
import { createIndividualFinishWorkspace } from "../../testing/builders/individual-finish-fixture.js";

const withWorkspace = createIndividualFinishWorkspace(["gam"]);

test("exportación humana es copia exacta sin escrituras en el expediente", async () => {
  await withWorkspace(async (root, desktop) => {
    const [context] = await preflightIndividualAccreditations(root, ["gam"]);
    if (!context?.existing) throw new Error("Expediente de prueba no disponible");
    const target = join(desktop, "consulta-gam.json");
    const params = ["gam", "--source", context.options.catalogFile, "--preparation", context.options.preparationFile];
    const before = await readFile(context.existing.draftFile, "utf8");
    await runAccreditProvider([...params, "--exportar", target], root);
    assert.equal(await readFile(target, "utf8"), before);
    assert.equal(await readFile(context.existing.draftFile, "utf8"), before);
    await assert.rejects(runAccreditProvider([...params, "--exportar", target], root), { code: "EEXIST" });
  });
});

test("FINISH persiste etapas, reanuda el informe y no repite auditoría ni retención", async () => {
  await withWorkspace(async (root, desktop) => {
    let retained = 0;
    let audited = 0;
    const args = ["--proveedor", "gam"];
    const hooks = {
      desktopDirectory: desktop,
      retention: () => { retained += 1; },
      auditor: async () => { audited += 1; }
    };
    await assert.rejects(runPublishIndividual(args, root, {
      ...hooks, retention: () => { retained += 1; throw new Error("retención interrumpida"); }
    }), /RETENCIÓN PENDIENTE.*retención interrumpida/s);
    assert.equal((await listIndividualFinishJournals(root))[0]?.journal.status, "complete");
    assert.equal((await listIndividualFinishJournals(root))[0]?.journal.closure, undefined);
    await assert.rejects(runPublishIndividual(args, root, {
      ...hooks, auditor: async () => { audited += 1; throw new Error("auditor interrumpido"); }
    }), /AUDITOR PENDIENTE.*auditor interrumpido/s);
    assert.equal((await listIndividualFinishJournals(root))[0]?.journal.closure?.phase, "retained");
    await assert.rejects(runPublishIndividual(args, root, {
      ...hooks, reporter: async () => { throw new Error("cierre interrumpido"); }
    }), /INFORME PENDIENTE.*cierre interrumpido/s);
    assert.equal(retained, 2);
    assert.equal(audited, 2);
    assert.equal((await listIndividualFinishJournals(root))[0]?.journal.closure?.phase, "audited");
    const result = await runPublishIndividual(args, root, hooks);
    assert.ok(result);
    const [closed] = await listIndividualFinishJournals(root);
    assert.equal(closed?.journal.closure?.phase, "reported");
    assert.equal(closed?.journal.closure?.report?.kind, "internal");
    assert.equal(retained, 2);
    assert.equal(audited, 2);
    const count = (await readdir(desktop)).length;
    assert.equal(count, 0);
    await runPublishIndividual(args, root, {
      ...hooks,
      retention: () => { throw new Error("retención repetida"); },
      auditor: async () => { throw new Error("auditor repetido"); },
      reporter: async () => { throw new Error("informe repetido"); }
    });
    assert.equal((await readdir(desktop)).length, count);
    const file = closed.journal.closure?.report?.path;
    if (!file) throw new Error("Recibo sin informe");
    const original = await readFile(file);
    await writeFile(file, "alterado");
    await assert.rejects(runPublishIndividual(args, root, hooks), /Informe FINISH alterado|Huella del artefacto/);
    assert.equal(retained, 2);
    assert.equal(audited, 2);
    await writeFile(file, original);
    const actions = {
      retention: async () => { throw new Error("retención repetida"); },
      auditor: async () => { throw new Error("auditoría repetida"); },
      reporter: async () => { throw new Error("informe repetido"); }
    };
    const legacyZip = join(desktop, "informe-anterior.zip");
    const archive = createZipArchive([{ name: "INFORME.md", data: original.toString("utf8") }]);
    await writeFile(legacyZip, archive);
    const receipt = { path: legacyZip, sha256: createHash("sha256").update(archive).digest("hex") };
    await writeFile(closed.path, JSON.stringify({ ...closed.journal, closure: { phase: "reported", report: receipt } }));
    assert.equal((await completeIndividualFinishClosure(root, result, actions)).reportFile, legacyZip);
    assert.deepEqual(await readdir(desktop), ["informe-anterior.zip"]);
    await writeFile(legacyZip, "alterado");
    await assert.rejects(completeIndividualFinishClosure(root, result, actions), /Informe FINISH alterado/);
    await writeFile(legacyZip, archive);
    await writeFile(closed.path, JSON.stringify(closed.journal));
    const reportDirectory = join(root, "catalogs", "reports", "individual-finish");
    await retainRepositoryArtifact(reportDirectory, "INFORME.txt", [{ name: "INFORME.txt", content: "Corte posterior de prueba" }]);
    await retainRepositoryArtifact(reportDirectory, "INFORME.txt", [{ name: "INFORME.txt", content: "Otro corte posterior de prueba" }]);
    await assert.rejects(lstat(file), { code: "ENOENT" });
    const renewed = await completeIndividualFinishClosure(root, result, {
      ...actions, reporter: () => retainPublishedWorkReport(root, result)
    });
    assert.deepEqual(renewed.executed, ["reported"]);
    assert.equal(renewed.reportFile, file);
    assert.deepEqual(await readFile(renewed.reportFile), original);
    assert.equal((await listIndividualFinishJournals(root))[0]?.journal.closure?.report?.kind, "internal");
    assert.deepEqual(await readdir(desktop), ["informe-anterior.zip"]);
    assert.deepEqual(await readFile(legacyZip), archive);
  });
});
