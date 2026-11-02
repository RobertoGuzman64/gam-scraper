import assert from "node:assert/strict";
import { test } from "node:test";
import { mkdtemp, mkdir, readFile, writeFile, rm, readdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createHash } from "node:crypto";
import { consolidateLocalArtifacts, planConsolidation, restoreLocalArtifacts } from "../consolidate-local-artifacts.mjs";

const sha = (text) => createHash("sha256").update(text).digest("hex");
const save = async (root, file, value) => {
  const path = join(root, file);
  await mkdir(join(path, ".."), { recursive: true });
  await writeFile(path, value);
};
const provider = "gam";
const rootFiles = async (root, count) => {
  const preparations = [];
  for (let index = 1; index <= count; index += 1) {
    const id = `catalog-${String(index).padStart(2, "0")}`;
    const text = JSON.stringify({ source: { providerId: provider, prefix: "catalog", scope: "s1", catalogSha256: "a".repeat(64) },
      preparedAt: `2026-11-0${index}T00:00:00.000Z`, products: [], totals: { ready: 0, review: 0 } });
    const digest = sha(text);
    await save(root, `storage/prepared/gam/${id}-preparation.json`, text);
    await save(root, `storage/prepared/gam/${id}-preparation.manifest.json`, JSON.stringify({
      version: 1, providerId: provider, catalogSha256: "a".repeat(64), preparationSha256: digest
    }));
    await save(root, `storage/prepared/gam/${id}-diagnostics.json`, JSON.stringify({
      providerId: provider, totals: { products: 0, ready: 0, review: 0 }
    }));
    preparations.push({ id, digest });
  }
  const publicationIds = [];
  for (const [index, prepared] of preparations.entries()) {
    const accreditation = JSON.stringify({ version: 1, runId: `individual-gam-${index}`, approved: true });
    const approval = sha(accreditation);
    const products = "[]";
    const manifest = { version: 1, providerId: provider, runId: `individual-gam-${index}`,
      preparationSha256: prepared.digest, approvalSha256: approval,
      files: { "gam-publishable.json": sha(products), "accreditation.json": approval } };
    const target = `catalogs/providers/gam/publications/${approval}`;
    await save(root, `${target}/accreditation.json`, accreditation);
    await save(root, `${target}/gam-publishable.json`, products);
    await save(root, `${target}/manifest.json`, JSON.stringify(manifest));
    publicationIds.push(approval);
  }
  await save(root, "catalogs/providers/gam/publications/active.json", JSON.stringify({
    version: 1, providerId: provider, approvalSha256: publicationIds.at(-1)
  }));
  return { preparations, publicationIds };
};

const workspace = async (action) => {
  const parent = await mkdtemp(join(tmpdir(), "ez-retention-"));
  const root = join(parent, "repo");
  const outside = join(parent, "archive");
  await mkdir(root);
  try { await action({ root, outside }); }
  finally { await rm(parent, { recursive: true, force: true }); }
};

test("conserva dos versiones completas y archiva las anteriores con recuperación íntegra", async () => {
  await workspace(async ({ root, outside }) => {
    const { preparations, publicationIds } = await rootFiles(root, 3);
    await save(root, "scripts/tooling.mjs", 'console.log("ESTADO INTACTO");');
    const planned = await planConsolidation(root);
    assert.equal(planned.length, 4);
    const result = await consolidateLocalArtifacts(root, outside);
    assert.equal(result.versions, 4);
    const remaining = (await readdir(join(root, "storage/prepared/gam"))).filter((name) => name.endsWith("-preparation.json"));
    assert.equal(remaining.length, 2);
    const retained = (await readdir(join(root, "catalogs/providers/gam/publications"))).filter((name) => /^[a-f0-9]{64}$/.test(name));
    assert.equal(retained.length, 2);
    assert.ok(retained.includes(publicationIds[2]));
    const manifest = JSON.parse(await readFile(join(outside, "manifest.json"), "utf8"));
    assert.equal(manifest.records.length, 4);
    assert.ok(manifest.records.some((record) => record.path.includes(preparations[0].id)));
    assert.equal(await restoreLocalArtifacts(root, outside), 4);
    assert.equal((await readdir(join(root, "storage/prepared/gam"))).filter((name) => name.endsWith("-preparation.json")).length, 3);
  });
});

test("bloquea la limpieza cuando la publicación activa está fuera de las dos últimas", async () => {
  await workspace(async ({ root }) => {
    const { publicationIds } = await rootFiles(root, 3);
    await save(root, "catalogs/providers/gam/publications/active.json", JSON.stringify({
      version: 1, providerId: provider, approvalSha256: publicationIds[0]
    }));
    await assert.rejects(planConsolidation(root), /vigente no está entre las dos/);
  });
});

test("no admite un destino dentro del repositorio", async () => {
  await workspace(async ({ root }) => {
    await assert.rejects(consolidateLocalArtifacts(root, join(root, "backup")), /fuera del repositorio/);
  });
});

test("segunda consolidación sin excedentes no crea otro archivo externo", async () => {
  await workspace(async ({ root, outside }) => {
    await rootFiles(root, 3);
    await save(root, "scripts/tooling.mjs", 'console.log("ESTADO INTACTO");');
    await consolidateLocalArtifacts(root, outside);
    assert.equal((await planConsolidation(root)).length, 0);
    const second = await consolidateLocalArtifacts(root, join(root, "..", "otro-archivo"));
    assert.equal(second.versions, 0);
    assert.equal(second.destination, null);
  });
});

test("si el estado cambia, revierte todos los movimientos", async () => {
  await workspace(async ({ root, outside }) => {
    await rootFiles(root, 3);
    await save(root, "scripts/tooling.mjs", `import { readdir } from "node:fs/promises";
console.log((await readdir("storage/prepared/gam")).filter((name) => name.endsWith("-preparation.json")).length);`);
    await assert.rejects(consolidateLocalArtifacts(root, outside), /estado operativo cambió/);
    assert.equal((await planConsolidation(root)).length, 4);
    assert.equal((await readdir(join(root, "storage/prepared/gam"))).filter((name) => name.endsWith("-preparation.json")).length, 3);
    await assert.rejects(readFile(join(root, "storage/providers/gam/publication-retention.json")), { code: "ENOENT" });
  });
});

test("no restaura un archivo externo con huellas alteradas", async () => {
  await workspace(async ({ root, outside }) => {
    await rootFiles(root, 3);
    await save(root, "scripts/tooling.mjs", 'console.log("ESTADO INTACTO");');
    await consolidateLocalArtifacts(root, outside);
    await writeFile(join(outside, "storage/prepared/gam/catalog-01-preparation.json"), "CORRUPTO");
    await assert.rejects(restoreLocalArtifacts(root, outside), /Huella diferente/);
    assert.equal((await readdir(join(root, "storage/prepared/gam"))).filter((name) => name.endsWith("-preparation.json")).length, 2);
  });
});
