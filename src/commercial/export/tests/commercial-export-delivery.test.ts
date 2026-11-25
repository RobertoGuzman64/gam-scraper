import assert from "node:assert/strict";
import { access, mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { loadImportCatalogSnapshot } from "../../../infrastructure/filesystem/legacy-export/import-catalog-loader.js";
import { loadCommercialReference } from "../../../infrastructure/filesystem/legacy-export/commercial-reference-loader.js";
import { assembleCommercialExportFiles } from "../commercial-export.js";
import { createZipArchive, readZipArchive } from "../../../infrastructure/archive/zip.js";
import { assertCommercialPackageProviders, inspectCommercialPackage, validateStoredCommercialPackage } from "../commercial-package-snapshot.js";
import { retainRepositoryArtifact } from "../../../infrastructure/filesystem/catalog/repository-artifact-snapshot.js";
import { CAMPAIGN_PROVIDERS } from "../../../contracts/campaign-providers.js";
import { renderCommercialIntegrationReport } from "../../../cli/reporting/commercial/commercial-integration-report.js";
import { deliverGrouped } from "../../../cli/reporting/commercial/grouped-delivery.js";
import { publishCommercialArchivePair, verifyCommercialIntegrationArchive } from "../../../cli/reporting/commercial/commercial-package-delivery.js";
import { emptyPlan, filesForProvider, planWithProduct } from "./commercial-export-verification-fixture.js";

test("el informe identifica fuentes, excepciones, límites de integración y detecta manipulación", () => {
  const files = filesForProvider(planWithProduct());
  const snapshot = inspectCommercialPackage(files);
  assert.throws(() => assertCommercialPackageProviders(snapshot), /GAM, Gomariz y Mercaeleva/);
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

test("entrega exclusivamente los informes activos del entorno sin modificar selecciones", async () => {
  const directory = await mkdtemp(join(tmpdir(), "equipzilla-grouped-reports-"));
  const root = join(directory, "repo");
  const desktop = join(directory, "desktop");
  try {
    await mkdir(desktop);
    const [catalog, references] = await Promise.all([loadImportCatalogSnapshot(), loadCommercialReference()]);
    const files = assembleCommercialExportFiles(CAMPAIGN_PROVIDERS.map((providerId) => ({
      plan: { ...emptyPlan(), providerId, environment: "develop" }, recognitions: new Map()
    })), catalog, references, "develop");
    const commercialDirectory = join(root, "catalogs", "commercial", "develop");
    await retainRepositoryArtifact(commercialDirectory, "commercial-manifest.json", files, validateStoredCommercialPackage);
    const technicalDirectory = join(root, "catalogs", "reports", "individual-finish");
    const commercialReportDirectory = join(root, "catalogs", "reports", "commercial", "develop");
    const technical = "# EQUIPZILLA — Trabajo acumulado publicado\n\nInforme de prueba\n";
    const commercial = renderCommercialIntegrationReport(inspectCommercialPackage(files), "2026-11-06");
    await retainRepositoryArtifact(technicalDirectory, "INFORME.txt", [{ name: "INFORME.txt", content: technical }]);
    const reportSha = await retainRepositoryArtifact(commercialReportDirectory, "INFORME.txt", [{ name: "INFORME.txt", content: commercial }]);
    const paths = [technicalDirectory, commercialReportDirectory, commercialDirectory].map((folder) => join(folder, "active.json"));
    const before = await Promise.all(paths.map((path) => readFile(path, "utf8")));
    const zip = await deliverGrouped(root, desktop, { kind: "informes", environment: "develop" });
    assert.deepEqual(readZipArchive(await readFile(zip)), [
      { name: "tecnico/INFORME.txt", data: Buffer.from(technical) },
      { name: "comercial/develop/INFORME.txt", data: Buffer.from(commercial) }
    ]);
    assert.equal(await deliverGrouped(root, desktop, { kind: "informes", environment: "develop" }), zip);
    assert.deepEqual(await Promise.all(paths.map((path) => readFile(path, "utf8"))), before);
    await assert.rejects(deliverGrouped(root, desktop, { kind: "informes", environment: "production" }), /Informe vigente ausente/);
    const reportPath = join(commercialReportDirectory, "versions", reportSha, "INFORME.txt");
    await writeFile(reportPath, "alterado");
    await assert.rejects(deliverGrouped(root, desktop, { kind: "informes", environment: "develop" }), /Huella del artefacto/);
    await writeFile(reportPath, commercial);
    await retainRepositoryArtifact(commercialReportDirectory, "INFORME.txt", [{ name: "INFORME.txt", content: commercial.replace("- Entorno: develop", "- Entorno: production") }]);
    await assert.rejects(deliverGrouped(root, desktop, { kind: "informes", environment: "develop" }), /no corresponde/);
    assert.equal((await readdir(desktop)).length, 1);
  } finally { await rm(directory, { recursive: true, force: true }); }
});
