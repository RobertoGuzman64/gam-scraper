import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { createCommercialReferenceFixture, type CommercialReferenceFixture } from "../../../testing/builders/commercial-reference-fixture.js";
import { buildCommercialExportFiles, type CommercialExportFile } from "../commercial-export.js";
import { validateCommercialExportFiles, verifyCommercialExportSources } from "../commercial-export-verification.js";
import { readZipArchive } from "../../../infrastructure/archive/zip.js";
import { inspectCommercialPackage } from "../commercial-package-snapshot.js";
import { inspectRepositoryArtifact } from "../../../infrastructure/filesystem/catalog/repository-artifact-snapshot.js";
import { renderCommercialIntegrationReport } from "../../../cli/reporting/commercial/commercial-integration-report.js";
import { deliverCommercialPackages } from "../../../cli/reporting/commercial/commercial-package-delivery.js";
import { createFile, isRecord, withManifest } from "./commercial-export-verification-fixture.js";

let historicalFixturePromise: Promise<CommercialReferenceFixture> | undefined;

const historicalFixture = (): Promise<CommercialReferenceFixture> =>
  historicalFixturePromise ??= createCommercialReferenceFixture();

const commercialFixtureRoot = async (): Promise<string> => (await historicalFixture()).root;

test.after(async () => {
  if (historicalFixturePromise) await (await historicalFixturePromise).cleanup();
});

let latestFilesPromise: Promise<readonly CommercialExportFile[]> | undefined;

const currentCommercialFiles = (): Promise<readonly CommercialExportFile[]> =>
  latestFilesPromise ??= commercialFixtureRoot().then((root) => buildCommercialExportFiles(root, null));

test("impide exportaciones con fuentes comerciales cambiadas o selección de publicaciones obsoleta", async () => {
  const root = await commercialFixtureRoot();
  const files = await currentCommercialFiles();
  assert.equal(files.length, 4);

  const alteredReferences = withManifest(files, (manifest) => {
    manifest.taxonomySha256 = "0".repeat(64);
  });
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
  await assert.rejects(verifyCommercialExportSources(root, rewrittenExport),
    /fuentes originales o la proyección comercial cambiaron/);

  const subset = withManifest(files.filter((entry) => entry.name !== "mercaeleva-commercial.json"), (manifest) => {
    assert.ok(Array.isArray(manifest.providers));
    manifest.providers = manifest.providers.filter((item: unknown) => isRecord(item) && item.providerId !== "mercaeleva");
  });
  await assert.rejects(verifyCommercialExportSources(root, subset), /conjunto de publicaciones activas cambió/);
});

test("acredita el contrato real de los tres proveedores y la identidad de cada unidad", async () => {
  const files = await currentCommercialFiles();
  validateCommercialExportFiles(files);
  const actual = files.filter((entry) => entry.name !== "commercial-manifest.json");
  assert.deepEqual(actual.map((entry) => entry.name).sort(), [
    "gam-commercial.json", "gomariz-commercial.json", "mercaeleva-commercial.json"
  ]);
  for (const file of actual) {
    const plan: unknown = JSON.parse(file.content);
    assert.ok(isRecord(plan) && Array.isArray(plan.products) && Array.isArray(plan.excluded));
    assert.ok(plan.products.length > 0);
    assert.equal(plan.products.length + plan.excluded.length, plan.total);
    const sources: unknown = plan.sources;
    assert.ok(Array.isArray(sources) && sources.length === plan.products.length);
    const sourceUrls = plan.products.map((product: unknown, index: number) => {
      const origin: unknown = sources[index];
      assert.ok(isRecord(product) && typeof product.title === "string" && isRecord(origin) &&
        typeof origin.sourceUrl === "string");
      assert.ok(product.title.trim());
      assert.ok(!Object.hasOwn(product, "providerId") && !Object.hasOwn(product, "sourceUrl") &&
        !Object.hasOwn(product, "externalReference"));
      assert.equal(origin.reference, product.reference);
      return origin.sourceUrl;
    });
    assert.equal(new Set(sourceUrls).size, sourceUrls.length);
  }
});

test("entrega un ZIP acreditado y conserva el informe interno de develop sin modificar entregas anteriores", async () => {
  const directory = await mkdtemp(join(tmpdir(), "equipzilla-pair-"));
  const root = await commercialFixtureRoot();
  const files = await buildCommercialExportFiles(root, "develop");
  const date = new Date("2026-11-06T11:00:00.000Z");
  try {
    const previous = "equipzilla-informe-comercial-20261105-1234567890abcdef.zip";
    await writeFile(join(directory, previous), "entrega previa");
    const delivered = await deliverCommercialPackages(root, directory, files, date);
    assert.equal(delivered.providers, files.length - 1);
    assert.equal(delivered.environment, "develop");
    assert.ok(delivered.report);
    const commercialZip = readZipArchive(await readFile(delivered.commercial));
    assert.deepEqual(commercialZip.map((entry) => entry.name), files.map((file) => file.name));
    for (const entry of commercialZip) {
      assert.ok(entry.data.equals(Buffer.from(files.find((file) => file.name === entry.name)!.content, "utf8")));
    }
    const markdown = renderCommercialIntegrationReport(inspectCommercialPackage(files), "2026-11-06");
    assert.equal(await readFile(delivered.report, "utf8"), markdown);
    const selected = await inspectRepositoryArtifact(join(root, "catalogs", "reports", "commercial", "develop"), "INFORME.txt", ["INFORME.txt"]);
    assert.equal(selected?.sha256, createHash("sha256").update(markdown).digest("hex"));
    assert.equal(await readFile(join(directory, previous), "utf8"), "entrega previa");
    assert.equal((await readdir(directory)).length, 2);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
