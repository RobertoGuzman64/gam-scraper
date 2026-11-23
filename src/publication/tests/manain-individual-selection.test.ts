import assert from "node:assert/strict";
import { copyFile, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import test from "node:test";
import { runSelectProvider } from "../../cli/commands/catalog/select-provider.js";
import { offlinePreparationManifestPath } from "../../infrastructure/filesystem/preparation/offline-preparation.js";
import { approveIndividualEditorial, decideIndividualEditorial, inspectIndividualEditorial, startIndividualEditorial } from "../individual-editorial.js";
import { readIndividualSelection, selectIndividualPublishable } from "../individual-selection.js";
import { createManainSelectionWorkspace } from "../../testing/builders/manain-individual-selection-fixture.js";


test("Manain: selección verificable de 383 listas y una revisión sin aprobación ni publicación", async () => {
  const { root, source, preparation } = await createManainSelectionWorkspace();
  try {
    const original = await readFile(source);
    const selected = await readIndividualSelection("manain", source, preparation);
    assert.equal(selected.preparation.source.record?.quality, "partial");
    assert.equal(selected.preparation.totals.ready, 383);
    assert.equal(selected.preparation.totals.review, 1);
    assert.equal(selected.sources[0]?.productCount, 384);
    assert.equal(selected.draft.approved, false);
    assert.equal(selected.draft.exclusions.length, 1);
    assert.equal(selected.draft.exclusions[0]?.reference, "MA3727");
    assert.equal(selected.draft.exclusions[0]?.status, "review");
    assert.equal(selected.draft.exclusions[0]?.decision, null);
    await runSelectProvider(["manain", "--source", source, "--preparation", preparation]);
    const approved = { ...selected.draft, approved: true, approvalReason: "Motivo global revisado expresamente" };
    assert.throws(() => selectIndividualPublishable(selected, JSON.stringify(approved)), /decisión ausente o caducada/);
    const unverified = { ...selected, preparation: { ...selected.preparation,
      source: { ...selected.preparation.source, prefix: "origen-no-acreditado" } } };
    assert.throws(() => selectIndividualPublishable(unverified, JSON.stringify(approved)),
      /procedencia parcial no está admitida/);
    assert.deepEqual(await readFile(source), original);
    await assert.rejects(readFile(join(root, "catalogs", "providers", "manain", "publications", "active.json")), { code: "ENOENT" });
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("Manain: selección rechaza ruta de origen ajena y procedencia modificada", async () => {
  const { root, source, preparation } = await createManainSelectionWorkspace();
  try {
    const alternative = join(root, "catalogs", "providers", "manain", "records", "otro-record.json");
    await copyFile(source, alternative);
    await assert.rejects(readIndividualSelection("manain", alternative, preparation), /registro original verificado/);
    const original = await readFile(source, "utf8");
    await writeFile(source, `${original} `);
    await assert.rejects(readIndividualSelection("manain", source, preparation), /Procedencia parcial|no coincide/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("Manain: selección rechaza preparación o manifest manipulados", async () => {
  const { root, source, preparation } = await createManainSelectionWorkspace();
  try {
    const contents = await readFile(preparation, "utf8");
    await writeFile(preparation, `${contents} `);
    await assert.rejects(readIndividualSelection("manain", source, preparation), /Manifest/);
    await writeFile(preparation, contents);
    await writeFile(offlinePreparationManifestPath(preparation), "{}");
    await assert.rejects(readIndividualSelection("manain", source, preparation), /Manifest/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("Manain: admite el registro parcial verificado solo con exclusión y aprobación humana", async () => {
  const { root, source, preparation } = await createManainSelectionWorkspace();
  try {
    const selection = await readIndividualSelection("manain", source, preparation);
    const pending = selection.draft.exclusions[0];
    assert.ok(pending);
    const options = { rootDirectory: root, providerId: "manain", catalogFile: source, preparationFile: preparation };
    await startIndividualEditorial(options);
    await decideIndividualEditorial(options, {
      reference: pending.reference, decision: "excluir",
      reason: "Alcance máximo ambiguo sin equivalencia técnica acreditada",
      evidenceUrls: [pending.sourceUrl]
    });
    const state = await inspectIndividualEditorial(options);
    assert.equal(state.inspection.approved, false);
    assert.equal(state.inspection.completed, 1);
    assert.throws(() => selectIndividualPublishable(selection, JSON.stringify(state.accreditation)), /aprobación ausente/);
    const approved = await approveIndividualEditorial(options, "Aprobación editorial expresamente solicitada");
    assert.equal(approved.inspection.approved, true);
    assert.equal(approved.inspection.completed, 1);
    const published = selectIndividualPublishable(selection, JSON.stringify(approved.accreditation, null, 2));
    assert.equal(published.totals.original, 384);
    assert.equal(published.totals.ready, 383);
    assert.equal(published.totals.review, 1);
    assert.equal(published.totals.publishable, 383);
    assert.equal(published.totals.excluded, 1);
    assert.equal(published.exclusions[0]?.reference, "MA3727");
    assert.ok(!published.products.some((product) => product.reference === "MA3727"));
    assert.equal(published.source[0]?.record?.quality, "partial");
    await assert.rejects(readFile(join(root, "catalogs", "providers", "manain", "publications", "active.json")), { code: "ENOENT" });
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
