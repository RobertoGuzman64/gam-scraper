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
import { retainPublishedWorkReport } from "../../cli/reporting/published-work-archive.js";
import type { PublishedWorkReport } from "../../catalog/diagnostics/published-work.js";
import { deliverIndividualProvider } from "../individual-delivery.js";
import { listIndividualFinishJournals } from "../../infrastructure/filesystem/catalog/individual-finish-journal.js";
import { approveIndividualEditorial, startIndividualEditorial } from "../individual-editorial.js";
import { readIndividualSelection } from "../individual-selection.js";
import { loadImportCatalogSnapshot } from "../../infrastructure/filesystem/legacy-export/import-catalog-loader.js";
import { loadCommercialReference } from "../../infrastructure/filesystem/legacy-export/commercial-reference-loader.js";
import { readCommercialPublicationInput } from "../../commercial/export/commercial-inputs.js";
import { planCommercialExport } from "../../commercial/projection/export-projection.js";
import { accreditCommercialPlan } from "../../commercial/diagnostics/commercial-accreditation.js";
import { assembleCommercialExportFiles } from "../../commercial/export/commercial-export.js";
import { validateCommercialExportFiles } from "../../commercial/export/commercial-export-verification.js";
import { inspectCommercialExportPreflight } from "../../commercial/export/commercial-export-preflight.js";
import { stageReviewedTestExclusions } from "./stage-reviewed-test-exclusions.js";

test("Manain: FINISH requiere acreditación expresa y conserva la procedencia parcial", async () => {
  const { root, source, preparation } = await createManainSelectionWorkspace();
  const desktop = await mkdtemp(join(tmpdir(), "equipzilla-manain-finish-desktop-"));
  try {
    const original = await readFile(source);
    const options = { rootDirectory: root, providerId: "manain", catalogFile: source, preparationFile: preparation };
    const opened = await startIndividualEditorial(options);
    const selection = await readIndividualSelection("manain", source, preparation);
    const ready = selection.preparation.totals.ready;
    const originalCount = selection.preparation.products.length;
    const exclusions = opened.accreditation.exclusions;
    assert.ok(exclusions.length > 0);
    await stageReviewedTestExclusions(opened);
    await assert.rejects(readFile(join(root, "catalogs", "providers", "manain", "publications", "active.json")), { code: "ENOENT" });
    await approveIndividualEditorial(options, "Aprobación editorial simulada en prueba aislada de FINISH");
    const reports: PublishedWorkReport[] = [];
    const reporter: typeof retainPublishedWorkReport = async (workspace, result) => {
      const delivery = await retainPublishedWorkReport(workspace, result);
      reports.push(delivery.report);
      return delivery;
    };
    const finish = await runPublishIndividual(["--proveedor", "manain"], root, {
      desktopDirectory: desktop, retention: async () => {}, reporter
    });
    assert.equal(finish?.mode, "complete");
    assert.equal(finish?.providers[0]?.status, "ACTIVADA Y VERIFICADA");
    const file = await resolveAccreditedPublication(root, "manain");
    assert.ok(file);
    const published = await readAccreditedPublication(file);
    assert.equal(published.products.length, ready);
    assert.ok(published.products.every((product) => !exclusions.some((item) => item.reference === product.reference)));
    const originals = await publicationOriginalSources(root, file, "manain", published.products);
    assert.equal(originals.size, originalCount);
    assert.ok(finish);
    assert.equal(reports.length, 1);
    const report = reports[0];
    assert.ok(report);
    assert.equal(report.total.originalProducts, originalCount);
    assert.equal(report.total.publishedProducts, ready);
    assert.equal(report.total.excludedProducts, exclusions.length);
    const journals = await listIndividualFinishJournals(root);
    assert.equal(journals.length, 1);
    assert.equal(journals[0]?.journal.status, "complete");
    assert.equal(journals[0]?.journal.closure?.phase, "reported");
    const retention = JSON.parse(await readFile(join(root, "catalogs", "providers", "manain", "publication-retention.json"), "utf8"));
    assert.equal(retention.previousSha256, null);
    assert.deepEqual(await readdir(desktop), []);
    assert.equal((await deliverIndividualProvider(options, "verify")).publishable, ready);
    assert.deepEqual(await readFile(source), original);
    const [catalog, references] = await Promise.all([loadImportCatalogSnapshot(), loadCommercialReference()]);
    const input = await readCommercialPublicationInput(root, file, catalog.catalog);
    const companyID = references.companies.manain?.develop;
    assert.ok(companyID);
    const plan = planCommercialExport(input.entries, "manain", input.publicationSha256,
      catalog.catalog, references.brandLogos, "develop", companyID);
    const accreditation = accreditCommercialPlan(input.entries, plan, catalog.catalog, references.brandLogos, companyID);
    assert.equal(input.originalProducts, originalCount);
    assert.equal(plan.total, ready);
    assert.equal(plan.summary.exported, plan.total - plan.summary.excludedTools);
    assert.equal(plan.summary.categorized, plan.summary.exported - plan.summary.pendingCategory);
    assert.equal(plan.summary.excludedTools, plan.excluded.length);
    assert.ok(plan.excluded.every((item) => item.reason === "herramienta"));
    assert.equal(plan.summary.pendingCategory,
      plan.products.filter((product) => product.categorySellID === null).length);
    assert.equal(new Set(plan.products.map((product) => product.reference)).size, plan.products.length);
    assert.ok(plan.summary.attributes > 0);
    assert.equal(plan.summary.withPrice, plan.products.filter((product) => product.price !== null).length);
    assert.equal(plan.summary.withCompany, plan.summary.exported);
    assert.equal(accreditation.summary.blocking, 0);
    assert.ok(plan.products.every((product) => !exclusions.some((item) => item.reference === product.reference)));
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
