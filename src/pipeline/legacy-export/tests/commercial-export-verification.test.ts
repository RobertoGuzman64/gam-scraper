import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, rm, writeFile, symlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import type { CommercialExportFile } from "../commercial-export.js";
import { verifyCommercialExportDirectory } from "../commercial-export-verification.js";

const createFile = (name: string, content: string): CommercialExportFile => ({
  name, content, sha256: createHash("sha256").update(content).digest("hex"), bytes: Buffer.byteLength(content)
});

test("verifica todos los archivos exportados sin modificarlos", async () => {
  const directory = await mkdtemp(join(tmpdir(), "equipzilla-commercial-"));
  const files = [createFile("gam-commercial.json", "{}\n"), createFile("commercial-manifest.json", "{\"version\":1}\n")];
  try {
    for (const file of files) await writeFile(join(directory, file.name), file.content);
    assert.deepEqual(await verifyCommercialExportDirectory(directory, files), { files: 2, bytes: files.reduce((total, file) => total + file.bytes, 0) });
    await writeFile(join(directory, files[0]?.name ?? ""), "contenido-adulterado");
    await assert.rejects(verifyCommercialExportDirectory(directory, files), /no coincide con el corte acreditado/);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("rechaza archivos extra, archivos ausentes y enlaces simbólicos", async () => {
  const directory = await mkdtemp(join(tmpdir(), "equipzilla-commercial-"));
  const file = createFile("gam-commercial.json", "{}\n");
  try {
    await assert.rejects(verifyCommercialExportDirectory(directory, [file]), /ausentes/);
    await writeFile(join(directory, file.name), file.content);
    await writeFile(join(directory, "extra.json"), "{}");
    await assert.rejects(verifyCommercialExportDirectory(directory, [file]), /extraños/);
    await rm(join(directory, "extra.json"));
    await rm(join(directory, file.name));
    await symlink(join(directory, "inexistente.json"), join(directory, file.name));
    await assert.rejects(verifyCommercialExportDirectory(directory, [file]), /no regular/);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
