import { createPortableTestSymlink } from "../../../testing/builders/portable-symlink-fixture.js";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { checkHistoricalReferenceIntegrity } from "../legacy-export/reference-integrity.js";

const digest = (value: string): string => createHash("sha256").update(value).digest("hex");

test("detecta discrepancias de manifiesto sin reescribir contratos comerciales", async (t) => {
  const root = await mkdtemp(join(tmpdir(), "equipzilla-reference-integrity-"));
  try {
    const directory = join(root, "data", "commercial-reference");
    await mkdir(directory, { recursive: true });
    const expected = "datos acreditados";
    const original = "datos actualizados";
    const source = join(directory, "logo.json");
    await writeFile(source, original);
    const manifest = join(directory, "source-manifest.json");
    const contents = JSON.stringify({ fileSha256: { "data/commercial-reference/logo.json": digest(expected) } });
    await writeFile(manifest, contents);
    const mismatches = await checkHistoricalReferenceIntegrity(root);
    assert.deepEqual(mismatches, [{ path: "data/commercial-reference/logo.json", expectedSha256: digest(expected), actualSha256: digest(original) }]);
    assert.equal(await readFile(source, "utf8"), original);
    assert.equal(await readFile(manifest, "utf8"), contents);
    await writeFile(source, expected);
    assert.deepEqual(await checkHistoricalReferenceIntegrity(root), []);
    await rm(source);
    if (!(await createPortableTestSymlink(t, manifest, source))) return;
    assert.deepEqual(await checkHistoricalReferenceIntegrity(root), [{ path: "data/commercial-reference/logo.json", expectedSha256: digest(expected), actualSha256: null }]);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test("no inspecciona rutas fuera de data ni acepta hashes mal formados", async (t) => {
  const root = await mkdtemp(join(tmpdir(), "equipzilla-reference-manifest-"));
  try {
    const directory = join(root, "data", "commercial-reference");
    await mkdir(directory, { recursive: true });
    const manifest = join(directory, "source-manifest.json");
    for (const path of ["../../../archivo-ajeno", "data/../archivo-ajeno"]) {
      await writeFile(manifest, JSON.stringify({ fileSha256: { [path]: digest("dato") } }));
      await assert.rejects(checkHistoricalReferenceIntegrity(root), /Archivo o huella inválidos/);
    }
    await writeFile(manifest, JSON.stringify({ fileSha256: { "data/commercial-reference/logo.json": "no-es-un-hash" } }));
    await assert.rejects(checkHistoricalReferenceIntegrity(root), /Archivo o huella inválidos/);
    const outside = join(root, "outside");
    await mkdir(outside);
    await writeFile(join(outside, "archivo.json"), "datos externos");
    if (!(await createPortableTestSymlink(t, outside, join(directory, "linked")))) return;
    await writeFile(manifest, JSON.stringify({ fileSha256: { "data/commercial-reference/linked/archivo.json": digest("datos externos") } }));
    await assert.rejects(checkHistoricalReferenceIntegrity(root), /fuera de data/);
  } finally { await rm(root, { recursive: true, force: true }); }
});
