import { createPortableTestSymlink } from "../../../testing/builders/portable-symlink-fixture.js";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { loadImportCatalogSnapshot } from "../../../infrastructure/filesystem/legacy-export/import-catalog-loader.js";
import { loadCommercialReference } from "../../../infrastructure/filesystem/legacy-export/commercial-reference-loader.js";
import { assembleCommercialExportFiles } from "../commercial-export.js";
import { validateCommercialExportFiles, verifyCommercialExportArchive, verifyCommercialExportDirectory } from "../commercial-export-verification.js";
import { createZipArchive, readZipArchive } from "../../../infrastructure/archive/zip.js";
import { assertCommercialPackageProviders, inspectCommercialPackage, validateStoredCommercialPackage } from "../commercial-package-snapshot.js";
import { inspectRepositoryArtifact, retainRepositoryArtifact } from "../../../infrastructure/filesystem/catalog/repository-artifact-snapshot.js";
import { CAMPAIGN_PROVIDERS, LEGACY_CAMPAIGN_PROVIDERS } from "../../../contracts/campaign-providers.js";
import { createFile, emptyPlan, filesForProvider, planWithProduct, packCommercial } from "./commercial-export-verification-fixture.js";

test("verifica todos los archivos exportados sin modificarlos", async () => {
  const directory = await mkdtemp(join(tmpdir(), "equipzilla-commercial-"));
  const files = filesForProvider();
  try {
    for (const file of files) await writeFile(join(directory, file.name), file.content);
    assert.deepEqual(await verifyCommercialExportDirectory(directory, files), { files: 2, bytes: files.reduce((total, file) => total + file.bytes, 0) });
    await writeFile(join(directory, files[0]?.name ?? ""), "contenido-adulterado");
    await assert.rejects(verifyCommercialExportDirectory(directory, files), /no coincide con el corte acreditado/);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("rechaza archivos extra, archivos ausentes y enlaces simbólicos", async (t) => {
  const directory = await mkdtemp(join(tmpdir(), "equipzilla-commercial-"));
  const files = filesForProvider();
  try {
    await assert.rejects(verifyCommercialExportDirectory(directory, files), /ausentes/);
    for (const file of files) await writeFile(join(directory, file.name), file.content);
    await writeFile(join(directory, "extra.json"), "{}");
    await assert.rejects(verifyCommercialExportDirectory(directory, files), /extraños/);
    await rm(join(directory, "extra.json"));
    await rm(join(directory, files[0]?.name ?? ""));
    if (!(await createPortableTestSymlink(t, join(directory, "inexistente.json"), join(directory, files[0]?.name ?? "")))) return;
    await assert.rejects(verifyCommercialExportDirectory(directory, files), /no regular/);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("rechaza huellas, tamaños y nombres incoherentes antes de comparar directorios", () => {
  const files = filesForProvider();
  const product = files[0];
  assert.ok(product);
  assert.throws(() => validateCommercialExportFiles([{ ...product, sha256: "0".repeat(64) }, files[1]!]), /Huella o tamaño/);
  assert.throws(() => validateCommercialExportFiles([{ ...product, bytes: product.bytes + 1 }, files[1]!]), /Huella o tamaño/);
  assert.throws(() => validateCommercialExportFiles([{ ...product, name: "../gam-commercial.json" }, files[1]!]), /Nombre de archivo/);
  assert.throws(() => validateCommercialExportFiles([product]), /Falta el manifiesto/);
});

test("detecta discrepancias entre manifiesto y planes, incluso si se recalculan las huellas", () => {
  const files = filesForProvider();
  const manifest = files[1];
  assert.ok(manifest);
  const parsed: unknown = JSON.parse(manifest.content);
  assert.ok(parsed && typeof parsed === "object" && "providers" in parsed && Array.isArray(parsed.providers));
  const provider: unknown = parsed.providers[0];
  assert.ok(provider && typeof provider === "object" && "originalCount" in provider && "sha256" in provider && "bytes" in provider);
  provider.originalCount = 1;
  const changed = createFile(manifest.name, `${JSON.stringify(parsed)}\n`);
  assert.throws(() => validateCommercialExportFiles([files[0]!, changed]), /Totales o procedencia/);
  const modifiedPlan: unknown = JSON.parse(files[0]!.content);
  assert.ok(modifiedPlan && typeof modifiedPlan === "object" && "total" in modifiedPlan);
  modifiedPlan.total = 1;
  const changedProduct = createFile(files[0]!.name, `${JSON.stringify(modifiedPlan)}\n`);
  provider.originalCount = 1;
  provider.sha256 = changedProduct.sha256;
  provider.bytes = changedProduct.bytes;
  const changedManifest = createFile(manifest.name, `${JSON.stringify(parsed)}\n`);
  assert.throws(() => validateCommercialExportFiles([changedProduct, changedManifest]), /Totales o procedencia/);
});

test("comprueba que los recuentos se derivan del contenido aunque las huellas sean válidas", () => {
  const valid = planWithProduct();
  assert.doesNotThrow(() => validateCommercialExportFiles(filesForProvider(valid)));
  assert.throws(() => validateCommercialExportFiles(filesForProvider({
    ...valid, summary: { ...valid.summary, attributes: 0 }
  })), /Totales o procedencia/);
  assert.throws(() => validateCommercialExportFiles(filesForProvider({
    ...valid, summary: { ...valid.summary, withLogo: 0, withPrice: 0 }
  })), /Totales o procedencia/);
  assert.throws(() => validateCommercialExportFiles(filesForProvider({
    ...valid, summary: { ...valid.summary, categorized: 0, pendingCategory: 1 }
  })), /Totales o procedencia/);
  assert.throws(() => validateCommercialExportFiles(filesForProvider({
    ...valid, products: [{ ...valid.products[0]!, companyID: 25 }]
  })), /Totales o procedencia/);
});

test("rechaza contratos comerciales adulterados aunque los hashes y contadores coincidan", () => {
  const base = planWithProduct();
  const original = base.products[0];
  assert.ok(original);
  const tampered: readonly Record<string, unknown>[] = [
    { title: 42 },
    { sourceUrl: "not-a-url" },
    { condition: "Usado" },
    { category: null },
    { metadata: { ...original.metadata, featured: true } },
    { metadata: { ...original.metadata, tags: ["maquinaria", "maquinaria"] } },
    { metadata: { ...original.metadata, keywords: ["Oferta Especial"] } },
    { metadata: { ...original.metadata, unexpected: true } },
    { attributes: [{ attributeID: 1, value: 42 }, { attributeID: 1, value: 50 }] },
    { attributes: [{ attributeID: 1, value: "" }] },
    { images: ["file:///etc/passwd"] },
    { image: "https://example.com/other.png" },
    { spec: { Invalida: { value: 50 } } },
    { extraField: "not-allowed" }
  ];
  for (const change of tampered) {
    const product = Object.assign({}, original, change);
    const candidate = { ...base, products: [product] };
    assert.throws(() => validateCommercialExportFiles(filesForProvider(candidate)),
      /Totales o procedencia|Procedencia comercial inválida/, JSON.stringify(change));
  }
});

test("el ZIP mantiene los bytes exactos y rechaza corrupción, entradas extra y ausentes", () => {
  const files = filesForProvider(planWithProduct());
  const zip = packCommercial(files);
  assert.deepEqual(verifyCommercialExportArchive(zip, files), {
    files: files.length, bytes: files.reduce((sum, file) => sum + file.bytes, 0)
  });
  assert.deepEqual(readZipArchive(zip).map((entry) => entry.name), files.map((file) => file.name));
  assert.throws(() => verifyCommercialExportArchive(zip.subarray(0, zip.length - 5), files), /ZIP:/);
  assert.throws(() => verifyCommercialExportArchive(createZipArchive([
    ...files.map((file) => ({ name: file.name, data: file.content })),
    { name: "extra.json", data: "{}" }
  ]), files), /ausentes o ajenos/);
  assert.throws(() => verifyCommercialExportArchive(createZipArchive([
    { name: files[0]!.name, data: files[0]!.content }
  ]), files), /ausentes o ajenos/);
  assert.throws(() => createZipArchive([
    { name: files[0]!.name, data: files[0]!.content },
    { name: files[0]!.name, data: files[0]!.content }
  ]), /duplicadas/);
  assert.throws(() => verifyCommercialExportArchive(createZipArchive(files.map((file) => ({
    name: file.name, data: file.name === "gam-commercial.json" ? `${file.content} ` : file.content
  }))), files), /no coincide/);
  const corrupted = Buffer.from(zip);
  const offset = 30 + Buffer.byteLength(files[0]!.name) + 3;
  corrupted.writeUInt8(corrupted.readUInt8(offset) ^ 0xff, offset);
  assert.throws(() => verifyCommercialExportArchive(corrupted, files), /ZIP:/);
});

test("el manifiesto comercial es idéntico aunque las publicaciones se descubran en otro orden", async () => {
  const [catalog, references] = await Promise.all([loadImportCatalogSnapshot(), loadCommercialReference()]);
  const providers = ["gam", "gomariz", "mercaeleva", "manain"] as const;
  const plans = providers.map((providerId) => ({ plan: { ...emptyPlan(), providerId }, recognitions: new Map() }));
  const forward = assembleCommercialExportFiles(plans, catalog, references, null);
  const reversed = assembleCommercialExportFiles([...plans].reverse(), catalog, references, null);
  assert.deepEqual(forward, reversed);
  assert.deepEqual(forward.map((entry) => entry.name), [
    "gam-commercial.json", "gomariz-commercial.json", "mercaeleva-commercial.json", "manain-commercial.json",
    "commercial-manifest.json"
  ]);
  assert.doesNotThrow(() => assertCommercialPackageProviders(inspectCommercialPackage(forward)));
});

test("el paquete comercial admite tres publicaciones históricas o las cuatro con Manain, nunca subconjuntos", () => {
  const providers = ["gam", "gomariz", "mercaeleva", "manain"] as const;
  const original = inspectCommercialPackage(filesForProvider());
  const entries = providers.map((providerId) => {
    const snapshot = inspectCommercialPackage(filesForProvider({ ...emptyPlan(), providerId }));
    const entry = snapshot.providers[0];
    assert.ok(entry);
    return entry;
  });
  assert.doesNotThrow(() => assertCommercialPackageProviders({ ...original, providers: entries.slice(0, 3) }));
  assert.doesNotThrow(() => assertCommercialPackageProviders({ ...original, providers: entries }));
  assert.throws(() => assertCommercialPackageProviders({ ...original, providers: entries.slice(1) }), /GAM, Gomariz y Mercaeleva/);
  assert.throws(() => assertCommercialPackageProviders({ ...original, providers: [...entries, entries[3]!] }), /GAM, Gomariz y Mercaeleva/);
});

test("la retención comercial valida cada manifiesto histórico con su propio conjunto de proveedores", async () => {
  const root = await mkdtemp(join(tmpdir(), "equipzilla-commercial-retention-"));
  try {
    const [catalog, references] = await Promise.all([loadImportCatalogSnapshot(), loadCommercialReference()]);
    const filesFor = (providers: readonly string[]) => assembleCommercialExportFiles(
      providers.map((providerId) => ({ plan: { ...emptyPlan(), providerId }, recognitions: new Map() })),
      catalog, references, null);
    const old = filesFor(LEGACY_CAMPAIGN_PROVIDERS);
    const current = filesFor(CAMPAIGN_PROVIDERS);
    const name = "commercial-manifest.json";
    const previous = await retainRepositoryArtifact(root, name, old, validateStoredCommercialPackage);
    const active = await retainRepositoryArtifact(root, name, current, validateStoredCommercialPackage);
    assert.deepEqual(await inspectRepositoryArtifact(root, name, validateStoredCommercialPackage), {
      sha256: active, previousSha256: previous
    });
    for (const file of old) {
      assert.equal(await readFile(join(root, "versions", previous, file.name), "utf8"), file.content);
    }
    await retainRepositoryArtifact(root, name, current, validateStoredCommercialPackage);
    assert.deepEqual(await inspectRepositoryArtifact(root, name, validateStoredCommercialPackage), {
      sha256: active, previousSha256: previous
    });
    const oldFile = old.find((file) => file.name !== name);
    assert.ok(oldFile);
    const path = join(root, "versions", previous, oldFile.name);
    await writeFile(path, `${oldFile.content} `);
    await assert.rejects(retainRepositoryArtifact(root, name, current, validateStoredCommercialPackage), /huella discordante/i);
    await writeFile(path, oldFile.content);
    await rm(path);
    await assert.rejects(inspectRepositoryArtifact(root, name, validateStoredCommercialPackage));
    await writeFile(path, oldFile.content);
    const extra = join(root, "versions", previous, "extra.json");
    await writeFile(extra, "{}");
    await assert.rejects(inspectRepositoryArtifact(root, name, validateStoredCommercialPackage));
    await rm(extra);
    assert.deepEqual(await inspectRepositoryArtifact(root, name, validateStoredCommercialPackage), {
      sha256: active, previousSha256: previous
    });
  } finally { await rm(root, { recursive: true, force: true }); }
});
