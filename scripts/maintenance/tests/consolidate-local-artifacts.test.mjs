import assert from "node:assert/strict";
import { test } from "node:test";
import { mkdtemp, mkdir, readFile, writeFile, rm, readdir, rename, cp, symlink } from "node:fs/promises";
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
    const text = JSON.stringify({
      source: { providerId: provider, prefix: "catalog", scope: "s1", catalogSha256: "a".repeat(64) },
      preparedAt: `2026-11-0${index}T00:00:00.000Z`, products: [], totals: { ready: 0, review: 0 }
    });
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
    const manifest = {
      version: 1, providerId: provider, runId: `individual-gam-${index}`,
      preparationSha256: prepared.digest, approvalSha256: approval,
      files: { "gam-publishable.json": sha(products), "accreditation.json": approval }
    };
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
  await workspace(async ({ root, outside }) => {
    const { publicationIds } = await rootFiles(root, 3);
    const approval = publicationIds[2];
    await rename(join(root, "catalogs/providers/gam/publications", approval),
      join(root, "catalogs/providers/gam/publications", approval.slice(0, 12)));
    await save(root, "scripts/tooling.mjs", 'console.log("ESTADO INTACTO");');
    const planned = await planConsolidation(root);
    assert.equal(planned.length, 4);
    assert.ok(planned.every((item) => !item.path.includes(approval.slice(0, 12))));
    const outcome = await consolidateLocalArtifacts(root, outside);
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

test("rechaza enlaces simbólicos a publicaciones antes de proponer el archivado", {
  skip: process.platform === "win32" ? "Windows: la creación de enlaces simbólicos puede requerir privilegios especiales" : false
}, async () => {
  await workspace(async ({ root }) => {
    const { publicationIds } = await rootFiles(root, 3);
    const folder = join(root, "catalogs/providers/gam/publications");
    await symlink(join(folder, publicationIds[2]), join(folder, "f".repeat(12)), "dir");
    await assert.rejects(planConsolidation(root), /Publicación sin clasificar/);
  });
});

test("mantiene vigente, anterior y candidatas nuevas sin archivar su preparación", async () => {
  await workspace(async ({ root, outside }) => {
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
    await consolidateLocalArtifacts(root, outside);
    const retained = (await readdir(join(root, "catalogs/providers/gam/publications"))).filter((entry) => /^[a-f0-9]{64}$/.test(entry));
    assert.deepEqual(retained.sort(), publicationIds.slice(1).sort());
    const index = JSON.parse(await readFile(join(root, "storage/providers/gam/publication-retention.json"), "utf8"));
    assert.deepEqual(index.publications.map((entry) => entry.approvalSha256), [publicationIds[2], publicationIds[1]]);
  });
});

test("sin preparaciones no archiva versiones cuyo orden no puede acreditar", async () => {
  await workspace(async ({ root }) => {
    await rootFiles(root, 3);
    await rm(join(root, "storage/prepared/gam"), { recursive: true });
    assert.deepEqual(await planConsolidation(root), []);
  });
});


test("con preparación nueva conserva publicaciones anteriores sin fecha histórica acreditable", async () => {
  await workspace(async ({ root, outside }) => {
    const { preparations, publicationIds } = await rootFiles(root, 3);
    for (const item of preparations.slice(0, 2)) {
      for (const suffix of ["-preparation.json", "-preparation.manifest.json", "-diagnostics.json"]) {
        await rm(join(root, "storage/prepared/gam", `${item.id}${suffix}`));
      }
    }
    await save(root, "scripts/tooling.mjs", 'console.log("ESTADO INTACTO");');
    const planned = await planConsolidation(root);
    assert.deepEqual(planned, []);
    await consolidateLocalArtifacts(root, outside);
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

test("reconcilia referencias históricas ausentes y conserva las dos últimas publicaciones", async () => {
  await workspace(async ({ root, outside }) => {
    const { preparations, publicationIds } = await rootFiles(root, 3);
    const path = "storage/providers/gam/publication-retention.json";
    await save(root, path, JSON.stringify({
      version: 1, providerId: provider, publications: [{
        approvalSha256: publicationIds[0], preparationSha256: preparations[0].digest,
        preparedAt: "2026-11-01T00:00:00.000Z"
      }, {
        approvalSha256: "f".repeat(64), preparationSha256: "e".repeat(64),
        preparedAt: "2026-10-31T00:00:00.000Z"
      }]
    }));
    await save(root, "scripts/tooling.mjs", 'console.log("ESTADO INTACTO");');
    assert.equal((await planConsolidation(root)).length, 4);
    await consolidateLocalArtifacts(root, outside);
    const remaining = (await readdir(join(root, "catalogs/providers/gam/publications")))
      .filter((entry) => /^[a-f0-9]{64}$/.test(entry));
    assert.deepEqual(remaining.sort(), publicationIds.slice(1).sort());
    const index = JSON.parse(await readFile(join(root, path), "utf8"));
    assert.deepEqual(index.publications.map((item) => item.approvalSha256),
      [publicationIds[2], publicationIds[1]]);
  });
});

test("el índice antiguo no sustituye a la publicación inmediatamente anterior", async () => {
  await workspace(async ({ root, outside }) => {
    const { preparations, publicationIds } = await rootFiles(root, 4);
    const path = "storage/providers/gam/publication-retention.json";
    await save(root, path, JSON.stringify({
      version: 1, providerId: provider, publications: [{
        approvalSha256: publicationIds[0], preparationSha256: preparations[0].digest,
        preparedAt: "2026-11-01T00:00:00.000Z"
      }, {
        approvalSha256: publicationIds[1], preparationSha256: preparations[1].digest,
        preparedAt: "2026-11-02T00:00:00.000Z"
      }]
    }));
    await save(root, "scripts/tooling.mjs", 'console.log("ESTADO INTACTO");');
    assert.equal((await planConsolidation(root)).length, 8);
    await consolidateLocalArtifacts(root, outside);
    const remaining = (await readdir(join(root, "catalogs/providers/gam/publications")))
      .filter((entry) => /^[a-f0-9]{64}$/.test(entry));
    assert.deepEqual(remaining.sort(), publicationIds.slice(2).sort());
  });
});

test("bloquea índices de retención corruptos o referencias alteradas", async () => {
  await workspace(async ({ root }) => {
    const { preparations, publicationIds } = await rootFiles(root, 3);
    const path = "storage/providers/gam/publication-retention.json";
    await save(root, path, JSON.stringify({
      version: 1, providerId: provider, publications: [{
        approvalSha256: publicationIds[0], preparationSha256: "e".repeat(64),
        preparedAt: "2026-11-01T00:00:00.000Z"
      }]
    }));
    await assert.rejects(planConsolidation(root), /Índice de retención referencia publicación modificada/);
    await save(root, path, JSON.stringify({
      version: 1, providerId: provider, publications: [{
        approvalSha256: "no-es-sha", preparationSha256: preparations[0].digest,
        preparedAt: "2026-11-01T00:00:00.000Z"
      }]
    }));
    await assert.rejects(planConsolidation(root), /Índice de retención inválido/);
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

test("admite cambios de cifras entre preparaciones acreditadas sin degradar su estado", async () => {
  await workspace(async ({ root, outside }) => {
    await rootFiles(root, 3);
    await save(root, "scripts/tooling.mjs", `import { readdir } from "node:fs/promises";
const count = (await readdir("storage/prepared/gam")).filter((name) => name.endsWith("-preparation.json")).length;
console.log("PASS |   PREPARACIÓN | CORRECTO | Preparación acreditada (" + count + " Ready / 0 Review)");`);
    const result = await consolidateLocalArtifacts(root, outside);
    assert.equal(result.versions, 4);
    assert.equal((await readdir(join(root, "storage/prepared/gam"))).filter((name) => name.endsWith("-preparation.json")).length, 2);
  });
});

test("revierte la consolidación si una preparación deja de estar acreditada", async () => {
  await workspace(async ({ root, outside }) => {
    await rootFiles(root, 3);
    await save(root, "scripts/tooling.mjs", `import { readdir } from "node:fs/promises";
const count = (await readdir("storage/prepared/gam")).filter((name) => name.endsWith("-preparation.json")).length;
console.log(count === 3
  ? "PASS |   PREPARACIÓN | CORRECTO | Preparación acreditada (3 Ready / 0 Review)"
  : "WARN |   PREPARACIÓN | PARCIAL | Preparación heredada disponible");`);
    await assert.rejects(consolidateLocalArtifacts(root, outside), /estado operativo cambió/);
    assert.equal((await readdir(join(root, "storage/prepared/gam"))).filter((name) => name.endsWith("-preparation.json")).length, 3);
  });
});

test("retira una extracción vacía sin exigir que siga figurando como parcial", async () => {
  await workspace(async ({ root, outside }) => {
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
    const result = await consolidateLocalArtifacts(root, outside);
    assert.equal(result.versions, 5);
    assert.equal((await readdir(join(root, "storage/prepared/gam"))).filter((name) => name.endsWith("-preparation.json")).length, 2);
    await assert.rejects(readFile(join(root, "storage/scraped/mercaeleva/scrape-mercaeleva-summary.json")), { code: "ENOENT" });
  });
});

test("archiva una extracción vacía de Manain sin bloquear el estado parcial anterior", async () => {
  await workspace(async ({ root, outside }) => {
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
    const result = await consolidateLocalArtifacts(root, outside);
    assert.equal(result.versions, 6);
    await assert.rejects(readFile(join(root, "storage/scraped/manain/prueba-manain-summary.json")), { code: "ENOENT" });
    await assert.rejects(readFile(join(root, "storage/scraped/manain/prueba-manain-partial-all.csv")), { code: "ENOENT" });
    assert.equal((await readdir(join(root, "catalogs/providers/gam/publications"))).filter((entry) => /^[a-f0-9]{64}$/.test(entry)).length, 2);
  });
});

test("identifica la primera diferencia operativa no autorizada sin borrar históricos", async () => {
  await workspace(async ({ root, outside }) => {
    await rootFiles(root, 3);
    await save(root, "scripts/tooling.mjs", `import { readdir } from "node:fs/promises";
const count = (await readdir("catalogs/providers/gam/publications")).filter((name) => name !== "active.json").length;
console.log("PUBLICACIONES VIGENTES: " + count);`);
    await assert.rejects(consolidateLocalArtifacts(root, outside), /estado operativo cambió.*Línea 1: antes/);
    assert.equal((await readdir(join(root, "catalogs/providers/gam/publications"))).filter((entry) => /^[a-f0-9]{64}$/.test(entry)).length, 3);
  });
});

test("no permite perder una publicación al descartar una extracción vacía", async () => {
  await workspace(async ({ root, outside }) => {
    await rootFiles(root, 3);
    await save(root, "storage/scraped/mercaeleva/scrape-mercaeleva-summary.json", JSON.stringify({
      quality: { status: "blocked", published: false }, totals: { scrapedProducts: 0 }
    }));
    await save(root, "scripts/tooling.mjs", `import { existsSync } from "node:fs";
console.log("  MERCAELEVA");
console.log(existsSync("storage/scraped/mercaeleva/scrape-mercaeleva-summary.json")
  ? "PASS |   JSON FINAL | CORRECTO | Publicación vigente"
  : "    JSON FINAL | AUSENTE | Sin publicación");`);
    await assert.rejects(consolidateLocalArtifacts(root, outside), /estado operativo cambió/);
    assert.equal((await readFile(join(root, "storage/scraped/mercaeleva/scrape-mercaeleva-summary.json"), "utf8")).includes("blocked"), true);
  });
});
