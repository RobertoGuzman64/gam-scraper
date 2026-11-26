import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { lstat, readFile, readdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import test from "node:test";
import { resolveAccreditedPublication, readAccreditedPublication } from "../../infrastructure/filesystem/catalog/publications/accredited-publication.js";
import { publicationApprovalSha } from "../../infrastructure/filesystem/catalog/publications/publication-identity.js";
import { buildNormalizationAudit } from "../../infrastructure/filesystem/preparation/normalization-audit.js";
import { formatNormalizationAudit } from "../../cli/reporting/audits/normalization-audit.js";
import { CAMPAIGN_PROVIDERS } from "../../contracts/campaign-providers.js";
import { publishIndividualCatalogs } from "../individual/individual-finish.js";
import { createIndividualFinishWorkspace, finishProviders, publishIndividualTestWorkspace } from "../../testing/builders/individual-finish-fixture.js";
import { readPortableOriginal } from "../../infrastructure/filesystem/catalog/originals/portable-original.js";
import { seedHistoricalPlatformPublication } from "../../testing/builders/publication-version-fixture.js";
import { inspectIndividualFinishPreflight } from "../individual/finish-preflight.js";

const withWorkspace = createIndividualFinishWorkspace();
const fileSha = async (file: string): Promise<string> => createHash("sha256").update(await readFile(file)).digest("hex");

test("ciclo completo: simular sin escrituras, 3 activaciones sin ZIP, SHA, y repetición idempotente", async () => {
  await withWorkspace(async (root, desktop) => {
    const source = join(root, "catalogs", "providers", "gam", "original", "scrape-gam-catalog.json");
    const sourceSha = await fileSha(source);
    const beforeAudit = await buildNormalizationAudit(root);
    assert.equal(beforeAudit.complete, false);
    assert.deepEqual(beforeAudit.provenance.population.processed, []);
    assert.deepEqual(beforeAudit.provenance.population.unavailable, CAMPAIGN_PROVIDERS);
    for (const providerId of finishProviders) {
      assert.match(beforeAudit.auditCoverage.failures.find((failure) => failure.providerId === providerId)?.detail ?? "", /No existe publicación acreditada/u);
    }
    assert.deepEqual(await readdir(desktop), []);
    await assert.rejects(lstat(join(root, "storage", "publication")), { code: "ENOENT" });
    const original = await readPortableOriginal(root, "gomariz");
    const unit = original.products.find((item) => item.specs?.["Altura plataforma"] === "6,2 m");
    assert.ok(unit);
    const historicalSha = await seedHistoricalPlatformPublication(root, unit);
    const activeIndex = join(root, "catalogs", "providers", "gomariz", "publications", "active.json");
    const initialIndex = await readFile(activeIndex, "utf8");
    const publicationFolder = dirname(activeIndex);
    const initialVersions = await readdir(publicationFolder);
    const preflight = await inspectIndividualFinishPreflight(root, finishProviders);
    assert.equal(preflight.complete, true, JSON.stringify(preflight.providers.map((item) => item.blockers)));
    const progress: string[] = [];
    const dry = await publishIndividualCatalogs({
      workspace: root, providers: finishProviders, dryRun: true, desktopDirectory: null,
      onProgress: (stage, providerId, completed, total) => progress.push(`${stage} ${providerId} ${completed}/${total}`)
    });
    assert.deepEqual(progress, [
      "ACREDITACIÓN gam 0/3", "ACREDITACIÓN gam 1/3",
      "ACREDITACIÓN gomariz 1/3", "ACREDITACIÓN gomariz 2/3",
      "ACREDITACIÓN mercaeleva 2/3", "ACREDITACIÓN mercaeleva 3/3",
      "INSPECCIÓN gam 1/3", "INSPECCIÓN gomariz 2/3", "INSPECCIÓN mercaeleva 3/3"
    ]);
    assert.equal(dry.mode, "simulation");
    assert.equal(dry.providers.length, 3);
    assert.deepEqual(dry.providers.map((item) => item.activeSha256), [null, historicalSha, null]);
    assert.deepEqual(dry.providers.map((item) => item.difference), preflight.providers.map((item) => item.difference));
    const causalDifference = dry.providers.find((item) => item.providerId === "gomariz")?.difference;
    assert.equal(causalDifference?.removedSpecifications.length, 1);
    assert.ok(causalDifference?.removedSpecifications[0]?.endsWith(":Altura plataforma"));
    assert.equal(await readFile(activeIndex, "utf8"), initialIndex);
    assert.deepEqual(await readdir(publicationFolder), initialVersions);
    for (const id of ["gam", "mercaeleva"]) {
      await assert.rejects(lstat(join(root, "catalogs", "providers", id, "publications")), { code: "ENOENT" });
    }
    assert.deepEqual(await readdir(desktop), []);
    await assert.rejects(lstat(join(root, "storage", "publication")), { code: "ENOENT" });
    const published = await publishIndividualTestWorkspace(root, desktop);
    assert.equal(published.mode, "complete");
    assert.deepEqual(published.providers.map((item) => item.difference), dry.providers.map((item) => item.difference));
    assert.deepEqual(published.providers.map((item) => item.status), Array(3).fill("ACTIVADA Y VERIFICADA"));
    const zips = await readdir(desktop);
    assert.deepEqual(zips, []);
    assert.ok(published.providers.every((item) => item.zipFile === null));
    const versions: string[] = [];
    for (const id of finishProviders) {
      const active = await resolveAccreditedPublication(root, id);
      assert.ok(active);
      const publication = await readAccreditedPublication(active);
      assert.equal(publication.providerId, id);
      const approval = await publicationApprovalSha(dirname(active));
      const index: { approvalSha256: string } = JSON.parse(await readFile(join(root, "catalogs", "providers", id, "publications", "active.json"), "utf8"));
      assert.equal(index.approvalSha256, approval);
      versions.push(approval);
      await assert.rejects(lstat(join(root, "storage", "providers", id, "deliveries")), { code: "ENOENT" });
    }
    const journals = (await readdir(join(root, "storage", "publication", "individual-finish"))).filter((name) => name.endsWith(".json"));
    assert.equal(journals.length, 1);
    const journal: { status: string; completed: readonly string[] } = JSON.parse(await readFile(join(root, "storage", "publication", "individual-finish", journals[0]!), "utf8"));
    assert.equal(journal.status, "complete");
    assert.deepEqual(journal.completed, finishProviders);
    const audit = await buildNormalizationAudit(root);
    assert.equal(audit.complete, false);
    assert.deepEqual(audit.provenance.population.processed, finishProviders);
    assert.deepEqual(audit.provenance.population.unavailable, CAMPAIGN_PROVIDERS.filter((provider) => !finishProviders.some((id) => id === provider)));
    assert.equal(audit.auditCoverage.evaluated, finishProviders.length);
    for (const provider of audit.providers) {
      assert.ok(provider.publishedProducts);
      assert.equal(provider.publicationSha256[0], audit.provenance.sources.find((item) => item.providerId === provider.providerId)?.publication.sha256);
    }
    const lines = formatNormalizationAudit(audit, { limit: 20, detailed: true }).join("\n");
    assert.match(lines, /COBERTURA PARCIAL/u);
    assert.match(lines, /Origen .*publicación/u);
    assert.deepEqual(await readdir(desktop), zips);
    assert.equal(await fileSha(source), sourceSha);
    const second = await publishIndividualTestWorkspace(root, desktop);
    assert.ok(second.providers.every((item) => item.status === "YA VIGENTE"));
    assert.deepEqual(await readdir(desktop), zips);
    assert.equal(await fileSha(source), sourceSha);
    for (const [index, id] of finishProviders.entries()) {
      const active = await resolveAccreditedPublication(root, id);
      assert.ok(active);
      assert.equal(await publicationApprovalSha(dirname(active)), versions[index]);
    }
  });
});
