import assert from "node:assert/strict";
import { cp, mkdir, readFile, readdir, stat, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { test } from "node:test";
import { readPanelSnapshot } from "../../evidence/read-panel-snapshot.js";
import { writeLocalPanel } from "../write-local-panel.js";
import { PANEL_RULE_SOURCE_PATHS } from "../panel-rule-examples.js";
import { createPanelEvidenceWorkspaceFixture } from "../../../testing/builders/panel-evidence-workspace-fixture.js";

const fixture = createPanelEvidenceWorkspaceFixture();

const preparePanelWorkspace = async (workspace: string): Promise<void> => {
  const sourceUi = join(workspace, "src", "panel", "ui");
  const compiledUi = join(workspace, "dist", "panel", "ui");
  const compiledExplorer = join(workspace, "dist", "panel", "explorer");
  await mkdir(sourceUi, { recursive: true });
  await mkdir(compiledUi, { recursive: true });
  await mkdir(compiledExplorer, { recursive: true });
  await cp(join(process.cwd(), "dist", "panel", "explorer"), compiledExplorer, { recursive: true });
  for (const name of ["dashboard.css", "explorer.css", "stage-viewer.css", "explorer-layout.css"]) {
    await cp(join(process.cwd(), "src", "panel", "ui", name), join(sourceUi, name));
  }
  await cp(join(process.cwd(), "dist", "panel", "ui"), compiledUi, { recursive: true });
  for (const sourcePath of PANEL_RULE_SOURCE_PATHS) {
    const destination = join(workspace, sourcePath);
    await mkdir(join(destination, ".."), { recursive: true });
    await cp(join(process.cwd(), sourcePath), destination);
  }
};

test("escribe el panel de forma atómica, evita regeneración idéntica y conserva el anterior ante evidencia dañada", async () => {
  await fixture.withCopy(async (workspace) => {
    await preparePanelWorkspace(workspace);
    const output = await writeLocalPanel(workspace);
    const html = await readFile(output, "utf8");
    assert.ok(html.includes("data:text/javascript;base64,"));
    assert.match(await readFile(join(process.cwd(), "src", "panel", "ui", "explorer-specifications.ts"), "utf8"), /Especificaciones alineadas por campo/);
    assert.match(await readFile(join(process.cwd(), "src", "panel", "ui", "explorer-detail.ts"), "utf8"), /Comparar contenido de la ficha/);
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
    const stylesheet = join(workspace, "src", "panel", "ui", "dashboard.css");
    await writeFile(stylesheet, (await readFile(stylesheet, "utf8")) + "</style>");
    await assert.rejects(writeLocalPanel(workspace), /Recursos UI contienen un cierre HTML/);
    assert.equal(await readFile(output, "utf8"), html);
    assert.deepEqual((await readdir(join(workspace, "panel"))).sort(), ["index.html"]);
  });
});


test("rechaza dependencias no empaquetables y conserva el panel autónomo anterior", async () => {
  await fixture.withCopy(async (workspace) => {
    await preparePanelWorkspace(workspace);
    const output = await writeLocalPanel(workspace);
    const originalHtml = await readFile(output, "utf8");
    const ui = join(workspace, "dist", "panel", "ui");
    const cases = [
      { file: "dashboard-client.js", suffix: '\nconst load = () => import("./dom.js");', error: /Dependencia UI no compatible/ },
      { file: "dashboard-client.js", suffix: '\nexport { create } from "./dom.js";', error: /Dependencia UI no compatible/ },
      { file: "dashboard-client.js", suffix: '\nimport "../../../fuera.js";', error: /Módulo UI fuera del panel/ },
      { file: "dom.js", suffix: '\nimport "./dashboard-client.js";', error: /Importación circular del panel/ }
    ] as const;
    for (const item of cases) {
      const path = join(ui, item.file);
      const original = await readFile(path, "utf8");
      try {
        await writeFile(path, original + item.suffix);
        await assert.rejects(writeLocalPanel(workspace), item.error);
        assert.equal(await readFile(output, "utf8"), originalHtml);
      } finally {
        await writeFile(path, original);
      }
    }
    assert.equal(await writeLocalPanel(workspace), output);
    assert.equal(await readFile(output, "utf8"), originalHtml);
  });
});
