import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { reuseWorkspaceTestFixture } from "../reusable-workspace-fixture.js";

const createFixture = () => reuseWorkspaceTestFixture(async () => {
  const root = await mkdtemp(join(tmpdir(), "equipzilla-reuse-workspace-"));
  await writeFile(join(root, "estado.txt"), "original");
  return { root, cleanup: () => rm(root, { recursive: true, force: true }) };
});

test("restaura el workspace original después de modificar y eliminar sus archivos", async () => {
  const fixture = createFixture();
  try {
    const first = await fixture.fixture();
    await writeFile(join(first.root, "estado.txt"), "modificado");
    await first.cleanup();
    const restored = await fixture.fixture();
    assert.equal(await readFile(join(restored.root, "estado.txt"), "utf8"), "original");
    await restored.cleanup();
  } finally {
    await fixture.close();
  }
});

test("prepara una sola semilla y aísla las variaciones posteriores", async () => {
  const fixture = createFixture();
  let builds = 0;
  const prepared = () => fixture.prepared("aprobada", async ({ root }) => {
    builds++;
    await writeFile(join(root, "estado.txt"), "aprobado");
  });
  try {
    const first = await prepared();
    assert.equal(await readFile(join(first.root, "estado.txt"), "utf8"), "aprobado");
    await writeFile(join(first.root, "estado.txt"), "alterado");
    await first.cleanup();
    const second = await prepared();
    assert.equal(builds, 1);
    assert.equal(await readFile(join(second.root, "estado.txt"), "utf8"), "aprobado");
    await second.cleanup();
    const original = await fixture.fixture();
    assert.equal(await readFile(join(original.root, "estado.txt"), "utf8"), "original");
    await original.cleanup();
  } finally {
    await fixture.close();
  }
});

test("no admite preparar una variante desde un estado inexistente", async () => {
  const fixture = createFixture();
  try {
    await assert.rejects(fixture.prepared("derivada", async () => undefined, "inexistente"), /no está preparada/);
    await assert.rejects(fixture.prepared("../fuera", async () => undefined), /Nombre de fixture/);
  } finally {
    await fixture.close();
  }
});
