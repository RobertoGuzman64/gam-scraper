import assert from "node:assert/strict";
import { mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { createManainSelectionWorkspace } from "../../testing/builders/manain-individual-selection-fixture.js";
import { runPublishIndividual } from "../../cli/commands/catalog/publish-individual.js";
import { resolveAccreditedPublication, readAccreditedPublication } from "../../infrastructure/filesystem/catalog/accredited-publication.js";
import { publicationOriginalSources } from "../../infrastructure/filesystem/catalog/accredited-publication-original.js";
import { collectPublishedWork } from "../individual-work-report.js";
import { deliverPublishedWorkReport } from "../../cli/reporting/published-work-archive.js";
import type { PublishedWorkReport } from "../../catalog/diagnostics/published-work.js";
import { deliverIndividualProvider } from "../individual-delivery.js";
import { listIndividualFinishJournals } from "../../infrastructure/filesystem/catalog/individual-finish-journal.js";
import { approveIndividualEditorial, decideIndividualEditorial, startIndividualEditorial } from "../individual-editorial.js";
import { loadImportCatalogSnapshot } from "../../infrastructure/filesystem/legacy-export/import-catalog-loader.js";
import { loadCommercialReference } from "../../infrastructure/filesystem/legacy-export/commercial-reference-loader.js";
import { readCommercialPublicationInput } from "../../commercial/export/commercial-inputs.js";
import { planCommercialExport } from "../../commercial/projection/export-projection.js";
import { accreditCommercialPlan } from "../../commercial/diagnostics/commercial-accreditation.js";
import { assembleCommercialExportFiles } from "../../commercial/export/commercial-export.js";
import { validateCommercialExportFiles } from "../../commercial/export/commercial-export-verification.js";
import { inspectCommercialExportPreflight } from "../../commercial/export/commercial-export-preflight.js";

test("Manain: FINISH activa 383 fichas solo tras aprobación humana y conserva su procedencia", async () => {
  const { root, source, preparation } = await createManainSelectionWorkspace();
  const desktop = await mkdtemp(join(tmpdir(), "equipzilla-manain-finish-desktop-"));
  try {
    const original = await readFile(source);
    const options = { rootDirectory: root, providerId: "manain", catalogFile: source, preparationFile: preparation };
    const opened = await startIndividualEditorial(options);
    const exclusion = opened.accreditation.exclusions[0];
    assert.ok(exclusion);
    await decideIndividualEditorial(options, {
      reference: exclusion.reference, decision: "excluir",
      reason: "Alcance máximo ambiguo sin interpretación técnica acreditada",
      evidenceUrls: [exclusion.sourceUrl]
    });
    await assert.rejects(readFile(join(root, "catalogs", "providers", "manain", "publications", "active.json")), { code: "ENOENT" });
    await approveIndividualEditorial(options, "Aprobación humana expresa de las 383 fichas listas y exclusión de MA3727");
    const reports: PublishedWorkReport[] = [];
    const reporter: typeof deliverPublishedWorkReport = async (workspace, directory, result) => {
      const delivery = await deliverPublishedWorkReport(workspace, directory, result);
      reports.push(delivery.report);
      return delivery;
    };
    const finish = await runPublishIndividual(["--proveedor", "manain"], root, {
      desktopDirectory: desktop, retention: async () => {}, auditor: async () => {}, reporter
    });
    assert.equal(finish?.mode, "complete");
    assert.equal(finish?.providers[0]?.status, "ACTIVADA Y VERIFICADA");
    const file = await resolveAccreditedPublication(root, "manain");
    assert.ok(file);
    const published = await readAccreditedPublication(file);
    assert.equal(published.products.length, 383);
    assert.ok(!published.products.some((product) => product.reference === "MA3727"));
    const originals = await publicationOriginalSources(root, file, "manain", published.products);
    assert.equal(originals.size, 384);
    assert.ok(finish);
    assert.equal(reports.length, 1);
    const report = reports[0];
    assert.ok(report);
    assert.equal(report.total.originalProducts, 384);
    assert.equal(report.total.publishedProducts, 383);
    assert.equal(report.total.excludedProducts, 1);
    const journals = await listIndividualFinishJournals(root);
    assert.equal(journals.length, 1);
    assert.equal(journals[0]?.journal.status, "complete");
    assert.equal(journals[0]?.journal.closure?.phase, "reported");
    const retention = JSON.parse(await readFile(join(root, "catalogs", "providers", "manain", "publication-retention.json"), "utf8"));
    assert.equal(retention.previousSha256, null);
    assert.equal((await readdir(desktop)).length, 2);
    assert.equal((await deliverIndividualProvider(options, "verify")).publishable, 383);
    assert.deepEqual(await readFile(source), original);
    const [catalog, references] = await Promise.all([loadImportCatalogSnapshot(), loadCommercialReference()]);
    const input = await readCommercialPublicationInput(root, file, catalog.catalog);
    const companyID = references.companies.manain?.develop;
    assert.ok(companyID);
    const plan = planCommercialExport(input.entries, "manain", input.publicationSha256,
      catalog.catalog, references.brandLogos, "develop", companyID);
    const accreditation = accreditCommercialPlan(input.entries, plan, catalog.catalog, references.brandLogos, companyID);
    assert.equal(input.originalProducts, 384);
    assert.equal(plan.total, 383);
    assert.equal(plan.summary.exported, 375);
    assert.equal(plan.summary.categorized, 351);
    assert.equal(plan.summary.excludedTools, 8);
    assert.deepEqual(plan.excluded.map((item) => item.reference).sort(),
      ["MAN169", "MAN671", "MAN676", "MAN677", "MAN680", "MAN681", "MAN682", "MAN683"]);
    assert.ok(plan.excluded.every((item) => item.reason === "herramienta"));
    for (const reference of ["MAN980", "MAN1188", "MAN553", "MAN685", "MAN118", "MAN743", "MAN742"]) {
      assert.ok(plan.products.some((product) => product.reference === reference));
    }
    assert.equal(plan.summary.pendingCategory, 24);
    assert.equal(plan.summary.attributes, 2209);
    assert.equal(plan.summary.withPrice, 0);
    assert.equal(plan.summary.withCompany, 375);
    assert.equal(accreditation.summary.blocking, 0);
    assert.ok(!plan.products.some((product) => product.reference === "MA3727"));
    const commercialFiles = assembleCommercialExportFiles([{ plan, recognitions: new Map() }],
      catalog, references, "develop");
    assert.deepEqual(commercialFiles.map((entry) => entry.name), ["manain-commercial.json", "commercial-manifest.json"]);
    assert.doesNotThrow(() => validateCommercialExportFiles(commercialFiles));
    const preflight = await inspectCommercialExportPreflight(root, null);
    assert.deepEqual(preflight.publications.map((item) => item.providerId), ["manain"]);
    assert.deepEqual(preflight.failures.map((item) => item.providerId), ["gam", "gomariz", "mercaeleva"]);
    const manifestPath = join(file, "..", "manifest.json");
    const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
    manifest.source.record.technicalSha256 = "0".repeat(64);
    await writeFile(manifestPath, JSON.stringify(manifest));
    await assert.rejects(publicationOriginalSources(root, file, "manain", published.products), /procedencia parcial verificada/);
    await assert.rejects(collectPublishedWork(root, finish), /procedencia parcial/);
  } finally {
    await rm(root, { recursive: true, force: true });
    await rm(desktop, { recursive: true, force: true });
  }
});
