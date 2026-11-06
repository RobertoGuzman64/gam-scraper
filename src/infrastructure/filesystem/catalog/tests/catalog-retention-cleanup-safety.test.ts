import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { lstat, mkdir, mkdtemp, readFile, readdir, rm, symlink, utimes, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { catalogArchiveExcess, cleanCatalogExcess, staleArchiveExcess } from "../catalog-retention.js";

const prefix = "scrape-gam";
const archiveName = (day: number): string =>
  `archive-2026-10-${String(day).padStart(2, "0")}T10-00-00-000Z-00000000-0000-4000-8000-${String(day).padStart(12, "0")}`;
const sha256 = (contents: string): string => createHash("sha256").update(contents).digest("hex");
const withWorkspace = async (run: (root: string, dir: string) => Promise<void>): Promise<void> => {
  const root = await mkdtemp(join(tmpdir(), "eqz-retention-safety-"));
  const dir = join(root, "storage", "scraped", "gam");
  try {
    await mkdir(join(dir, ".history", prefix), { recursive: true });
    await run(root, dir);
  } finally { await rm(root, { recursive: true, force: true }); }
};
const makeArchive = async (dir: string, day: number): Promise<{ path: string; contentSha256: string }> => {
  const path = join(dir, ".history", prefix, archiveName(day));
  await mkdir(path);
  const csv = `categoryKey,categoryName,title,\n${day}`;
  const preparation = `preparation-${day}`;
  const summary = JSON.stringify({ quality: { status: "complete", published: true }, artifacts: {
    csvSha256: sha256(csv), preparationSha256: sha256(preparation)
  } });
  const files = [`${prefix}-all.csv`, `${prefix}-preparation.json`, `${prefix}-summary.json`];
  await Promise.all([
    writeFile(join(path, files[0]!), csv),
    writeFile(join(path, files[1]!), preparation),
    writeFile(join(path, files[2]!), summary)
  ]);
  await writeFile(join(path, "manifest.json"), JSON.stringify({ version: 1, prefix, files }));
  return { path, contentSha256: sha256(csv) };
};

test("retención de catálogos conserva último histórico y dryRun no escribe", async () => {
  await withWorkspace(async (_root, dir) => {
    const oldest = await makeArchive(dir, 1);
    const newest = await makeArchive(dir, 2);
    const before = await readFile(join(oldest.path, "manifest.json"));
    const candidates = await cleanCatalogExcess(dir, prefix, true);
    assert.deepEqual(candidates.map(({ path }) => path), [oldest.path]);
    assert.ok(candidates[0]!.bytes > 0);
    assert.deepEqual(await readFile(join(oldest.path, "manifest.json")), before);
    assert.equal((await lstat(newest.path)).isDirectory(), true);
  });
});

test("una referencia por SHA protege el histórico excedente, sin alterar los dos archivos", async () => {
  await withWorkspace(async (root, dir) => {
    const oldest = await makeArchive(dir, 1);
    await makeArchive(dir, 2);
    const references = join(root, "storage", "providers", "gam");
    await mkdir(references, { recursive: true });
    const reference = join(references, "recovery.json");
    await writeFile(reference, JSON.stringify({ catalogSha256: oldest.contentSha256.toUpperCase() }));
    assert.deepEqual(await catalogArchiveExcess(dir, prefix), []);
    await rm(reference);
    assert.deepEqual((await catalogArchiveExcess(dir, prefix)).map(({ path }) => path), [oldest.path]);
  });
});

test("referencias simbólicas y contenido inesperado impiden eliminación incierta", async () => {
  await withWorkspace(async (root, dir) => {
    await makeArchive(dir, 1);
    await makeArchive(dir, 2);
    const references = join(root, "storage", "providers", "gam");
    await mkdir(references, { recursive: true });
    const external = join(root, "external.txt");
    await writeFile(external, "contenido privado");
    await symlink(external, join(references, "recovery.json"));
    assert.deepEqual(await catalogArchiveExcess(dir, prefix), []);
    assert.equal(await readFile(external, "utf8"), "contenido privado");
  });
});

test("histórico corrupto o con archivo extra no se ofrece a limpieza", async () => {
  await withWorkspace(async (_root, dir) => {
    const oldest = await makeArchive(dir, 1);
    await makeArchive(dir, 2);
    await writeFile(join(oldest.path, "notas-privadas.txt"), "no eliminar");
    assert.deepEqual(await catalogArchiveExcess(dir, prefix), []);
    assert.equal((await readdir(oldest.path)).includes("notas-privadas.txt"), true);
  });
});

test("pendiente vencido se planifica sin eliminación durante simulación", async () => {
  await withWorkspace(async (_root, dir) => {
    const pending = join(dir, ".history", prefix, ".pending-2026-10-01T10-00-00-000Z-00000000-0000-4000-8000-000000000001");
    await mkdir(pending);
    await writeFile(join(pending, "temporal.txt"), "incompleto");
    const expired = new Date(Date.now() - 49 * 60 * 60 * 1000);
    await utimes(pending, expired, expired);
    assert.deepEqual((await staleArchiveExcess(dir, prefix)).map(({ path }) => path), [pending]);
    assert.deepEqual((await cleanCatalogExcess(dir, prefix, true)).map(({ path }) => path), [pending]);
    assert.equal(await readFile(join(pending, "temporal.txt"), "utf8"), "incompleto");
  });
});
