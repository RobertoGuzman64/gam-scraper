import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { retainRepositoryArtifact } from "../repository-artifact-snapshot.js";

const hash = (text: string): string => createHash("sha256").update(text).digest("hex");

const workspace = async (task: (root: string) => Promise<void>): Promise<void> => {
  const root = await mkdtemp(join(tmpdir(), "eqz-artifacts-"));
  try { await task(root); }
  finally { await rm(root, { recursive: true, force: true }); }
};

test("retiene activa y anterior tras tres cortes sin alterar los originales", async () => {
  await workspace(async (root) => {
    const directory = join(root, "catalogs", "commercial", "develop");
    const values = ["one", "two", "three"];
    for (const value of values) {
      const files = [{ name: "commercial-manifest.json", content: value },
        { name: "gam-commercial.json", content: `datos: ${value}` }];
      assert.equal(await retainRepositoryArtifact(directory, "commercial-manifest.json", files), hash(value));
    }
    const selection = JSON.parse(await readFile(join(directory, "active.json"), "utf8")) as {
      sha256: string; previousSha256: string | null;
    };
    assert.equal(selection.sha256, hash("three"));
    assert.equal(selection.previousSha256, hash("two"));
    assert.deepEqual((await readdir(join(directory, "versions"))).sort(), [hash("two"), hash("three")].sort());
    assert.equal(await readFile(join(directory, "versions", hash("two"), "gam-commercial.json"), "utf8"), "datos: two");
    await retainRepositoryArtifact(directory, "commercial-manifest.json", [
      { name: "commercial-manifest.json", content: "three" },
      { name: "gam-commercial.json", content: "datos: three" }
    ]);
    assert.deepEqual((await readdir(join(directory, "versions"))).sort(), [hash("two"), hash("three")].sort());
  });
});

test("rechaza colisiones, directorios incompletos y selección manipulada sin borrar históricos", async () => {
  await workspace(async (root) => {
    const directory = join(root, "catalogs", "reports", "individual-finish");
    const files = [{ name: "INFORME.txt", content: "informe real" }];
    await retainRepositoryArtifact(directory, "INFORME.txt", files);
    await assert.rejects(retainRepositoryArtifact(directory, "INFORME.txt", [
      ...files, { name: "extra.json", content: "{}" }
    ]), /incompletos o inesperados/);
    await writeFile(join(directory, "active.json"), JSON.stringify({
      version: 1, sha256: "f".repeat(64), previousSha256: null
    }));
    await assert.rejects(retainRepositoryArtifact(directory, "INFORME.txt", files), /sin selección verificable/);
    assert.deepEqual(await readdir(join(directory, "versions")), [hash("informe real")]);
  });
});
