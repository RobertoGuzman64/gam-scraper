import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, rm, writeFile, symlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { buildCommercialExportFiles, type CommercialExportFile } from "../commercial-export.js";
import type { CommercialExportPlan } from "../../projection/export-projection.js";
import { validateCommercialExportFiles, verifyCommercialExportDirectory, verifyCommercialExportSources } from "../commercial-export-verification.js";

const createFile = (name: string, content: string): CommercialExportFile => ({
  name, content, sha256: createHash("sha256").update(content).digest("hex"), bytes: Buffer.byteLength(content)
});

const emptyPlan = (): CommercialExportPlan => ({
  version: 1, providerId: "gam", publicationSha256: "a".repeat(64), environment: null, total: 0,
  products: [], excluded: [], exceptions: [], summary: {
    exported: 0, categorized: 0, pendingCategory: 0, excludedLots: 0, excludedTools: 0,
    excludedAccessories: 0, attributes: 0, withLogo: 0, withPrice: 0, withCompany: 0
  }
});

const filesForProvider = (plan: CommercialExportPlan = emptyPlan()): CommercialExportFile[] => {
  const product = createFile("gam-commercial.json", `${JSON.stringify(plan)}\n`);
  const manifest = {
    version: 1, environment: null, taxonomySha256: "b".repeat(64), attributesSha256: "c".repeat(64),
    logosSha256: "d".repeat(64), companiesSha256: "e".repeat(64),
    providers: [{ providerId: "gam", publicationSha256: plan.publicationSha256, originalCount: plan.total,
      ...plan.summary, excluded: plan.excluded.length, exceptions: plan.exceptions.length,
      file: product.name, sha256: product.sha256, bytes: product.bytes }]
  };
  return [product, createFile("commercial-manifest.json", `${JSON.stringify(manifest)}\n`)];
};

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

test("rechaza archivos extra, archivos ausentes y enlaces simbólicos", async () => {
  const directory = await mkdtemp(join(tmpdir(), "equipzilla-commercial-"));
  const files = filesForProvider();
  try {
    await assert.rejects(verifyCommercialExportDirectory(directory, files), /ausentes/);
    for (const file of files) await writeFile(join(directory, file.name), file.content);
    await writeFile(join(directory, "extra.json"), "{}");
    await assert.rejects(verifyCommercialExportDirectory(directory, files), /extraños/);
    await rm(join(directory, "extra.json"));
    await rm(join(directory, files[0]?.name ?? ""));
    await symlink(join(directory, "inexistente.json"), join(directory, files[0]?.name ?? ""));
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

const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value);

const withManifest = (files: readonly CommercialExportFile[], change: (manifest: Record<string, unknown>) => void): CommercialExportFile[] =>
  files.map((entry) => {
    if (entry.name !== "commercial-manifest.json") return entry;
    const manifest: unknown = JSON.parse(entry.content);
    assert.ok(isRecord(manifest));
    change(manifest);
    return createFile(entry.name, `${JSON.stringify(manifest, null, 2)}\n`);
  });

test("impide exportaciones con fuentes comerciales cambiadas o selección de publicaciones obsoleta", async () => {
  const root = fileURLToPath(new URL("../../../../", import.meta.url));
  const files = await buildCommercialExportFiles(root, null);
  assert.equal(files.length, 4);
  await verifyCommercialExportSources(root, files);

  const alteredReferences = withManifest(files, (manifest) => {
    manifest.taxonomySha256 = "0".repeat(64);
  });
  validateCommercialExportFiles(alteredReferences);
  await assert.rejects(verifyCommercialExportSources(root, alteredReferences), /referencias comerciales cambiaron/);

  const product = files.find((entry) => entry.name === "gam-commercial.json");
  assert.ok(product);
  const plan: unknown = JSON.parse(product.content);
  assert.ok(isRecord(plan));
  plan.publicationSha256 = "f".repeat(64);
  const alteredProduct = createFile(product.name, `${JSON.stringify(plan, null, 2)}\n`);
  const replaced = files.map((entry) => entry.name === product.name ? alteredProduct : entry);
  const alteredPublication = withManifest(replaced, (manifest) => {
    assert.ok(Array.isArray(manifest.providers));
    const provider: unknown = manifest.providers.find((item: unknown) => isRecord(item) && item.providerId === "gam");
    assert.ok(isRecord(provider));
    provider.publicationSha256 = plan.publicationSha256;
    provider.sha256 = alteredProduct.sha256;
    provider.bytes = alteredProduct.bytes;
  });
  validateCommercialExportFiles(alteredPublication);
  await assert.rejects(verifyCommercialExportSources(root, alteredPublication), /publicación activa de gam cambió/);

  const rewrittenPlan: unknown = JSON.parse(product.content);
  assert.ok(isRecord(rewrittenPlan) && Array.isArray(rewrittenPlan.products));
  const firstProduct: unknown = rewrittenPlan.products[0];
  assert.ok(isRecord(firstProduct) && typeof firstProduct.title === "string");
  firstProduct.title = `${firstProduct.title} alterado`;
  const rewrittenProduct = createFile(product.name, `${JSON.stringify(rewrittenPlan, null, 2)}\n`);
  const rewrittenExport = withManifest(files.map((entry) =>
    entry.name === product.name ? rewrittenProduct : entry), (manifest) => {
    assert.ok(Array.isArray(manifest.providers));
    const provider: unknown = manifest.providers.find((item: unknown) => isRecord(item) && item.providerId === "gam");
    assert.ok(isRecord(provider));
    provider.sha256 = rewrittenProduct.sha256;
    provider.bytes = rewrittenProduct.bytes;
  });
  validateCommercialExportFiles(rewrittenExport);
  await assert.rejects(verifyCommercialExportSources(root, rewrittenExport),
    /fuentes originales o la proyección comercial cambiaron/);

  const subset = withManifest(files.filter((entry) => entry.name !== "mercaeleva-commercial.json"), (manifest) => {
    assert.ok(Array.isArray(manifest.providers));
    manifest.providers = manifest.providers.filter((item: unknown) => isRecord(item) && item.providerId !== "mercaeleva");
  });
  validateCommercialExportFiles(subset);
  await assert.rejects(verifyCommercialExportSources(root, subset), /conjunto de publicaciones activas cambió/);
});

const planWithProduct = (): CommercialExportPlan => ({
  ...emptyPlan(), total: 1,
  products: [{
    providerId: "gam", sourceUrl: "https://example.com/product", reference: "product-1",
    title: "Producto de prueba", categorySellID: 16, category: "Carretillas",
    condition: "Segunda_Mano", price: 50, description_title: "Producto de prueba",
    description: "Ficha de prueba", description_general: "Descripción de prueba",
    image: null, images: [], spec: {}, attributes: [{ attributeID: 1, value: 42 }],
    logoID: 5, metadata: { tags: [], keywords: [], featured: false }
  }],
  summary: {
    exported: 1, categorized: 1, pendingCategory: 0, excludedLots: 0, excludedTools: 0,
    excludedAccessories: 0, attributes: 1, withLogo: 1, withPrice: 1, withCompany: 0
  }
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

test("rechaza exclusiones incoherentes, aunque los totales del manifiesto coincidan", () => {
  const original = emptyPlan();
  const valid: CommercialExportPlan = {
    ...original, total: 1,
    excluded: [{ identity: "gam:lot", reference: "lot", sourceUrl: "https://example.com/lot", reason: "lote" }],
    summary: { ...original.summary, excludedLots: 1 }
  };
  assert.doesNotThrow(() => validateCommercialExportFiles(filesForProvider(valid)));
  assert.throws(() => validateCommercialExportFiles(filesForProvider({
    ...valid, summary: { ...valid.summary, excludedLots: 0, excludedAccessories: 1 }
  })), /Totales o procedencia/);
  assert.throws(() => validateCommercialExportFiles(filesForProvider({
    ...valid, excluded: [{ ...valid.excluded[0]!, reason: "sin-clasificar" }]
  })), /Totales o procedencia/);
});
