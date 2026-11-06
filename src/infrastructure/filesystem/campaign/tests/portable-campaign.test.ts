import assert from "node:assert/strict";
import { readFile, readdir, rename, rm, stat, symlink, writeFile } from "node:fs/promises";
import { join } from "node:path";
import test, { after } from "node:test";
import { finalizeActiveCampaign } from "../../../../campaign/finalization.js";
import { approveDraft, createFixture, prefixes } from "../../../../campaign/tests/finalization-fixture.js";
import { reuseCampaignTestFixture } from "../../../../campaign/tests/campaign-catalog-fixture.js";
import { CAMPAIGN_PROVIDERS } from "../../../../contracts/campaign-providers.js";
import { consolidatePortableCampaign, readPortableCampaign } from "../../catalog/portable-campaign.js";

const fixtures = reuseCampaignTestFixture(createFixture);
after(fixtures.close);

test("solo una acreditación aprobada crea una campaña íntegra y portable, sin storage", async () => {
  const data = await fixtures.fixture();
  try {
    const draft = await finalizeActiveCampaign(data.root, false);
    assert.equal(draft.status, "draft");
    await assert.rejects(readPortableCampaign(data.root, data.runId), /ausente/);
    await approveDraft(draft.draftFile);
    assert.equal((await finalizeActiveCampaign(data.root, true)).status, "simulation");
    await assert.rejects(readPortableCampaign(data.root, data.runId), /ausente/);
    assert.equal((await finalizeActiveCampaign(data.root, false)).status, "selected");
    const first = await readPortableCampaign(data.root, data.runId);
    assert.equal(Object.keys(first.files).length, 18);
    assert.equal((await finalizeActiveCampaign(data.root, false)).status, "selected");
    assert.deepEqual(await readPortableCampaign(data.root, data.runId), first);
    await rm(join(data.root, "storage"), { recursive: true, force: true });
    const moved = `${data.root}-moved`;
    await rename(data.root, moved);
    try { assert.deepEqual(await readPortableCampaign(moved, data.runId), first); }
    finally { await rename(moved, data.root); }
  } finally { await data.cleanup(); }
});

test("la campaña portátil detecta alteración de JSON final y no conserva directorios históricos internos", async () => {
  const data = await fixtures.fixture();
  try {
    const draft = await finalizeActiveCampaign(data.root, false);
    await approveDraft(draft.draftFile);
    await finalizeActiveCampaign(data.root, false);
    const base = join(data.root, "catalogs", "campaigns", data.runId);
    assert.deepEqual((await readdir(join(data.root, "catalogs", "campaigns"))).sort(), [data.runId]);
    const file = join(base, "gam", "publishable.json");
    const before = await readFile(file, "utf8");
    await writeFile(file, `${before} `);
    await assert.rejects(readPortableCampaign(data.root, data.runId), /Integridad/);
    await assert.rejects(finalizeActiveCampaign(data.root, false), /Integridad/);
    assert.equal(await readFile(file, "utf8"), `${before} `);
  } finally { await data.cleanup(); }
});

test("las correcciones acreditadas preservan original, derivado y expediente sin storage", async () => {
  const data = await fixtures.fixture();
  try {
    const { campaignScript } = await import("../../../../campaign/tests/finalization-fixture.js");
    const { interveneActiveCampaign } = await import("../../../../campaign/intervention.js");
    const script = await campaignScript(data.root, data.runId);
    const applied = await interveneActiveCampaign(data.root, "gam", [script], true);
    assert.equal(applied.applied, true);
    const draft = await finalizeActiveCampaign(data.root, false);
    await approveDraft(draft.draftFile);
    assert.equal((await finalizeActiveCampaign(data.root, false)).status, "selected");
    const base = join(data.root, "catalogs", "campaigns", data.runId, "gam");
    assert.equal((await readdir(base)).length, 6);
    await rm(join(data.root, "storage"), { recursive: true, force: true });
    await readPortableCampaign(data.root, data.runId);
    const record = join(base, "intervention-record.json");
    const raw = await readFile(record, "utf8");
    await writeFile(record, raw.replace("applied", "tampered"));
    await assert.rejects(readPortableCampaign(data.root, data.runId), /Integridad/);
  } finally { await data.cleanup(); }
});

test("la inspección rechaza directorios simbólicos sin alterar el manifiesto", async () => {
  const data = await fixtures.fixture();
  try {
    const draft = await finalizeActiveCampaign(data.root, false);
    await approveDraft(draft.draftFile);
    await finalizeActiveCampaign(data.root, false);
    const root = join(data.root, "catalogs", "campaigns", data.runId);
    const manifest = join(root, "manifest.json");
    const original = await readFile(manifest, "utf8");
    const outside = join(data.root, "storage", "original-gam");
    await rename(join(root, "gam"), outside);
    await symlink(outside, join(root, "gam"), "dir");
    await assert.rejects(readPortableCampaign(data.root, data.runId), /Directorio no regular/);
    assert.equal(await readFile(manifest, "utf8"), original);
  } finally { await data.cleanup(); }
});

test("rechaza symlink de manifiesto aun cuando apunta a bytes acreditados", async () => {
  const data = await fixtures.fixture();
  try {
    const draft = await finalizeActiveCampaign(data.root, false);
    await approveDraft(draft.draftFile);
    await finalizeActiveCampaign(data.root, false);
    const root = join(data.root, "catalogs", "campaigns", data.runId);
    const manifest = join(root, "manifest.json");
    const outside = join(data.root, "storage", "original-manifest.json");
    await rename(manifest, outside);
    await symlink(outside, manifest, "file");
    await assert.rejects(readPortableCampaign(data.root, data.runId), /Archivo no regular/);
    assert.ok((await stat(outside)).isFile());
  } finally { await data.cleanup(); }
});

test("rechaza rutas fuera de la campaña presentes en un manifiesto manipulado", async () => {
  const data = await fixtures.fixture();
  try {
    const draft = await finalizeActiveCampaign(data.root, false);
    await approveDraft(draft.draftFile);
    await finalizeActiveCampaign(data.root, false);
    const root = join(data.root, "catalogs", "campaigns", data.runId);
    const manifest = await readPortableCampaign(data.root, data.runId);
    const { ["selection.json"]: selectionHash, ...files } = manifest.files;
    assert.ok(selectionHash);
    await writeFile(join(root, "manifest.json"), JSON.stringify({
      ...manifest,
      files: { ...files, "../storage/fuera.json": selectionHash }
    }));
    await assert.rejects(readPortableCampaign(data.root, data.runId), /Manifiesto portátil de campaña inválido/);
    assert.equal((await readdir(root)).length, 7);
  } finally { await data.cleanup(); }
});

test("una consolidación interrumpida limpia el escenario sin exponer una campaña parcial", async () => {
  const data = await fixtures.fixture();
  try {
    const draft = await finalizeActiveCampaign(data.root, false);
    await approveDraft(draft.draftFile);
    const simulation = await finalizeActiveCampaign(data.root, true);
    assert.equal(simulation.status, "simulation");
    assert.ok(simulation.selection);
    const originals = CAMPAIGN_PROVIDERS.map((providerId) => ({
      providerId,
      path: join(data.root, "storage", "scraped", "campaigns", data.runId, providerId,
        `${prefixes[providerId]}-catalog.json`)
    }));
    await rm(join(data.root, "storage", "scraped", "campaigns", data.runId, "gam",
      `${prefixes.gam}-summary.json`));
    await assert.rejects(consolidatePortableCampaign({
      workspace: data.root,
      runId: data.runId,
      selection: simulation.selection,
      accreditationFile: draft.draftFile,
      originals,
      interventions: []
    }), (error: unknown) => error instanceof Error && "code" in error && error.code === "ENOENT");
    assert.deepEqual(await readdir(join(data.root, "catalogs", "campaigns")), []);
    await assert.rejects(readPortableCampaign(data.root, data.runId), /ausente/);
  } finally { await data.cleanup(); }
});
