import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import { test } from "node:test";
import { readPanelSnapshot } from "../../panel/evidence/read-panel-snapshot.js";
import { createPanelEvidenceWorkspaceFixture } from "../../testing/builders/panel-evidence-workspace-fixture.js";
import { readPanelExplorer } from "./read-panel-explorer.js";
import { explorerTechnicalEvidenceCachePath } from "./explorer-technical-evidence-cache.js";

const fixture = createPanelEvidenceWorkspaceFixture();

let staticSnapshot: ReturnType<typeof readPanelSnapshot> | undefined;
const readStaticSnapshot = (): ReturnType<typeof readPanelSnapshot> =>
  staticSnapshot ??= fixture.root().then((root) => readPanelSnapshot(root));

test("rechaza evidencias técnicas precalculadas de otro corte y conserva las originales", async () => {
  await fixture.withCopy(async (workspace) => {
    const snapshot = await readStaticSnapshot();
    const target = explorerTechnicalEvidenceCachePath(workspace);
    const original = await readFile(target, "utf8");
    const provider = snapshot.providers[0];
    assert.ok(provider);
    await writeFile(target, original.replace(provider.publication.sha256, "f".repeat(64)));
    await assert.rejects(readPanelExplorer(workspace, snapshot), /precalculadas no corresponden al corte acreditado/);
    await writeFile(target, original);
    const explorer = await readPanelExplorer(workspace, snapshot);
    assert.ok(explorer.products.some((item) => item.specAdditions.some((addition) => addition.kind === "own")));
  });
});

test("rechaza campos obsoletos o ajenos al contrato de clasificaciones", async () => {
  await fixture.withCopy(async (workspace) => {
    const snapshot = await readStaticSnapshot();
    const target = explorerTechnicalEvidenceCachePath(workspace);
    const original = await readFile(target, "utf8");
    assert.ok(original.includes('"version":2'));
    assert.ok(!original.includes('"knowledgeSha256"'));
    assert.ok(!original.includes('"provenance"'));
    for (const mutated of [
      original.replace('"version":2', '"version":1'),
      original.replace('"providers":', '"knowledgeSha256":null,"providers":'),
      original.replace('"additions":', '"provenance":[],"additions":'),
      original.replace('"providers":', '"extra":true,"providers":'),
      original.replace('"additions":', '"extra":true,"additions":'),
      original.replace('"publicationSha256":', '"provenance":{},"publicationSha256":'),
      original.replace('"products":', '"extra":true,"products":'),
      original.replace('"kind":"own"', '"kind":"own","document":{}'),
      original.replace('"kind":"reused"', '"kind":"reused","document":{}')
    ]) {
      assert.notEqual(mutated, original);
      await writeFile(target, mutated);
      await assert.rejects(readPanelExplorer(workspace, snapshot), /precalculadas|inválidos|incompatibles/);
    }
    await writeFile(target, original);
    assert.ok((await readPanelExplorer(workspace, snapshot)).products.some((item) =>
      item.specAdditions.some((addition) => addition.kind === "reused")));
  });
});

test("rechaza relaciones naranjas sin reciprocidad tras retirar el payload documental", async () => {
  await fixture.withCopy(async (workspace) => {
    const snapshot = await readStaticSnapshot();
    const target = explorerTechnicalEvidenceCachePath(workspace);
    const original = await readFile(target, "utf8");
    const altered = original.replace('"linkedMachines":[', '"linkedMachines":["identidad-inexistente",');
    assert.notEqual(altered, original);
    await writeFile(target, altered);
    await assert.rejects(readPanelExplorer(workspace, snapshot), /vínculo editorial recíproco/);
  });
});
