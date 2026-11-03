import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { lstat, readFile, readdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import test from "node:test";
import { resolveAccreditedPublication, readAccreditedPublication } from "../../../infrastructure/filesystem/catalog/accredited-publication.js";
import { publicationApprovalSha } from "../../../infrastructure/filesystem/catalog/publication-identity.js";
import { publishIndividualCatalogs } from "../individual-finish.js";
import { createIndividualFinishWorkspace, finishProviders, publishIndividualTestWorkspace } from "../../../testing/builders/individual-finish-fixture.js";

const withWorkspace = createIndividualFinishWorkspace();
const fileSha = async (file: string): Promise<string> => createHash("sha256").update(await readFile(file)).digest("hex");

test("ciclo completo: simular sin escrituras, 3 activaciones, ZIPs, SHA, y repetición idempotente", async () => {
  await withWorkspace(async (root, desktop) => {
    const source = join(root, "catalogs", "providers", "gam", "original", "scrape-gam-catalog.json");
    const sourceSha = await fileSha(source);
    const dry = await publishIndividualCatalogs({ workspace: root, providers: finishProviders, dryRun: true, desktopDirectory: null });
    assert.equal(dry.mode, "simulation");
    assert.equal(dry.providers.length, 3);
    assert.ok(dry.providers.every((item) => item.activeSha256 === null));
    assert.deepEqual(await readdir(desktop), []);
    await assert.rejects(lstat(join(root, "storage", "publication")), { code: "ENOENT" });
    const published = await publishIndividualTestWorkspace(root, desktop);
    assert.equal(published.mode, "complete");
    assert.deepEqual(published.providers.map((item) => item.status), Array(3).fill("ACTIVADA Y VERIFICADA"));
    const zips = await readdir(desktop);
    assert.equal(zips.length, 3);
    const versions: string[] = [];
    for (const id of finishProviders) {
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
    assert.deepEqual(journal.completed, finishProviders);
    const second = await publishIndividualTestWorkspace(root, desktop);
    assert.ok(second.providers.every((item) => item.status === "YA VIGENTE"));
    assert.deepEqual(await readdir(desktop), zips);
    assert.equal(await fileSha(source), sourceSha);
    for (const [index, id] of finishProviders.entries()) {
      const active = await resolveAccreditedPublication(root, id);
      assert.ok(active);
      assert.equal(await publicationApprovalSha(dirname(active)), versions[index]);
    }
  });
});
