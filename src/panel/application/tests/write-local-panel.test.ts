import assert from "node:assert/strict";
import { cp, mkdir, mkdtemp, readFile, readdir, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { test } from "node:test";
import { readPanelSnapshot } from "../../evidence/read-panel-snapshot.js";
import { writeLocalPanel } from "../write-local-panel.js";

const root = resolve(process.cwd());

test("escribe el panel de forma atómica, evita regeneración idéntica y conserva el anterior ante evidencia dañada", async () => {
  const workspace = await mkdtemp(join(tmpdir(), "eqz-local-panel-"));
  try {
    await cp(join(root, "catalogs"), join(workspace, "catalogs"), { recursive: true });
    const sourceUi = join(workspace, "src", "panel", "ui");
    const compiledUi = join(workspace, "dist", "panel", "ui");
    await mkdir(sourceUi, { recursive: true });
    await mkdir(compiledUi, { recursive: true });
    await cp(join(root, "src", "panel", "ui", "dashboard.css"), join(sourceUi, "dashboard.css"));
    for (const name of ["dashboard-client.js", "explorer-client.js"]) {
      await cp(join(root, "dist", "panel", "ui", name), join(compiledUi, name));
    }
    const output = await writeLocalPanel(workspace);
    const html = await readFile(output, "utf8");
    assert.ok(html.includes("Especificaciones alineadas por campo"));
    assert.ok(html.includes("RESULTADO Y TOMA DE DECISIÓN"));
    assert.equal(output, join(workspace, "panel", "index.html"));
    const first = await stat(output);
    assert.equal(await writeLocalPanel(workspace), output);
    assert.equal((await stat(output)).mtimeMs, first.mtimeMs);
    const snapshot = await readPanelSnapshot(workspace);
    const firstProvider = snapshot.providers[0];
    assert.ok(firstProvider);
    const commercial = join(workspace, firstProvider.commercial.path);
    await writeFile(commercial, (await readFile(commercial, "utf8")) + "\n");
    await assert.rejects(writeLocalPanel(workspace), /SHA256|huella|modificado|incoherente|archivo/iu);
    assert.equal(await readFile(output, "utf8"), html);
    assert.deepEqual((await readdir(join(workspace, "panel"))).sort(), ["index.html"]);
  } finally {
    await rm(workspace, { recursive: true, force: true });
  }
});
