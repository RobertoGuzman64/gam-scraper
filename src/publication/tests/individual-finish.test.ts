import { createPortableTestSymlink } from "../../testing/builders/portable-symlink-fixture.js";
import assert from "node:assert/strict";
import { lstat, mkdir, readdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import test from "node:test";
import { resolveAccreditedPublication } from "../../infrastructure/filesystem/catalog/publications/accredited-publication.js";
import { selectActivePublication } from "../active-publication.js";
import { publishIndividualCatalogs } from "../individual/individual-finish.js";
import { prepareIndividualTestWorkspace } from "../../testing/builders/individual-workspace-fixture.js";
import { createIndividualFinishWorkspace, finishProviders, publishIndividualTestWorkspace } from "../../testing/builders/individual-finish-fixture.js";

const withWorkspace = createIndividualFinishWorkspace();

test("FINISH exige preparar y bloquea incidencias nuevas sin antecedente acreditado", async () => {
  await withWorkspace(async (root) => {
    const progress: string[] = [];
    await assert.rejects(publishIndividualCatalogs({
      workspace: root, providers: finishProviders, dryRun: true, desktopDirectory: null,
      onProgress: (stage, providerId, completed, total) => progress.push(`${stage} ${providerId} ${completed}/${total}`)
    }), /preparar/);
    assert.deepEqual(progress, ["ACREDITACIÓN gam 0/3"]);
    await prepareIndividualTestWorkspace(root);
    await assert.rejects(publishIndividualCatalogs({ workspace: root, providers: finishProviders, dryRun: false, desktopDirectory: root }),
      /incidencia nueva|exclusión vigente/);
    await assert.rejects(lstat(join(root, "storage", "publication")), { code: "ENOENT" });
    for (const id of finishProviders) {
      await assert.rejects(lstat(join(root, "catalogs", "providers", id, "publications")), { code: "ENOENT" });
    }
  }, "original");
});

test("interrupción tras primer proveedor deja diario PARCIAL y se reanuda sin generar ZIP", async () => {
  await withWorkspace(async (root, desktop) => {
    const progress: string[] = [];
    await assert.rejects(publishIndividualCatalogs({
      workspace: root, providers: finishProviders, dryRun: false, desktopDirectory: desktop,
      onProgress: (stage, providerId, completed, total) => progress.push(`${stage} ${providerId} ${completed}/${total}`),
      activate: async (workspace, providerId, sha, activate) => {
        if (providerId === "gomariz" && activate) throw new Error("fallo inyectado de activación");
        return selectActivePublication(workspace, providerId, sha, activate);
      }
    }), /FINISH PARCIAL\/BLOQUEADO.*gam.*fallo inyectado/s);
    assert.ok(progress.includes(`ACREDITACIÓN gam 0/${finishProviders.length}`));
    assert.ok(progress.includes(`ACREDITACIÓN mercaeleva ${finishProviders.length}/${finishProviders.length}`));
    assert.ok(progress.includes(`INSPECCIÓN gam 1/${finishProviders.length}`));
    assert.ok(progress.includes(`ENTREGA mercaeleva ${finishProviders.length}/${finishProviders.length}`));
    assert.ok(progress.includes(`ACTIVACIÓN gam 1/${finishProviders.length}`));
    assert.ok(await resolveAccreditedPublication(root, "gam"));
    const zips = await readdir(desktop);
    assert.deepEqual(zips, []);
    const recovered = await publishIndividualTestWorkspace(root, desktop);
    assert.deepEqual(recovered.providers.map((item) => item.status),
      ["YA VIGENTE", "ACTIVADA Y VERIFICADA", "ACTIVADA Y VERIFICADA"]);
    assert.deepEqual(await readdir(desktop), zips);
  });
});

test("candidata preparada y JSON interno corrupto impiden activar incluso un solo proveedor", async () => {
  await withWorkspace(async (root, desktop) => {
    await assert.rejects(publishIndividualCatalogs({
      workspace: root, providers: finishProviders, dryRun: false, desktopDirectory: desktop,
      activate: async (_workspace, _providerId, _sha, _activate) => { throw new Error("detener antes de activar"); }
    }), /FINISH PARCIAL\/BLOQUEADO/);
    const parent = join(root, "catalogs", "providers", "gam", "publications");
    const [candidate] = await readdir(parent);
    assert.ok(candidate);
    await writeFile(join(parent, candidate, "gam-publishable.json"), "JSON CORROMPIDO");
    await assert.rejects(publishIndividualTestWorkspace(root, desktop), /archivo alterado|JSON inválido|FINISH PARCIAL/);
    assert.deepEqual(await readdir(desktop), []);
    for (const id of finishProviders) await assert.rejects(lstat(join(root, "catalogs", "providers", id, "publications", "active.json")), { code: "ENOENT" });
  });
});

test("diario en symlink o bloqueo existente no admite mutaciones fuera de workspace", async (t) => {
  await withWorkspace(async (root, desktop) => {
    const folder = join(root, "storage", "publication");
    const outside = join(root, "fuera");
    await mkdir(outside);
    if (!(await createPortableTestSymlink(t, outside, folder, "dir"))) return;
    await assert.rejects(publishIndividualTestWorkspace(root, desktop), /Directorio FINISH no regular/);
    await rm(folder);
    assert.deepEqual(await readdir(outside), []);
  });
});
