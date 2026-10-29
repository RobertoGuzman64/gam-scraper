import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { copyFile, lstat, mkdir, mkdtemp, readFile, readdir, rename, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { readCanonicalCatalog, writeCanonicalCatalog } from "../catalog/canonical-catalog.js";
import { consolidatePortableOriginal, readPortableOriginal, recoverPortableOriginal } from "../catalog/portable-original.js";

const prefix = "scrape-gomariz";
const files = [`${prefix}-catalog.json`, `${prefix}-catalog.manifest.json`, `${prefix}-summary.json`] as const;
const fixtureRoot = join(process.cwd(), "src", "testing", "fixtures", "gomariz");

const withWorkspace = async (callback: (root: string, source: string) => Promise<void>): Promise<void> => {
  const root = await mkdtemp(join(tmpdir(), "equipzilla-portable-"));
  const source = join(root, "source");
  await mkdir(source);
  try {
    for (const file of files) await copyFile(join(fixtureRoot, file), join(source, file));
    await callback(root, source);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
};

const sourceCatalog = (root: string): string => join(root, `${prefix}-catalog.json`);
const portableDir = (root: string): string => join(root, "catalogs", "providers", "gomariz", "original");

const updateSource = async (source: string): Promise<void> => {
  const original = await readCanonicalCatalog(sourceCatalog(source));
  const products = original.products.map((item, index) => index === 0 ? { ...item, title: "Título acreditado nuevo" } : item);
  const hash = await writeCanonicalCatalog(source, prefix, original.scope, original.startedAt, "2026-10-23T10:00:00Z", products);
  await writeFile(join(source, `${prefix}-summary.json`), JSON.stringify({
    startedAt: original.startedAt, endedAt: "2026-10-23T10:00:00Z",
    quality: { status: "complete", published: true },
    totals: { scrapedProducts: products.length }, artifacts: { catalogSha256: hash }
  }, null, 2));
};

test("original portátil conserva exactamente canónico, manifest y resumen verificables sin storage", async () => {
  await withWorkspace(async (root, source) => {
    const published = await consolidatePortableOriginal(root, sourceCatalog(source));
    assert.deepEqual(published, { providerId: "gomariz", productCount: 14, changed: true });
    assert.deepEqual((await readdir(portableDir(root))).sort(), [...files].sort());
    await rm(source, { recursive: true });
    const portable = await readPortableOriginal(root, "gomariz");
    assert.equal(portable.productCount, 14);
    const renamed = `${root}-moved`;
    await rename(root, renamed);
    try {
      assert.equal((await readPortableOriginal(renamed, "gomariz")).productCount, 14);
    } finally {
      await rename(renamed, root);
    }
  });
});

test("consolidación idéntica no reescribe y sustitución válida no conserva versiones antiguas", async () => {
  await withWorkspace(async (root, source) => {
    await consolidatePortableOriginal(root, sourceCatalog(source));
    const old = await readFile(join(portableDir(root), files[0]), "utf8");
    assert.equal((await consolidatePortableOriginal(root, sourceCatalog(source))).changed, false);
    await updateSource(source);
    const result = await consolidatePortableOriginal(root, sourceCatalog(source));
    assert.equal(result.changed, true);
    const next = await readFile(join(portableDir(root), files[0]), "utf8");
    assert.notEqual(next, old);
    assert.equal((await readPortableOriginal(root, "gomariz")).products[0]?.title, "Título acreditado nuevo");
    assert.deepEqual((await readdir(join(root, "catalogs", "providers", "gomariz"))).sort(), ["original"]);
    assert.equal((await consolidatePortableOriginal(root, sourceCatalog(source))).changed, false);
  });
});

test("truncamientos, resúmenes falsos y mezclas no sustituyen el original vigente", async () => {
  await withWorkspace(async (root, source) => {
    await consolidatePortableOriginal(root, sourceCatalog(source));
    const previous = await readFile(join(portableDir(root), files[0]), "utf8");
    await updateSource(source);
    const goodSummary = await readFile(join(source, files[2]), "utf8");
    await writeFile(join(source, files[2]), JSON.stringify({
      startedAt: "2026-10-01T00:00:00Z", endedAt: "2026-10-01T00:00:00Z",
      quality: { status: "complete", published: true }, totals: { scrapedProducts: 14 },
      artifacts: { catalogSha256: "0".repeat(64) }
    }));
    await assert.rejects(consolidatePortableOriginal(root, sourceCatalog(source)), /publicación completa acreditada/);
    await writeFile(join(source, files[2]), goodSummary);
    await writeFile(join(source, files[1]), "{}");
    await assert.rejects(consolidatePortableOriginal(root, sourceCatalog(source)), /Manifest/);
    assert.equal(await readFile(join(portableDir(root), files[0]), "utf8"), previous);
  });
});

test("rechaza sustituir un original vigente por una ejecución anterior", async () => {
  await withWorkspace(async (root, source) => {
    await consolidatePortableOriginal(root, sourceCatalog(source));
    const original = await readFile(join(portableDir(root), files[0]), "utf8");
    const oldFiles = await Promise.all(files.map((file) => readFile(join(source, file), "utf8")));
    await updateSource(source);
    await consolidatePortableOriginal(root, sourceCatalog(source));
    for (const [index, file] of files.entries()) {
      await writeFile(join(source, file), oldFiles[index]!);
    }
    await assert.rejects(consolidatePortableOriginal(root, sourceCatalog(source)), /ejecución anterior/);
    assert.notEqual(await readFile(join(portableDir(root), files[0]), "utf8"), original);
  });
});

test("original de destino dañado detiene la sustitución y preserva evidencia", async () => {
  await withWorkspace(async (root, source) => {
    await consolidatePortableOriginal(root, sourceCatalog(source));
    const target = join(portableDir(root), files[0]);
    const truncated = (await readFile(target, "utf8")).slice(0, 80);
    await writeFile(target, truncated);
    await updateSource(source);
    await assert.rejects(consolidatePortableOriginal(root, sourceCatalog(source)));
    assert.equal(await readFile(target, "utf8"), truncated);
  });
});

test("se recupera una promoción interrumpida sin perder el original anterior", async () => {
  await withWorkspace(async (root, source) => {
    await consolidatePortableOriginal(root, sourceCatalog(source));
    const provider = join(root, "catalogs", "providers", "gomariz");
    await rename(join(provider, "original"), join(provider, ".original-rollback"));
    await assert.rejects(readPortableOriginal(root, "gomariz"), /pendiente de recuperación/);
    await assert.rejects(consolidatePortableOriginal(root, sourceCatalog(source)), /pendiente de recuperación/);
    assert.equal(await recoverPortableOriginal(root, "gomariz"), true);
    assert.equal((await readPortableOriginal(root, "gomariz")).productCount, 14);
    assert.equal(await recoverPortableOriginal(root, "gomariz"), false);
    assert.deepEqual(await readdir(provider), ["original"]);
  });
});

test("recuperación no borra un respaldo incoherente y rechaza archivos extraños", async () => {
  await withWorkspace(async (root, source) => {
    await consolidatePortableOriginal(root, sourceCatalog(source));
    const provider = join(root, "catalogs", "providers", "gomariz");
    const backup = join(provider, ".original-rollback");
    await rename(portableDir(root), backup);
    await writeFile(join(backup, files[0]), "INVALID");
    await assert.rejects(recoverPortableOriginal(root, "gomariz"));
    assert.ok((await lstat(backup)).isDirectory());
    await rename(backup, portableDir(root));
    await writeFile(join(portableDir(root), "unknown.json"), "{}");
    await assert.rejects(readPortableOriginal(root, "gomariz"), /inesperados/);
  });
});

test("no admite proveedores inventados ni manifiestos alterados con hash recalculado", async () => {
  await withWorkspace(async (root, source) => {
    await assert.rejects(readPortableOriginal(root, "../../extra"), /no admitido/);
    const sourcePath = sourceCatalog(source);
    const text = await readFile(sourcePath, "utf8");
    const original: unknown = JSON.parse(text);
    assert.ok(original && typeof original === "object" && "products" in original && Array.isArray(original.products));
    original.products[1] = original.products[0];
    const modified = JSON.stringify(original, null, 2);
    await writeFile(sourcePath, modified);
    const manifestPath = join(source, files[1]);
    const manifest: unknown = JSON.parse(await readFile(manifestPath, "utf8"));
    assert.ok(manifest && typeof manifest === "object" && "catalogSha256" in manifest);
    manifest.catalogSha256 = createHash("sha256").update(modified).digest("hex");
    await writeFile(manifestPath, JSON.stringify(manifest));
    await assert.rejects(consolidatePortableOriginal(root, sourcePath), /Identidad duplicada/);
  });
});
