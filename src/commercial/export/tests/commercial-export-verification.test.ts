import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { access, mkdtemp, readFile, readdir, rm, writeFile, symlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { buildCommercialExportFiles, type CommercialExportFile } from "../commercial-export.js";
import type { CommercialExportPlan } from "../../projection/export-projection.js";
import { validateCommercialExportFiles, verifyCommercialExportArchive, verifyCommercialExportDirectory, verifyCommercialExportSources, verifyCommercialExportZip } from "../commercial-export-verification.js";
import { createZipArchive, readZipArchive } from "../../../infrastructure/archive/zip.js";
import { assertCommercialPackageProviders, inspectCommercialPackage } from "../commercial-package-snapshot.js";
import { renderCommercialIntegrationReport } from "../../../cli/reporting/commercial-integration-report.js";
import { deliverCommercialPackages, publishCommercialArchivePair, verifyCommercialIntegrationArchive, verifyCommercialPackagePair } from "../../../cli/reporting/commercial-package-delivery.js";

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
  const files = await currentCommercialFiles();
  assert.equal(files.length, 4);

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

let latestFilesPromise: Promise<readonly CommercialExportFile[]> | undefined;
const currentCommercialFiles = (): Promise<readonly CommercialExportFile[]> =>
  latestFilesPromise ??= buildCommercialExportFiles(fileURLToPath(new URL("../../../../", import.meta.url)), null);

const packCommercial = (files: readonly CommercialExportFile[]): Buffer => createZipArchive(files.map((file) => ({
  name: file.name, data: file.content
})));

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

test("el informe identifica fuentes, excepciones, límites de integración y detecta manipulación", () => {
  const files = filesForProvider(planWithProduct());
  const snapshot = inspectCommercialPackage(files);
  assert.throws(() => assertCommercialPackageProviders(snapshot), /tres proveedores/);
  const markdown = renderCommercialIntegrationReport(snapshot, "2026-11-06");
  assert.match(markdown, /NO VERIFICADO EN BD/);
  assert.match(markdown, /gam-commercial\.json/);
  assert.match(markdown, new RegExp(files[0]!.sha256));
  const zip = createZipArchive([{ name: "INFORME.md", data: markdown }]);
  assert.equal(verifyCommercialIntegrationArchive(zip, files), "2026-11-06");
  assert.throws(() => verifyCommercialIntegrationArchive(createZipArchive([{ name: "INFORME.md",
    data: markdown.replace("NO VERIFICADO EN BD", "VERIFICADO EN BD") }]), files), /no corresponde/);
  assert.throws(() => verifyCommercialIntegrationArchive(createZipArchive([{ name: "INFORME.md", data: "sin corte" }]), files), /fecha/);
  assert.throws(() => verifyCommercialIntegrationArchive(createZipArchive([
    { name: "INFORME.md", data: markdown }, { name: "extra.json", data: "{}" }
  ]), files), /entradas incorrectas/);
});

test("las referencias comerciales visibles reutilizan la regla del auditor, sin confundirlas con identidad técnica", () => {
  const base = planWithProduct();
  const product = base.products[0]!;
  const changed: CommercialExportPlan = {
    ...base, total: 2,
    products: [
      { ...product, externalReference: "VISIBLE-A" },
      { ...product, reference: "other-reference", sourceUrl: "https://example.com/other", externalReference: "visible-a" }
    ],
    summary: { ...base.summary, exported: 2, categorized: 2, attributes: 2,
      withLogo: 2, withPrice: 2 }
  };
  assert.equal(inspectCommercialPackage(filesForProvider(changed)).providers[0]?.repeatedReferences, 1);
});

test("entrega dos ZIP acreditados con los cuatro contenidos comerciales intactos", async () => {
  const directory = await mkdtemp(join(tmpdir(), "equipzilla-pair-"));
  const root = fileURLToPath(new URL("../../../../", import.meta.url));
  const files = await currentCommercialFiles();
  const date = new Date("2026-11-06T11:00:00.000Z");
  try {
    const delivered = await deliverCommercialPackages(root, directory, files, date);
    assert.equal(delivered.providers, 3);
    assert.equal(delivered.environment, "sin companyID");
    assert.equal((await readdir(directory)).length, 2);
    const commercialZip = readZipArchive(await readFile(delivered.commercial));
    assert.deepEqual(commercialZip.map((entry) => entry.name), files.map((file) => file.name));
    for (const entry of commercialZip) {
      assert.ok(entry.data.equals(Buffer.from(files.find((file) => file.name === entry.name)!.content, "utf8")));
    }
    assert.deepEqual((await readdir(directory)).length, 2);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("el almacenamiento de ZIP es idempotente y protege las entregas anteriores ante colisiones", async () => {
  const directory = await mkdtemp(join(tmpdir(), "equipzilla-storage-"));
  const commercialArchive = createZipArchive([{ name: "commercial-manifest.json", data: "{}" }]);
  const reportArchive = createZipArchive([{ name: "INFORME.md", data: "Corte de prueba" }]);
  try {
    const first = await publishCommercialArchivePair(directory, "comercial.zip", commercialArchive, "informe.zip", reportArchive);
    assert.deepEqual(first.created, [first.commercial, first.report]);
    const repeated = await publishCommercialArchivePair(directory, "comercial.zip", commercialArchive, "informe.zip", reportArchive);
    assert.deepEqual(repeated.created, []);
    await writeFile(first.report, "contenido previo diferente");
    await assert.rejects(publishCommercialArchivePair(directory, "comercial.zip", commercialArchive,
      "informe.zip", reportArchive), /Colisión/);
    assert.equal(await readFile(first.report, "utf8"), "contenido previo diferente");
    assert.deepEqual((await readdir(directory)).sort(), ["comercial.zip", "informe.zip"]);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("una colisión del segundo ZIP revierte solo los archivos creados por el intento", async () => {
  const directory = await mkdtemp(join(tmpdir(), "equipzilla-storage-rollback-"));
  const commercialArchive = createZipArchive([{ name: "commercial-manifest.json", data: "{}" }]);
  const reportArchive = createZipArchive([{ name: "INFORME.md", data: "Corte de prueba" }]);
  const commercial = join(directory, "comercial.zip");
  const report = join(directory, "informe.zip");
  try {
    await writeFile(report, "histórico no coincidente");
    await assert.rejects(publishCommercialArchivePair(directory, "comercial.zip", commercialArchive,
      "informe.zip", reportArchive), /Colisión/);
    await assert.rejects(access(commercial), /ENOENT/);
    assert.equal(await readFile(report, "utf8"), "histórico no coincidente");
    assert.deepEqual(await readdir(directory), ["informe.zip"]);
    await assert.rejects(publishCommercialArchivePair(directory, "../fuera.zip", commercialArchive,
      "informe.zip", reportArchive), /inválidos/);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
