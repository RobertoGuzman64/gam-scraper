import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { lstat, mkdir, readFile, readdir, rm, symlink, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import test from "node:test";
import { resolveAccreditedPublication, readAccreditedPublication } from "../../../infrastructure/filesystem/catalog/accredited-publication.js";
import { publicationApprovalSha } from "../../../infrastructure/filesystem/catalog/publication-identity.js";
import { runAccreditIndividual } from "../../../cli/commands/catalog/accredit-individual.js";
import { runPublishIndividual } from "../../../cli/commands/catalog/publish-individual.js";
import { preflightIndividualAccreditations } from "../individual-accreditation.js";
import { selectActivePublication } from "../active-publication.js";
import { publishIndividualCatalogs } from "../individual-finish.js";
import { createIndividualWorkspaceFixture, prepareIndividualTestWorkspace } from "../../../testing/builders/individual-workspace-fixture.js";
import type { EditorialSessionInput } from "../../../cli/commands/catalog/accredit-individual.js";

const ids = ["gam", "gomariz", "mercaeleva"] as const;
const answers = (...values: readonly string[]): EditorialSessionInput => {
  const queue = [...values];
  return { ask: async () => queue.shift() ?? "q", close: () => undefined };
};
const reason = "Contraste editorial realizado con evidencia de origen";
const approve = async (root: string): Promise<void> => {
  const contexts = await preflightIndividualAccreditations(root, ids);
  const evidence = contexts[2]?.expected.exclusions[0]?.sourceUrl;
  assert.ok(evidence);
  assert.equal(await runAccreditIndividual([], root,
    answers("p", "EXCLUIR", "p", "EXCLUIR", "e", reason, evidence, reason, "APROBAR")), true);
};
const withWorkspace = createIndividualWorkspaceFixture({
  prefix: "equipzilla-finish con espacios ", serialNumber: "SERIAL-REPETIDO",
  defaultState: "approved", approve
});

const publish = (root: string, desktop: string) => publishIndividualCatalogs({
  workspace: root, providers: ids, dryRun: false, desktopDirectory: desktop
});
const fileSha = async (file: string): Promise<string> => createHash("sha256").update(await readFile(file)).digest("hex");

test("FINISH exige preparar y aprobación explícita, sin versiones ni diario si está bloqueado", async () => {
  await withWorkspace(async (root) => {
    await assert.rejects(publishIndividualCatalogs({ workspace: root, providers: ids, dryRun: true, desktopDirectory: null }),
      /catalogo:preparar/);
    await prepareIndividualTestWorkspace(root);
    await assert.rejects(publishIndividualCatalogs({ workspace: root, providers: ids, dryRun: false, desktopDirectory: root }),
      /PASO 2|borrador/);
    await assert.rejects(lstat(join(root, "storage", "publication")), { code: "ENOENT" });
    for (const id of ids) {
      await assert.rejects(lstat(join(root, "catalogs", "providers", id, "publications")), { code: "ENOENT" });
    }
  }, "original");
});

test("ciclo completo: simular sin escrituras, 3 activaciones, ZIPs, SHA, y repetición idempotente", async () => {
  await withWorkspace(async (root, desktop) => {
    const source = join(root, "catalogs", "providers", "gam", "original", "scrape-gam-catalog.json");
    const sourceSha = await fileSha(source);
    const dry = await publishIndividualCatalogs({ workspace: root, providers: ids, dryRun: true, desktopDirectory: null });
    assert.equal(dry.mode, "simulation");
    assert.equal(dry.providers.length, 3);
    assert.ok(dry.providers.every((item) => item.activeSha256 === null));
    assert.deepEqual(await readdir(desktop), []);
    await assert.rejects(lstat(join(root, "storage", "publication")), { code: "ENOENT" });
    const published = await publish(root, desktop);
    assert.equal(published.mode, "complete");
    assert.deepEqual(published.providers.map((item) => item.status), Array(3).fill("ACTIVADA Y VERIFICADA"));
    const zips = await readdir(desktop);
    assert.equal(zips.length, 3);
    const versions: string[] = [];
    for (const id of ids) {
      const active = await resolveAccreditedPublication(root, id);
      assert.ok(active);
      const publication = await readAccreditedPublication(active);
      assert.equal(publication.providerId, id);
      const approval = await publicationApprovalSha(dirname(active));
      const index: { approvalSha256: string } = JSON.parse(await readFile(join(root, "catalogs", "providers", id, "publications", "active.json"), "utf8"));
      assert.equal(index.approvalSha256, approval);
      versions.push(approval);
      const receipts = await readdir(join(root, "storage", "providers", id, "deliveries"));
      assert.deepEqual(receipts, [`${approval}.json`]);
    }
    const journals = (await readdir(join(root, "storage", "publication", "individual-finish"))).filter((name) => name.endsWith(".json"));
    assert.equal(journals.length, 1);
    const journal: { status: string; completed: readonly string[] } = JSON.parse(await readFile(join(root, "storage", "publication", "individual-finish", journals[0]!), "utf8"));
    assert.equal(journal.status, "complete");
    assert.deepEqual(journal.completed, ids);
    const second = await publish(root, desktop);
    assert.ok(second.providers.every((item) => item.status === "YA VIGENTE"));
    assert.deepEqual(await readdir(desktop), zips);
    assert.equal(await fileSha(source), sourceSha);
    for (const [index, id] of ids.entries()) {
      const active = await resolveAccreditedPublication(root, id);
      assert.ok(active);
      assert.equal(await publicationApprovalSha(dirname(active)), versions[index]);
    }
  });
});

test("interrupción tras primer proveedor deja diario PARCIAL y se reanuda sin otro ZIP", async () => {
  await withWorkspace(async (root, desktop) => {
    await assert.rejects(publishIndividualCatalogs({
      workspace: root, providers: ids, dryRun: false, desktopDirectory: desktop,
      activate: async (workspace, providerId, sha, activate) => {
        if (providerId === "gomariz" && activate) throw new Error("fallo inyectado de activación");
        return selectActivePublication(workspace, providerId, sha, activate);
      }
    }), /FINISH PARCIAL\/BLOQUEADO.*gam.*fallo inyectado/s);
    assert.ok(await resolveAccreditedPublication(root, "gam"));
    const zips = await readdir(desktop);
    assert.equal(zips.length, 3);
    const recovered = await publish(root, desktop);
    assert.deepEqual(recovered.providers.map((item) => item.status),
      ["YA VIGENTE", "ACTIVADA Y VERIFICADA", "ACTIVADA Y VERIFICADA"]);
    assert.deepEqual(await readdir(desktop), zips);
  });
});

test("candidata preparada y recibo corrupto impiden activar incluso un solo proveedor", async () => {
  await withWorkspace(async (root, desktop) => {
    await assert.rejects(publishIndividualCatalogs({
      workspace: root, providers: ids, dryRun: false, desktopDirectory: desktop,
      activate: async (_workspace, _providerId, _sha, _activate) => { throw new Error("detener antes de activar"); }
    }), /FINISH PARCIAL\/BLOQUEADO/);
    const zip = (await readdir(desktop))[0];
    assert.ok(zip);
    await writeFile(join(desktop, zip), "ZIP CORROMPIDO");
    await assert.rejects(publish(root, desktop), /ZIP individual alterado|ZIP distinto|FINISH PARCIAL/);
    for (const id of ids) await assert.rejects(lstat(join(root, "catalogs", "providers", id, "publications", "active.json")), { code: "ENOENT" });
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
    const finished = await runPublishIndividual([], root, {
      desktopDirectory: desktop, retention: () => { retentionCount++; }, auditor: async () => { auditorCount++; }
    });
    assert.equal(finished?.mode, "complete");
    assert.equal(retentionCount, 1);
    assert.equal(auditorCount, 1);
    const second = await runPublishIndividual([], root, {
      desktopDirectory: desktop, retention: () => { retentionCount++; }, auditor: async () => { auditorCount++; }
    });
    assert.ok(second?.providers.every((item) => item.status === "YA VIGENTE"));
    assert.equal(retentionCount, 2);
    assert.equal(auditorCount, 2);
  });
});

test("diario en symlink o bloqueo existente no admite mutaciones fuera de workspace", async () => {
  await withWorkspace(async (root, desktop) => {
    const folder = join(root, "storage", "publication");
    const outside = join(root, "fuera");
    await mkdir(outside);
    await symlink(outside, folder, "dir");
    await assert.rejects(publish(root, desktop), /Directorio FINISH no regular/);
    await rm(folder);
    assert.deepEqual(await readdir(outside), []);
  });
});
