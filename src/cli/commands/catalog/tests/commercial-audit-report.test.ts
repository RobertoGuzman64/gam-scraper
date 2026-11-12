import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runCommercialAudit } from "../commercial-audit.js";

test("el comando conserva ayuda y rechazo de opciones inválidas", async () => {
  const output: string[] = [];
  const previous = console.log;
  console.log = (...values: unknown[]) => { output.push(values.map(String).join(" ")); };
  try {
    await runCommercialAudit(["--help"]);
  } finally {
    console.log = previous;
  }
  assert.match(output.join("\n"), /--acreditacion-json/);
  assert.match(output.join("\n"), /--revision prioriza hallazgos/);
  await assert.rejects(() => runCommercialAudit(["--desconocida"]), /Opciones inválidas/);
  await assert.rejects(() => runCommercialAudit(["--json", "--pendientes"]), /Opciones inválidas/);
  await assert.rejects(() => runCommercialAudit(["--atributo=9007199254740992"]), /Opciones inválidas/);
});

test("verificar mantiene el rechazo de manifiestos con entorno inválido", async () => {
  const directory = await mkdtemp(join(tmpdir(), "eqz-commercial-audit-"));
  try {
    await writeFile(join(directory, "commercial-manifest.json"), JSON.stringify({ environment: "staging" }));
    await assert.rejects(() => runCommercialAudit([`--verificar=${directory}`]), /entorno válido/);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
