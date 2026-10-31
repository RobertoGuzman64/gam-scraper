import assert from "node:assert/strict";
import { cp, lstat, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import test, { after } from "node:test";
import { CAMPAIGN_PROVIDERS } from "../../../contracts/campaign-providers.js";
import { discoverAccreditedPublications, readAccreditedPublication, resolveAccreditedPublication } from "../../../infrastructure/filesystem/catalog/accredited-publication.js";
import { readActiveCatalogIndex } from "../../../infrastructure/filesystem/catalog/active-selection.js";
import { inspectPortableInventory } from "../portable-inventory.js";
import { verifyPortableCampaignRetirement } from "../../../infrastructure/filesystem/catalog/portable-campaign.js";
import { selectActiveCampaign } from "../../publication/active-campaign.js";
import { selectActivePublication } from "../../publication/active-publication.js";
import { finalizeActiveCampaign } from "../finalization.js";
import { approveDraft, createFixture } from "./finalization-fixture.js";
import { reuseCampaignTestFixture } from "./campaign-catalog-fixture.js";

const fixtures = reuseCampaignTestFixture(createFixture);
after(fixtures.close);

const approved = async () => fixtures.prepared("campaign-active-approved", async (data) => {
  const draft = await finalizeActiveCampaign(data.root, false);
  await approveDraft(draft.draftFile);
  assert.equal((await finalizeActiveCampaign(data.root, false)).status, "selected");
});

test("la activación global requiere aprobación, es expresa, atómica y reversible", async () => {
  const data = await approved();
  try {
    const first = await selectActiveCampaign(data.root, data.runId);
    assert.equal(first.status, "simulation");
    assert.deepEqual(Object.keys(first.differences).sort(), [...CAMPAIGN_PROVIDERS].sort());
    await assert.rejects(lstat(join(data.root, "catalogs", "active.json")), /ENOENT/);
    assert.equal((await selectActiveCampaign(data.root, data.runId, true)).status, "activated");
    const index = await readActiveCatalogIndex(data.root);
    assert.ok(index);
    assert.equal(Object.keys(index.providers).length, 4);
    const paths = await discoverAccreditedPublications(data.root);
    assert.equal(paths.length, 4);
    const portable = await inspectPortableInventory(data.root, {});
    assert.equal(portable.issues.some((issue) => issue.includes("active.json")), false);
    for (const id of CAMPAIGN_PROVIDERS) {
      const file = await resolveAccreditedPublication(data.root, id);
      assert.equal(file, join(data.root, "catalogs", "campaigns", data.runId, id, "publishable.json"));
      if (!file) throw new Error(`No hay publicación para ${id}`);
      const publication = await readAccreditedPublication(file);
      assert.equal(publication.providerId, id);
      assert.equal(publication.runId, data.runId);
    }
    assert.equal((await selectActiveCampaign(data.root, data.runId, true)).status, "unchanged");
    await assert.rejects(verifyPortableCampaignRetirement(data.root, data.runId, "otro"), /está vigente/);
    assert.equal((await selectActiveCampaign(data.root, data.runId)).status, "simulation");
  } finally { await data.cleanup(); }
});

test("una publicación individual posterior cambia solo su proveedor y puede revertirse globalmente", async () => {
  const data = await approved();
  try {
    await selectActiveCampaign(data.root, data.runId, true);
    const providerId = "gomariz";
    const sha = "1e094214a4a5a6ea4bc8943c5028620bee9359d6c13aff27ec29a62bfbb4d59e";
    const original = resolve("catalogs", "providers", providerId, "publications", sha);
    const destination = join(data.root, "catalogs", "providers", providerId, "publications", sha);
    await mkdir(join(data.root, "catalogs", "providers", providerId, "publications"), { recursive: true });
    await cp(original, destination, { recursive: true });
    const preview = await selectActivePublication(data.root, providerId, sha);
    assert.equal(preview.status, "simulation");
    assert.equal(preview.difference.previous, data.runId);
    assert.equal((await selectActivePublication(data.root, providerId, sha, true)).status, "activated");
    assert.equal((await readActiveCatalogIndex(data.root))?.providers.gomariz?.runId, undefined);
    for (const id of CAMPAIGN_PROVIDERS.filter((item) => item !== providerId)) {
      assert.equal((await readActiveCatalogIndex(data.root))?.providers[id]?.runId, data.runId);
    }
    assert.equal(await resolveAccreditedPublication(data.root, providerId), join(destination, `${providerId}-publishable.json`));
    assert.equal((await selectActiveCampaign(data.root, data.runId, true)).status, "activated");
    assert.equal((await readActiveCatalogIndex(data.root))?.providers.gomariz?.runId, data.runId);
  } finally { await data.cleanup(); }
});

test("alteraciones de campaña e índice, y un bloqueo concurrente impiden activar", async () => {
  const data = await approved();
  try {
    const path = join(data.root, "catalogs", "campaigns", data.runId, "gam", "publishable.json");
    const raw = await readFile(path, "utf8");
    await writeFile(path, `${raw} `);
    await assert.rejects(selectActiveCampaign(data.root, data.runId, true), /Integridad/);
    await writeFile(path, raw);
    const lock = join(data.root, "catalogs", ".active.lock");
    await writeFile(lock, "ocupado", { flag: "wx" });
    await assert.rejects(selectActiveCampaign(data.root, data.runId, true), /Otra activación/);
    await rm(lock);
    await selectActiveCampaign(data.root, data.runId, true);
    const indexFile = join(data.root, "catalogs", "active.json");
    await writeFile(indexFile, JSON.stringify({ version: 1, providers: { gam: { runId: "../../foo", approvalSha256: "f".repeat(64) } } }));
    await assert.rejects(discoverAccreditedPublications(data.root), /Índice global/);
  } finally { await data.cleanup(); }
});

test("dos campañas aprobadas pueden alternarse sin retirar la publicación todavía vigente", async () => {
  const first = await approved();
  const second = await createFixture();
  try {
    const draft = await finalizeActiveCampaign(second.root, false);
    await approveDraft(draft.draftFile);
    assert.equal((await finalizeActiveCampaign(second.root, false)).status, "selected");
    const source = join(second.root, "catalogs", "campaigns", second.runId);
    const destination = join(first.root, "catalogs", "campaigns", second.runId);
    await cp(source, destination, { recursive: true });
    await selectActiveCampaign(first.root, first.runId, true);
    await assert.rejects(verifyPortableCampaignRetirement(first.root, first.runId, second.runId), /está vigente/);
    await selectActiveCampaign(first.root, second.runId, true);
    assert.equal(await verifyPortableCampaignRetirement(first.root, first.runId, second.runId), true);
    assert.equal((await readActiveCatalogIndex(first.root))?.providers.gam?.runId, second.runId);
    await selectActiveCampaign(first.root, first.runId, true);
    assert.equal((await readActiveCatalogIndex(first.root))?.providers.manain?.runId, first.runId);
    await assert.rejects(verifyPortableCampaignRetirement(first.root, first.runId, second.runId), /está vigente/);
  } finally {
    await second.cleanup();
    await first.cleanup();
  }
});
