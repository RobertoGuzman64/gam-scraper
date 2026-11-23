import assert from "node:assert/strict";
import { copyFile, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import test from "node:test";
import { runSelectProvider } from "../../cli/commands/catalog/select-provider.js";
import { offlinePreparationManifestPath } from "../../infrastructure/filesystem/preparation/offline-preparation.js";
import { approveIndividualEditorial, decideIndividualEditorial, inspectIndividualEditorial, startIndividualEditorial } from "../individual-editorial.js";
import { readIndividualSelection, selectIndividualPublishable } from "../individual-selection.js";
import { createManainSelectionWorkspace } from "../../testing/builders/manain-individual-selection-fixture.js";
import { stageReviewedTestExclusions } from "./stage-reviewed-test-exclusions.js";


test("Manain: selección verificable conserva revisiones sin aprobación ni publicación", async () => {
  const { root, source, preparation } = await createManainSelectionWorkspace();
  try {
    const original = await readFile(source);
    const selected = await readIndividualSelection("manain", source, preparation);
    assert.equal(selected.preparation.source.record?.quality, "partial");
    assert.equal(selected.sources[0]?.productCount, selected.preparation.products.length);
    assert.equal(selected.preparation.totals.ready + selected.preparation.totals.review,
      selected.preparation.products.length);
    assert.equal(selected.draft.approved, false);
    assert.equal(selected.draft.exclusions.length, selected.preparation.totals.review);
    assert.ok(selected.draft.exclusions.every((exclusion) => exclusion.status === "review" && exclusion.decision === null));
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
    const pending = selection.draft.exclusions;
    assert.ok(pending.length > 0);
    const options = { rootDirectory: root, providerId: "manain", catalogFile: source, preparationFile: preparation };
    await startIndividualEditorial(options);
    const first = pending[0];
    assert.ok(first);
    await decideIndividualEditorial(options, {
      reference: first.reference, decision: "excluir",
      reason: "Ficha en revisión técnica sin evidencia suficiente para publicar",
      evidenceUrls: [first.sourceUrl]
    });
    const state = await inspectIndividualEditorial(options);
    assert.equal(state.inspection.approved, false);
    assert.equal(state.inspection.completed, 1);
    assert.throws(() => selectIndividualPublishable(selection, JSON.stringify(state.accreditation)), /aprobación ausente/);
    await stageReviewedTestExclusions(state);
    const approved = await approveIndividualEditorial(options, "Aprobación editorial simulada en prueba aislada");
    assert.equal(approved.inspection.approved, true);
    assert.equal(approved.inspection.completed, pending.length);
    const published = selectIndividualPublishable(selection, JSON.stringify(approved.accreditation, null, 2));
    assert.equal(published.totals.original, selection.preparation.products.length);
    assert.equal(published.totals.ready, selection.preparation.totals.ready);
    assert.equal(published.totals.review, pending.length);
    assert.equal(published.totals.publishable, selection.preparation.totals.ready);
    assert.equal(published.totals.excluded, pending.length);
    assert.ok(pending.every((exclusion) => published.exclusions.some((item) => item.reference === exclusion.reference)));
    assert.ok(published.products.every((product) => !pending.some((item) => item.reference === product.reference)));
    assert.equal(published.source[0]?.record?.quality, "partial");
    await assert.rejects(readFile(join(root, "catalogs", "providers", "manain", "publications", "active.json")), { code: "ENOENT" });
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
