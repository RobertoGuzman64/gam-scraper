import assert from "node:assert/strict";
import { cp, mkdir, readFile, readdir, stat, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { test } from "node:test";
import { readPanelSnapshot } from "../../evidence/read-panel-snapshot.js";
import { writeLocalPanel } from "../write-local-panel.js";
import { createPanelEvidenceWorkspaceFixture } from "../../../testing/builders/panel-evidence-workspace-fixture.js";

const fixture = createPanelEvidenceWorkspaceFixture();

test("escribe el panel de forma atómica, evita regeneración idéntica y conserva el anterior ante evidencia dañada", async () => {
  await fixture.withCopy(async (workspace) => {
    const sourceUi = join(workspace, "src", "panel", "ui");
    const compiledUi = join(workspace, "dist", "panel", "ui");
    const compiledExplorer = join(workspace, "dist", "panel", "explorer");
    await mkdir(sourceUi, { recursive: true });
    await mkdir(compiledUi, { recursive: true });
    await mkdir(compiledExplorer, { recursive: true });
    await cp(join(process.cwd(), "dist", "panel", "explorer", "explorer-selection.js"),
      join(compiledExplorer, "explorer-selection.js"));
    await cp(join(process.cwd(), "src", "panel", "ui", "dashboard.css"), join(sourceUi, "dashboard.css"));
    for (const name of ["dashboard-client.js", "explorer-client.js", "explorer-filter-controls.js", "explorer-stage-cards.js"]) {
      await cp(join(process.cwd(), "dist", "panel", "ui", name), join(compiledUi, name));
    }
    const output = await writeLocalPanel(workspace);
    const html = await readFile(output, "utf8");
    assert.ok(html.includes("Especificaciones alineadas por campo"));
    assert.ok(html.includes("Comparar contenido de la ficha"));
    assert.equal(output, join(workspace, "panel", "index.html"));
    const first = await stat(output);
    assert.equal(await writeLocalPanel(workspace), output);
    assert.equal((await stat(output)).mtimeMs, first.mtimeMs);
    const snapshot = await readPanelSnapshot(workspace);
    const firstProvider = snapshot.providers[0];
    assert.ok(firstProvider);
    const commercial = join(workspace, firstProvider.commercial.path);
    const originalCommercial = await readFile(commercial, "utf8");
    await writeFile(commercial, originalCommercial + "\n");
    await assert.rejects(writeLocalPanel(workspace), /SHA256|huella|modificado|incoherente|archivo/iu);
    assert.equal(await readFile(output, "utf8"), html);
    await writeFile(commercial, originalCommercial);
    const stylesheet = join(sourceUi, "dashboard.css");
    await writeFile(stylesheet, (await readFile(stylesheet, "utf8")) + "</style>");
    await assert.rejects(writeLocalPanel(workspace), /Recursos UI contienen un cierre HTML/);
    assert.equal(await readFile(output, "utf8"), html);
    assert.deepEqual((await readdir(join(workspace, "panel"))).sort(), ["index.html"]);
  });
});
