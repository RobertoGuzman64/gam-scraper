import assert from "node:assert/strict";
import { test } from "node:test";
import { mkdtemp, mkdir, readFile, writeFile, rm, readdir, rename, cp, symlink, lstat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, relative, sep } from "node:path";
import { createHash, randomUUID } from "node:crypto";
import { spawnSync } from "node:child_process";
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

const transaction = ".equipzilla-consolidation";
const lock = ".equipzilla-consolidation.lock";
const noResidue = async (root) => {
  for (const path of [transaction, lock]) await assert.rejects(lstat(join(root, path)), { code: "ENOENT" });
};

const legacyArchive = async (root, outside, items) => {
  const records = [];
  const collect = async (path) => {
    const info = await lstat(path);
    if (info.isDirectory()) return (await Promise.all((await readdir(path)).map((name) => collect(join(path, name))))).flat();
    const content = await readFile(path);
    return [{ path: relative(root, path).replaceAll(sep, "/"), size: content.length, sha256: sha(content) }];
  };
  for (const item of items) {
    const source = join(root, item.path);
    const target = join(outside, item.path);
    const type = (await lstat(source)).isDirectory() ? "directory" : "file";
    records.push({ ...item, type, files: await collect(source) });
    await mkdir(join(target, ".."), { recursive: true });
    await cp(source, target, { recursive: true });
  }
  await save(outside, "manifest.json", JSON.stringify({ version: 1, originalRoot: root, records }));
};

const interrupt = (root, source) => {
  const moduleUrl = new URL("../consolidate-local-artifacts.mjs", import.meta.url).href;
  return spawnSync(process.execPath, ["--input-type=module", "-e", `
    import fs from "node:fs/promises";
    import { syncBuiltinESMExports } from "node:module";
    import { join } from "node:path";
    const root = ${JSON.stringify(root)};
    ${source}
    syncBuiltinESMExports();
    const { consolidateLocalArtifacts } = await import(${JSON.stringify(moduleUrl)});
    await consolidateLocalArtifacts(root);
  `], { encoding: "utf8", timeout: 20000 });
};

test("conserva dos versiones completas y elimina las anteriores sin archivo externo", async () => {
  await workspace(async ({ root, outside }) => {
    const { publicationIds } = await rootFiles(root, 3);
    await save(root, "scripts/tooling.mjs", 'console.log("ESTADO INTACTO");');
    const planned = await planConsolidation(root);
    assert.equal(planned.length, 4);
    const result = await consolidateLocalArtifacts(root);
    assert.equal(result.versions, planned.length);
    assert.equal(result.destination, null);
    const remaining = (await readdir(join(root, "storage/prepared/gam"))).filter((name) => name.endsWith("-preparation.json"));
    assert.equal(remaining.length, 2);
    const retained = (await readdir(join(root, "catalogs/providers/gam/publications"))).filter((entry) => /^[a-f0-9]{64}$/.test(entry));
    assert.deepEqual(retained.sort(), publicationIds.slice(1).sort());
    for (const item of planned) await assert.rejects(lstat(join(root, item.path)), { code: "ENOENT" });
    await assert.rejects(lstat(outside), { code: "ENOENT" });
    await noResidue(root);
  });
});

test("restaura archivos externos antiguos sin modificarlos", async () => {
  await workspace(async ({ root, outside }) => {
    await rootFiles(root, 3);
    await save(root, "scripts/tooling.mjs", 'console.log("ESTADO INTACTO");');
    const planned = await planConsolidation(root);
    await legacyArchive(root, outside, planned);
    const manifest = await readFile(join(outside, "manifest.json"));
    await consolidateLocalArtifacts(root);
    assert.equal(await restoreLocalArtifacts(root, outside), planned.length);
    assert.deepEqual(await readFile(join(outside, "manifest.json")), manifest);
    assert.equal((await readdir(join(root, "storage/prepared/gam"))).filter((name) => name.endsWith("-preparation.json")).length, 3);
    await noResidue(root);
  });
});

test("conserva la vigente antigua aunque existan candidatas más recientes", async () => {
  await workspace(async ({ root }) => {
    const { publicationIds } = await rootFiles(root, 3);
    await save(root, "catalogs/providers/gam/publications/active.json", JSON.stringify({
      version: 1, providerId: provider, approvalSha256: publicationIds[0]
    }));
    const planned = await planConsolidation(root);
    assert.equal(planned.length, 0);
    assert.equal((await readdir(join(root, "catalogs/providers/gam/publications"))).filter((name) => /^[a-f0-9]{64}$/.test(name)).length, 3);
  });
});


test("admite y conserva alias de 12 caracteres que coinciden con el SHA completo", async () => {
  await workspace(async ({ root }) => {
    const { publicationIds } = await rootFiles(root, 3);
    const approval = publicationIds[2];
    await rename(join(root, "catalogs/providers/gam/publications", approval),
      join(root, "catalogs/providers/gam/publications", approval.slice(0, 12)));
    await save(root, "scripts/tooling.mjs", 'console.log("ESTADO INTACTO");');
    const planned = await planConsolidation(root);
    assert.equal(planned.length, 4);
    assert.ok(planned.every((item) => !item.path.includes(approval.slice(0, 12))));
    const outcome = await consolidateLocalArtifacts(root);
    assert.equal(outcome.versions, 4);
    const retained = await readdir(join(root, "catalogs/providers/gam/publications"));
    assert.ok(retained.includes(approval.slice(0, 12)));
  });
});

test("detecta colisión de SHA completo y alias sin borrar ninguno", async () => {
  await workspace(async ({ root }) => {
    const { publicationIds } = await rootFiles(root, 3);
    const approval = publicationIds[2];
    const folder = join(root, "catalogs/providers/gam/publications");
    await cp(join(folder, approval), join(folder, approval.slice(0, 12)), { recursive: true });
    await assert.rejects(planConsolidation(root), /Alias de publicación ambiguo/);
    assert.ok((await readdir(folder)).includes(approval));
    assert.ok((await readdir(folder)).includes(approval.slice(0, 12)));
  });
});

test("rechaza acreditación modificada y nombre de publicación irregular", async () => {
  await workspace(async ({ root }) => {
    const { publicationIds } = await rootFiles(root, 3);
    const folder = join(root, "catalogs/providers/gam/publications");
    await writeFile(join(folder, publicationIds[2], "accreditation.json"), "{}");
    await assert.rejects(planConsolidation(root), /Integridad de publicación no acreditada/);
  });
  await workspace(async ({ root }) => {
    const { publicationIds } = await rootFiles(root, 3);
    const folder = join(root, "catalogs/providers/gam/publications");
    await rename(join(folder, publicationIds[2]), join(folder, publicationIds[2].slice(0, 11)));
    await assert.rejects(planConsolidation(root), /Publicación sin clasificar/);
  });
});

test("rechaza enlaces simbólicos a publicaciones antes de proponer la retirada", async () => {
  await workspace(async ({ root }) => {
    const { publicationIds } = await rootFiles(root, 3);
    const folder = join(root, "catalogs/providers/gam/publications");
    await symlink(join(folder, publicationIds[2]), join(folder, "f".repeat(12)), process.platform === "win32" ? "junction" : "dir");
    await assert.rejects(planConsolidation(root), /Publicación sin clasificar/);
  });
});

test("mantiene vigente, anterior y candidatas nuevas sin retirar su preparación", async () => {
  await workspace(async ({ root }) => {
    const { preparations, publicationIds } = await rootFiles(root, 4);
    await save(root, "catalogs/providers/gam/publications/active.json", JSON.stringify({
      version: 1, providerId: provider, approvalSha256: publicationIds[2]
    }));
    await save(root, "scripts/tooling.mjs", 'console.log("ESTADO INTACTO");');
    const planned = await planConsolidation(root);
    assert.equal(planned.length, 4);
    assert.ok(planned.some((entry) => entry.path.includes(publicationIds[0])));
    assert.ok(planned.some((entry) => entry.path.includes(preparations[0].id)));
    assert.ok(planned.every((entry) => !entry.path.includes(publicationIds[3])));
    assert.ok(planned.every((entry) => !entry.path.includes(publicationIds[2])));
    assert.ok(planned.every((entry) => !entry.path.includes(publicationIds[1])));
    await consolidateLocalArtifacts(root);
    const retained = (await readdir(join(root, "catalogs/providers/gam/publications"))).filter((entry) => /^[a-f0-9]{64}$/.test(entry));
    assert.deepEqual(retained.sort(), publicationIds.slice(1).sort());
    const index = JSON.parse(await readFile(join(root, "storage/providers/gam/publication-retention.json"), "utf8"));
    assert.deepEqual(index.publications.map((entry) => entry.approvalSha256), [publicationIds[2], publicationIds[1]]);
  });
});

test("sin preparaciones retira la versión anterior a la anterior mediante selección persistida", async () => {
  await workspace(async ({ root, outside }) => {
    const { publicationIds } = await rootFiles(root, 3);
    await rm(join(root, "storage/prepared/gam"), { recursive: true });
    await save(root, "catalogs/providers/gam/publication-retention.json", JSON.stringify({
      version: 1, providerId: provider, approvalSha256: publicationIds[2], previousSha256: publicationIds[1]
    }));
    await save(root, "scripts/tooling.mjs", 'console.log("ESTADO INTACTO");');
    const planned = await planConsolidation(root);
    assert.deepEqual(planned.map((item) => item.path), [
      `catalogs/providers/gam/publications/${publicationIds[0]}`
    ]);
    await legacyArchive(root, outside, planned);
    await consolidateLocalArtifacts(root);
    const actual = (await readdir(join(root, "catalogs/providers/gam/publications")))
      .filter((entry) => /^[a-f0-9]{64}$/.test(entry));
    assert.deepEqual(actual.sort(), publicationIds.slice(1).sort());
    await restoreLocalArtifacts(root, outside);
    assert.ok((await readdir(join(root, "catalogs/providers/gam/publications"))).includes(publicationIds[0]));
  });
});

test("una selección de retención inconsistente nunca autoriza la eliminación", async () => {
  await workspace(async ({ root }) => {
    const { publicationIds } = await rootFiles(root, 3);
    await rm(join(root, "storage/prepared/gam"), { recursive: true });
    const selection = "catalogs/providers/gam/publication-retention.json";
    await save(root, selection, JSON.stringify({
      version: 1, providerId: provider, approvalSha256: publicationIds[0], previousSha256: publicationIds[1]
    }));
    await assert.rejects(planConsolidation(root), /Índice de retención individual inválido/);
    await save(root, selection, JSON.stringify({
      version: 1, providerId: provider, approvalSha256: publicationIds[2], previousSha256: "a".repeat(64)
    }));
    await assert.rejects(planConsolidation(root), /Índice de retención individual inválido/);
    assert.equal((await readdir(join(root, "catalogs/providers/gam/publications")))
      .filter((entry) => /^[a-f0-9]{64}$/.test(entry)).length, 3);
  });
});

test("sin preparaciones no retira versiones cuyo orden no puede acreditar", async () => {
  await workspace(async ({ root }) => {
    await rootFiles(root, 3);
    await rm(join(root, "storage/prepared/gam"), { recursive: true });
    assert.deepEqual(await planConsolidation(root), []);
  });
});


test("con preparación nueva conserva publicaciones anteriores sin fecha histórica acreditable", async () => {
  await workspace(async ({ root }) => {
    const { preparations, publicationIds } = await rootFiles(root, 3);
    for (const item of preparations.slice(0, 2)) {
      for (const suffix of ["-preparation.json", "-preparation.manifest.json", "-diagnostics.json"]) {
        await rm(join(root, "storage/prepared/gam", `${item.id}${suffix}`));
      }
    }
    await save(root, "scripts/tooling.mjs", 'console.log("ESTADO INTACTO");');
    const planned = await planConsolidation(root);
    assert.deepEqual(planned, []);
    await consolidateLocalArtifacts(root);
    const kept = await readdir(join(root, "catalogs/providers/gam/publications"));
    for (const sha of publicationIds) assert.ok(kept.includes(sha));
    await assert.rejects(readFile(join(root, "storage/providers/gam/publication-retention.json")), { code: "ENOENT" });
  });
});

test("sin fecha de la publicación activa nunca inventa 1970 ni descarta versiones", async () => {
  await workspace(async ({ root }) => {
    const { preparations, publicationIds } = await rootFiles(root, 3);
    for (const item of preparations.slice(0, 2)) {
      for (const suffix of ["-preparation.json", "-preparation.manifest.json", "-diagnostics.json"]) {
        await rm(join(root, "storage/prepared/gam", `${item.id}${suffix}`));
      }
    }
    await save(root, "catalogs/providers/gam/publications/active.json", JSON.stringify({
      version: 1, providerId: "gam", approvalSha256: publicationIds[0]
    }));
    assert.deepEqual(await planConsolidation(root), []);
    assert.ok((await readdir(join(root, "catalogs/providers/gam/publications"))).includes(publicationIds[0]));
  });
});

test("reconcilia referencias históricas ausentes sin conservar publicaciones antiguas", async () => {
  await workspace(async ({ root }) => {
    const { preparations, publicationIds } = await rootFiles(root, 3);
    const path = "storage/providers/gam/publication-retention.json";
    await save(root, path, JSON.stringify({ version: 1, providerId: provider, publications: [{
      approvalSha256: publicationIds[0], preparationSha256: preparations[0].digest,
      preparedAt: "2026-11-01T00:00:00.000Z"
    }, {
      approvalSha256: "f".repeat(64), preparationSha256: "e".repeat(64),
      preparedAt: "2026-10-31T00:00:00.000Z"
    }] }));
    await save(root, "scripts/tooling.mjs", 'console.log("ESTADO INTACTO");');
    assert.equal((await planConsolidation(root)).length, 4);
    await consolidateLocalArtifacts(root);
    const retained = (await readdir(join(root, "catalogs/providers/gam/publications")))
      .filter((name) => /^[a-f0-9]{64}$/.test(name));
    assert.deepEqual(retained.sort(), publicationIds.slice(1).sort());
    const index = JSON.parse(await readFile(join(root, path), "utf8"));
    assert.deepEqual(index.publications.map((item) => item.approvalSha256),
      [publicationIds[2], publicationIds[1]]);
  });
});

test("un índice antiguo no desplaza a la publicación inmediatamente anterior", async () => {
  await workspace(async ({ root }) => {
    const { preparations, publicationIds } = await rootFiles(root, 4);
    const path = "storage/providers/gam/publication-retention.json";
    await save(root, path, JSON.stringify({ version: 1, providerId: provider, publications: [{
      approvalSha256: publicationIds[0], preparationSha256: preparations[0].digest,
      preparedAt: "2026-11-01T00:00:00.000Z"
    }, {
      approvalSha256: publicationIds[1], preparationSha256: preparations[1].digest,
      preparedAt: "2026-11-02T00:00:00.000Z"
    }] }));
    await save(root, "scripts/tooling.mjs", 'console.log("ESTADO INTACTO");');
    await consolidateLocalArtifacts(root);
    const retained = (await readdir(join(root, "catalogs/providers/gam/publications")))
      .filter((name) => /^[a-f0-9]{64}$/.test(name));
    assert.deepEqual(retained.sort(), publicationIds.slice(2).sort());
  });
});

test("bloquea índices de retención corruptos o referencias modificadas", async () => {
  await workspace(async ({ root }) => {
    const { preparations, publicationIds } = await rootFiles(root, 3);
    const path = "storage/providers/gam/publication-retention.json";
    await save(root, path, JSON.stringify({ version: 1, providerId: provider, publications: [{
      approvalSha256: publicationIds[0], preparationSha256: "e".repeat(64),
      preparedAt: "2026-11-01T00:00:00.000Z"
    }] }));
    await assert.rejects(planConsolidation(root), /Índice de retención referencia publicación modificada/);
    await save(root, path, JSON.stringify({ version: 1, providerId: provider, publications: [{
      approvalSha256: "no-es-sha", preparationSha256: preparations[0].digest,
      preparedAt: "2026-11-01T00:00:00.000Z"
    }] }));
    await assert.rejects(planConsolidation(root), /Índice de retención inválido/);
  });
});

test("protege la preparación operativa acreditada aunque no figure entre las dos más recientes del grupo", async () => {
  await workspace(async ({ root }) => {
    const { preparations, publicationIds } = await rootFiles(root, 3);
    const original = JSON.stringify({ providerId: provider, products: [] });
    const originalSha = sha(original);
    await save(root, "storage/scraped/gam/catalog-catalog.json", original);
    const product = { providerId: provider, sourceUrl: "https://example.org/catalogo/1", reference: "1",
      title: "Máquina", categorySellID: null, category: null, condition: null, price: null,
      description_title: null, description: null, description_general: null, images: [], attributes: [] };
    for (let index = 0; index < preparations.length; index += 1) {
      const entry = preparations[index];
      const id = entry.id;
      const preparation = {
        version: 1, quality: "complete", published: true,
        preparedAt: `2026-11-0${index + 1}T00:00:00.000Z`,
        source: { providerId: provider, prefix: "catalog", scope: "0".repeat(16),
          catalogSha256: originalSha, productCount: 1 },
        fingerprints: { rulesVersion: 2, rulesSha256: "b".repeat(64) },
        identities: ["gam:ref:1"], products: [{ status: "ready", issues: [], product }],
        totals: { ready: 1, review: 0 }
      };
      const body = JSON.stringify(preparation);
      const digest = sha(body);
      await save(root, `storage/prepared/gam/${id}-preparation.json`, body);
      await save(root, `storage/prepared/gam/${id}-preparation.manifest.json`, JSON.stringify({
        version: 1, providerId: provider, catalogSha256: originalSha, preparationSha256: digest
      }));
      await save(root, `storage/prepared/gam/${id}-diagnostics.json`, JSON.stringify({
        providerId: provider, totals: { products: 1, ready: 1, review: 0 }
      }));
      const manifestPath = `catalogs/providers/gam/publications/${publicationIds[index]}/manifest.json`;
      const manifest = JSON.parse(await readFile(join(root, manifestPath), "utf8"));
      await save(root, manifestPath, JSON.stringify({ ...manifest, preparationSha256: digest }));
      if (index > 0) {
        for (const suffix of ["-preparation.json", "-preparation.manifest.json", "-diagnostics.json"]) {
          await rename(join(root, `storage/prepared/gam/${id}${suffix}`),
            join(root, `storage/prepared/gam/archivo-0${index + 1}${suffix}`));
        }
      }
    }
    await save(root, "scripts/tooling.mjs", `import { readdir } from "node:fs/promises";
const files = await readdir("storage/prepared/gam");
console.log(files.includes("catalog-01-preparation.json")
  ? "PASS |   PREPARACIÓN | CORRECTO | Preparación acreditada (1 Ready / 0 Review)"
  : "WARN |   PREPARACIÓN | PARCIAL | Preparación heredada disponible; no acreditada como preparación offline");`);
    const planned = await planConsolidation(root);
    assert.ok(planned.every((item) => !item.path.includes("catalog-01")));
    assert.ok(planned.some((item) => item.path.includes("catalogs/providers/gam/publications/")));
    await consolidateLocalArtifacts(root);
    const remaining = await readdir(join(root, "storage/prepared/gam"));
    assert.ok(remaining.includes("catalog-01-preparation.json"));
    const retained = (await readdir(join(root, "catalogs/providers/gam/publications")))
      .filter((name) => /^[a-f0-9]{64}$/.test(name));
    assert.deepEqual(retained.sort(), publicationIds.slice(1).sort());
  });
});

test("bloquea una consolidación concurrente sin tocar los candidatos", async () => {
  await workspace(async ({ root }) => {
    await rootFiles(root, 3);
    const owner = `${process.pid}-${randomUUID()}`;
    await save(root, `${lock}/${owner}`, "");
    await assert.rejects(consolidateLocalArtifacts(root), /Consolidación concurrente/);
    assert.equal((await planConsolidation(root)).length, 4);
    assert.deepEqual(await readdir(join(root, lock)), [owner]);
  });
});

test("segunda consolidación sin excedentes no crea otro archivo externo", async () => {
  await workspace(async ({ root }) => {
    await rootFiles(root, 3);
    await save(root, "scripts/tooling.mjs", 'console.log("ESTADO INTACTO");');
    await consolidateLocalArtifacts(root);
    assert.equal((await planConsolidation(root)).length, 0);
    const second = await consolidateLocalArtifacts(root);
    assert.equal(second.versions, 0);
    assert.equal(second.destination, null);
    await noResidue(root);
  });
});

test("si el estado cambia, revierte todos los movimientos", async () => {
  await workspace(async ({ root }) => {
    await rootFiles(root, 3);
    await save(root, "scripts/tooling.mjs", `import { readdir } from "node:fs/promises";
console.log((await readdir("storage/prepared/gam")).filter((name) => name.endsWith("-preparation.json")).length);`);
    await assert.rejects(consolidateLocalArtifacts(root), /estado operativo cambió/);
    assert.equal((await planConsolidation(root)).length, 4);
    assert.equal((await readdir(join(root, "storage/prepared/gam"))).filter((name) => name.endsWith("-preparation.json")).length, 3);
    await assert.rejects(readFile(join(root, "storage/providers/gam/publication-retention.json")), { code: "ENOENT" });
    await noResidue(root);
  });
});

test("no restaura un archivo externo con huellas alteradas", async () => {
  await workspace(async ({ root, outside }) => {
    await rootFiles(root, 3);
    await save(root, "scripts/tooling.mjs", 'console.log("ESTADO INTACTO");');
    await legacyArchive(root, outside, await planConsolidation(root));
    await consolidateLocalArtifacts(root);
    await writeFile(join(outside, "storage/prepared/gam/catalog-01-preparation.json"), "CORRUPTO");
    await assert.rejects(restoreLocalArtifacts(root, outside), /Huella diferente/);
    assert.equal((await readdir(join(root, "storage/prepared/gam"))).filter((name) => name.endsWith("-preparation.json")).length, 2);
  });
});

test("admite cambios de cifras entre preparaciones acreditadas sin degradar su estado", async () => {
  await workspace(async ({ root }) => {
    await rootFiles(root, 3);
    await save(root, "scripts/tooling.mjs", `import { readdir } from "node:fs/promises";
const count = (await readdir("storage/prepared/gam")).filter((name) => name.endsWith("-preparation.json")).length;
console.log("PASS |   PREPARACIÓN | CORRECTO | Preparación acreditada (" + count + " Ready / 0 Review)");`);
    const result = await consolidateLocalArtifacts(root);
    assert.equal(result.versions, 4);
    assert.equal((await readdir(join(root, "storage/prepared/gam"))).filter((name) => name.endsWith("-preparation.json")).length, 2);
  });
});

test("revierte la consolidación si una preparación deja de estar acreditada", async () => {
  await workspace(async ({ root }) => {
    await rootFiles(root, 3);
    await save(root, "scripts/tooling.mjs", `import { readdir } from "node:fs/promises";
const count = (await readdir("storage/prepared/gam")).filter((name) => name.endsWith("-preparation.json")).length;
console.log(count === 3
  ? "PASS |   PREPARACIÓN | CORRECTO | Preparación acreditada (3 Ready / 0 Review)"
  : "WARN |   PREPARACIÓN | PARCIAL | Preparación heredada disponible");`);
    await assert.rejects(consolidateLocalArtifacts(root), /estado operativo cambió/);
    assert.equal((await readdir(join(root, "storage/prepared/gam"))).filter((name) => name.endsWith("-preparation.json")).length, 3);
  });
});

test("retira una extracción vacía sin exigir que siga figurando como parcial", async () => {
  await workspace(async ({ root }) => {
    await rootFiles(root, 3);
    await save(root, "storage/scraped/mercaeleva/scrape-mercaeleva-summary.json", JSON.stringify({
      quality: { status: "blocked", published: false }, totals: { scrapedProducts: 0 }
    }));
    await save(root, "scripts/tooling.mjs", `import { existsSync } from "node:fs";
console.log("  MERCAELEVA");
if (existsSync("storage/scraped/mercaeleva/scrape-mercaeleva-summary.json")) {
  console.log("WARN |   ORIGINAL OPERATIVO | PARCIAL | Extracción parcial conservada; CSV coincide con el resumen");
  console.log("WARN |   PREPARACIÓN | PARCIAL | Preparación heredada disponible; no acreditada como preparación offline");
} else {
  console.log("    ORIGINAL OPERATIVO | AUSENTE | Sin extracción conservada");
  console.log("    PREPARACIÓN | AUSENTE | Sin preparación conservada");
}
console.log("PASS |   JSON FINAL | CORRECTO | Publicación vigente");`);
    const result = await consolidateLocalArtifacts(root);
    assert.equal(result.versions, 5);
    assert.equal((await readdir(join(root, "storage/prepared/gam"))).filter((name) => name.endsWith("-preparation.json")).length, 2);
    await assert.rejects(readFile(join(root, "storage/scraped/mercaeleva/scrape-mercaeleva-summary.json")), { code: "ENOENT" });
  });
});

test("retira una extracción vacía de Manain sin bloquear el estado parcial anterior", async () => {
  await workspace(async ({ root }) => {
    await rootFiles(root, 3);
    await save(root, "storage/scraped/manain/prueba-manain-summary.json", JSON.stringify({
      quality: { status: "blocked", published: false }, totals: { scrapedProducts: 0 }
    }));
    await save(root, "storage/scraped/manain/prueba-manain-partial-all.csv", "referencia\n");
    await save(root, "scripts/tooling.mjs", `import { existsSync } from "node:fs";
console.log("  MANAIN");
if (existsSync("storage/scraped/manain/prueba-manain-summary.json")) {
  console.log("WARN |   ORIGINAL OPERATIVO | PARCIAL | Extracción parcial conservada; CSV coincide con el resumen");
  console.log("WARN |   PREPARACIÓN | PARCIAL | Preparación heredada disponible; no acreditada como preparación offline");
} else {
  console.log("    ORIGINAL OPERATIVO | AUSENTE | Sin extracción conservada");
  console.log("    PREPARACIÓN | AUSENTE | Sin preparación conservada");
}
console.log("PASS |   JSON FINAL | CORRECTO | Publicación vigente");`);
    const result = await consolidateLocalArtifacts(root);
    assert.equal(result.versions, 6);
    await assert.rejects(readFile(join(root, "storage/scraped/manain/prueba-manain-summary.json")), { code: "ENOENT" });
    await assert.rejects(readFile(join(root, "storage/scraped/manain/prueba-manain-partial-all.csv")), { code: "ENOENT" });
    assert.equal((await readdir(join(root, "catalogs/providers/gam/publications"))).filter((entry) => /^[a-f0-9]{64}$/.test(entry)).length, 2);
  });
});

test("identifica la primera diferencia operativa no autorizada sin borrar históricos", async () => {
  await workspace(async ({ root }) => {
    await rootFiles(root, 3);
    await save(root, "scripts/tooling.mjs", `import { readdir } from "node:fs/promises";
const count = (await readdir("catalogs/providers/gam/publications")).filter((name) => name !== "active.json").length;
console.log("PUBLICACIONES VIGENTES: " + count);`);
    await assert.rejects(consolidateLocalArtifacts(root), /estado operativo cambió.*Línea 1: antes/);
    assert.equal((await readdir(join(root, "catalogs/providers/gam/publications"))).filter((entry) => /^[a-f0-9]{64}$/.test(entry)).length, 3);
  });
});

test("no permite perder una publicación al descartar una extracción vacía", async () => {
  await workspace(async ({ root }) => {
    await rootFiles(root, 3);
    await save(root, "storage/scraped/mercaeleva/scrape-mercaeleva-summary.json", JSON.stringify({
      quality: { status: "blocked", published: false }, totals: { scrapedProducts: 0 }
    }));
    await save(root, "scripts/tooling.mjs", `import { existsSync } from "node:fs";
console.log("  MERCAELEVA");
console.log(existsSync("storage/scraped/mercaeleva/scrape-mercaeleva-summary.json")
  ? "PASS |   JSON FINAL | CORRECTO | Publicación vigente"
  : "    JSON FINAL | AUSENTE | Sin publicación");`);
    await assert.rejects(consolidateLocalArtifacts(root), /estado operativo cambió/);
    assert.equal((await readFile(join(root, "storage/scraped/mercaeleva/scrape-mercaeleva-summary.json"), "utf8")).includes("blocked"), true);
  });
});


test("una interrupción después de mover un histórico recupera la transacción antes de reintentar", async () => {
  await workspace(async ({ root }) => {
    await rootFiles(root, 3);
    await save(root, "scripts/tooling.mjs", 'console.log("ESTADO INTACTO");');
    const planned = await planConsolidation(root);
    const child = interrupt(root, `
      const original = fs.rename;
      fs.rename = async (from, to) => {
        await original(from, to);
        if (to.startsWith(join(root, ".equipzilla-consolidation", "files"))) process.exit(77);
      };
    `);
    assert.equal(child.status, 77, child.stderr);
    const journal = JSON.parse(await readFile(join(root, transaction, "manifest.json"), "utf8"));
    assert.equal(journal.state, "pending");
    assert.equal((await consolidateLocalArtifacts(root)).versions, planned.length);
    await noResidue(root);
    assert.deepEqual(await planConsolidation(root), []);
  });
});

test("una interrupción después de actualizar índices revierte y comprueba el estado antes de reintentar", async () => {
  await workspace(async ({ root }) => {
    await rootFiles(root, 3);
    const index = "storage/providers/gam/publication-retention.json";
    const initial = JSON.stringify({ version: 1, providerId: provider, publications: [] });
    await save(root, index, initial);
    await save(root, "scripts/tooling.mjs", 'console.log("ESTADO INTACTO");');
    const child = interrupt(root, `
      const original = fs.rename;
      fs.rename = async (from, to) => {
        await original(from, to);
        if (to === join(root, "storage/providers/gam/publication-retention.json")) process.exit(77);
      };
    `);
    assert.equal(child.status, 77, child.stderr);
    assert.notEqual(await readFile(join(root, index), "utf8"), initial);
    const next = interrupt(root, `
      const original = fs.rename;
      fs.rename = async (from, to) => {
        await original(from, to);
        if (to === join(root, "storage/providers/gam/publication-retention.json")) process.exit(78);
      };
    `);
    assert.equal(next.status, 78, next.stderr);
    assert.equal(await readFile(join(root, index), "utf8"), initial);
    assert.equal((await planConsolidation(root)).length, 4);
    assert.equal((await consolidateLocalArtifacts(root)).versions, 4);
    await noResidue(root);
  });
});

test("una retirada confirmada reanuda el borrado parcial sin restaurar históricos", async () => {
  await workspace(async ({ root }) => {
    await rootFiles(root, 3);
    await save(root, "scripts/tooling.mjs", 'console.log("ESTADO INTACTO");');
    const planned = await planConsolidation(root);
    const child = interrupt(root, `
      const original = fs.rm;
      fs.rm = async (path, options) => {
        if (path === join(root, ".equipzilla-consolidation", "files")) {
          const journal = JSON.parse(await fs.readFile(join(root, ".equipzilla-consolidation", "manifest.json"), "utf8"));
          await original(join(path, journal.records[0].files[0].path));
          throw new Error("borrado interrumpido");
        }
        return original(path, options);
      };
    `);
    assert.equal(child.status, 1, child.stderr);
    assert.match(child.stderr, /eliminación definitiva pendiente/);
    const journal = JSON.parse(await readFile(join(root, transaction, "manifest.json"), "utf8"));
    assert.equal(journal.state, "committed");
    for (const item of planned) await assert.rejects(lstat(join(root, item.path)), { code: "ENOENT" });
    assert.equal((await consolidateLocalArtifacts(root)).versions, planned.length);
    await noResidue(root);
    assert.deepEqual(await planConsolidation(root), []);
  });
});

test("bloquea la recuperación si los datos transitorios fueron alterados", async () => {
  await workspace(async ({ root }) => {
    await rootFiles(root, 3);
    await save(root, "scripts/tooling.mjs", 'console.log("ESTADO INTACTO");');
    const child = interrupt(root, `
      const original = fs.rename;
      fs.rename = async (from, to) => {
        await original(from, to);
        if (to.startsWith(join(root, ".equipzilla-consolidation", "files"))) process.exit(77);
      };
    `);
    assert.equal(child.status, 77, child.stderr);
    const journal = JSON.parse(await readFile(join(root, transaction, "manifest.json"), "utf8"));
    const path = join(root, transaction, "files", journal.records[0].files[0].path);
    await writeFile(path, "alterado");
    await assert.rejects(consolidateLocalArtifacts(root), /Huella diferente/);
    assert.equal(await readFile(path, "utf8"), "alterado");
    assert.equal((await readdir(join(root, "catalogs/providers/gam/publications"))).includes("active.json"), true);
  });
});


test("bloquea el cambio concurrente de selección y recupera los históricos sin pisar la selección nueva", async () => {
  await workspace(async ({ root }) => {
    const { publicationIds } = await rootFiles(root, 3);
    const selected = "catalogs/providers/gam/publications/active.json";
    const replacement = JSON.stringify({ version: 1, providerId: provider, approvalSha256: publicationIds[0] });
    await save(root, "scripts/tooling.mjs", `import { existsSync, writeFileSync } from "node:fs";
if (!existsSync("storage/prepared/gam/catalog-01-preparation.json")) writeFileSync(${JSON.stringify(selected)}, ${JSON.stringify(replacement)});
console.log("ESTADO INTACTO");`);
    const planned = await planConsolidation(root);
    await assert.rejects(consolidateLocalArtifacts(root), /Selecciones de publicación modificadas concurrentemente/);
    for (const item of planned) await lstat(join(root, item.path));
    assert.equal(await readFile(join(root, selected), "utf8"), replacement);
    await noResidue(root);
  });
});

test("bloquea directorios antecesores enlazados fuera del repositorio", async () => {
  await workspace(async ({ root, outside }) => {
    await rootFiles(root, 3);
    const source = join(root, "storage", "prepared");
    await rename(source, outside);
    await symlink(outside, source, process.platform === "win32" ? "junction" : "dir");
    await assert.rejects(consolidateLocalArtifacts(root), /Directorio no regular/);
    assert.equal((await readdir(join(outside, provider))).length, 9);
    await noResidue(root);
  });
});
