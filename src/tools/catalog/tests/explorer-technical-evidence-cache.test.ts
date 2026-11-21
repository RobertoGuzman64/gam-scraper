import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import { test } from "node:test";
import { readPanelSnapshot } from "../../../panel/evidence/read-panel-snapshot.js";
import { createPanelEvidenceWorkspaceFixture } from "../../../testing/builders/panel-evidence-workspace-fixture.js";
import { readPanelExplorer } from "../read-panel-explorer.js";
import { explorerTechnicalEvidenceCachePath } from "../explorer-technical-evidence-cache.js";

const fixture = createPanelEvidenceWorkspaceFixture();

test("rechaza evidencias técnicas precalculadas de otro corte y conserva las originales", async () => {
  await fixture.withCopy(async (workspace) => {
    const snapshot = await readPanelSnapshot(workspace);
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
