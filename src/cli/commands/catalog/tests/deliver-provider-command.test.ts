import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";
import { runDeliverProvider } from "../deliver-provider.js";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../../../../..");

test("entregar:proveedor rechaza modos incompatibles sin escribir", async () => {
  const prefix = ["gam", "--source", "origen.json", "--preparation", "preparacion.json"];
  await assert.rejects(runDeliverProvider([...prefix, "--verificar", "--solo-candidata"]), /Uso:/);
  await assert.rejects(runDeliverProvider([...prefix, "--dry-run", "--verificar"]), /Uso:/);
  await assert.rejects(runDeliverProvider([...prefix, "--solo-json", "--solo-json"]), /Uso:/);
  await assert.rejects(runDeliverProvider([...prefix, "--solo-candidata", "--verificar"]), /Uso:/);
});

test("entregar:proveedor libera la terminal tras terminar con recursos ajenos abiertos", () => {
  const temp = mkdtempSync(join(tmpdir(), "equipzilla-entrega-exit-"));
  try {
    const preload = join(temp, "keep-alive.mjs");
    writeFileSync(preload, "setInterval(() => {}, 60000);\n");
    const result = spawnSync(process.execPath, ["--import", pathToFileURL(preload).href,
      join(root, "dist/cli/commands/catalog/deliver-provider.js"), "--help"], {
      cwd: root, windowsHide: true, encoding: "utf8", timeout: 8000
    });
    assert.equal(result.status, 0, result.stderr || result.error?.message);
    assert.match(result.stdout, /--solo-json/);
    assert.match(result.stderr, /cierre controlado/);
  } finally {
    rmSync(temp, { recursive: true, force: true });
  }
});
