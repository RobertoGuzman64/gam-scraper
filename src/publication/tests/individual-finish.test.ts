import assert from "node:assert/strict";
import { lstat, mkdir, readdir, rm, symlink, writeFile } from "node:fs/promises";
import { join } from "node:path";
import test from "node:test";
import { resolveAccreditedPublication } from "../../infrastructure/filesystem/catalog/accredited-publication.js";
import { selectActivePublication } from "../active-publication.js";
import { publishIndividualCatalogs } from "../individual-finish.js";
import { prepareIndividualTestWorkspace } from "../../testing/builders/individual-workspace-fixture.js";
import { createIndividualFinishWorkspace, finishProviders, publishIndividualTestWorkspace } from "../../testing/builders/individual-finish-fixture.js";

const withWorkspace = createIndividualFinishWorkspace();

test("FINISH exige preparar y bloquea incidencias nuevas sin antecedente acreditado", async () => {
  await withWorkspace(async (root) => {
    await assert.rejects(publishIndividualCatalogs({ workspace: root, providers: finishProviders, dryRun: true, desktopDirectory: null }),
      /catalogo:preparar/);
    await prepareIndividualTestWorkspace(root);
    await assert.rejects(publishIndividualCatalogs({ workspace: root, providers: finishProviders, dryRun: false, desktopDirectory: root }),
      /incidencia nueva|exclusión vigente/);
    await assert.rejects(lstat(join(root, "storage", "publication")), { code: "ENOENT" });
    for (const id of finishProviders) {
      await assert.rejects(lstat(join(root, "catalogs", "providers", id, "publications")), { code: "ENOENT" });
    }
  }, "original");
});

test("interrupción tras primer proveedor deja diario PARCIAL y se reanuda sin otro ZIP", async () => {
  await withWorkspace(async (root, desktop) => {
    await assert.rejects(publishIndividualCatalogs({
      workspace: root, providers: finishProviders, dryRun: false, desktopDirectory: desktop,
      activate: async (workspace, providerId, sha, activate) => {
        if (providerId === "gomariz" && activate) throw new Error("fallo inyectado de activación");
        return selectActivePublication(workspace, providerId, sha, activate);
      }
    }), /FINISH PARCIAL\/BLOQUEADO.*gam.*fallo inyectado/s);
    assert.ok(await resolveAccreditedPublication(root, "gam"));
    const zips = await readdir(desktop);
    assert.equal(zips.length, 3);
    const recovered = await publishIndividualTestWorkspace(root, desktop);
    assert.deepEqual(recovered.providers.map((item) => item.status),
      ["YA VIGENTE", "ACTIVADA Y VERIFICADA", "ACTIVADA Y VERIFICADA"]);
    assert.deepEqual(await readdir(desktop), zips);
  });
});

test("candidata preparada y recibo corrupto impiden activar incluso un solo proveedor", async () => {
  await withWorkspace(async (root, desktop) => {
    await assert.rejects(publishIndividualCatalogs({
      workspace: root, providers: finishProviders, dryRun: false, desktopDirectory: desktop,
      activate: async (_workspace, _providerId, _sha, _activate) => { throw new Error("detener antes de activar"); }
    }), /FINISH PARCIAL\/BLOQUEADO/);
    const zip = (await readdir(desktop))[0];
    assert.ok(zip);
    await writeFile(join(desktop, zip), "ZIP CORROMPIDO");
    await assert.rejects(publishIndividualTestWorkspace(root, desktop), /ZIP individual alterado|ZIP distinto|FINISH PARCIAL/);
    for (const id of finishProviders) await assert.rejects(lstat(join(root, "catalogs", "providers", id, "publications", "active.json")), { code: "ENOENT" });
  });
});

test("diario en symlink o bloqueo existente no admite mutaciones fuera de workspace", async () => {
  await withWorkspace(async (root, desktop) => {
    const folder = join(root, "storage", "publication");
    const outside = join(root, "fuera");
    await mkdir(outside);
    await symlink(outside, folder, "dir");
    await assert.rejects(publishIndividualTestWorkspace(root, desktop), /Directorio FINISH no regular/);
    await rm(folder);
    assert.deepEqual(await readdir(outside), []);
  });
});
