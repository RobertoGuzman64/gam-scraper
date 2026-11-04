import assert from "node:assert/strict";
import test from "node:test";
import { readFile, readdir, rm, writeFile } from "node:fs/promises";
import { basename } from "node:path";
import { readZipArchive } from "../../../infrastructure/archive/zip.js";
import { collectPublishedWork } from "../individual-work-report.js";
import { deliverPublishedWorkReport } from "../../../cli/reporting/published-work-archive.js";
import { createIndividualFinishWorkspace, publishIndividualTestWorkspace } from "../../../testing/builders/individual-finish-fixture.js";

const withWorkspace = createIndividualFinishWorkspace();

test("exporta un solo Markdown ZIP verificable e idéntico en reejecuciones", async () => {
  await withWorkspace(async (root, desktop) => {
    const result = await publishIndividualTestWorkspace(root, desktop);
    const delivery = await deliverPublishedWorkReport(root, desktop, result);
    assert.equal(delivery.report.total.publishedProducts, result.providers.reduce((count, p) => count + p.publishable, 0));
    const archive = await readFile(delivery.zipFile);
    const entries = readZipArchive(archive);
    assert.equal(entries.length, 1);
    assert.equal(entries[0]?.name, "INFORME.md");
    assert.match(entries[0]?.data.toString("utf8") ?? "", /Trabajo acumulado publicado/);
    const again = await deliverPublishedWorkReport(root, desktop, result);
    assert.equal(again.zipFile, delivery.zipFile);
    assert.ok((await readFile(again.zipFile)).equals(archive));
    assert.equal((await readdir(desktop)).filter((name) => name.startsWith("equipzilla-informe-")).length, 1);
    assert.ok(basename(delivery.zipFile).startsWith("equipzilla-informe-"));
  });
});

test("no sobrescribe ZIP de informe manipulado; admite recuperación por reintento", async () => {
  await withWorkspace(async (root, desktop) => {
    const result = await publishIndividualTestWorkspace(root, desktop);
    const delivery = await deliverPublishedWorkReport(root, desktop, result);
    await writeFile(delivery.zipFile, "alterado");
    await assert.rejects(deliverPublishedWorkReport(root, desktop, result), /no coincide/);
    assert.equal(await readFile(delivery.zipFile, "utf8"), "alterado");
    await rm(delivery.zipFile);
    const recovered = await deliverPublishedWorkReport(root, desktop, result);
    assert.equal(recovered.zipFile, delivery.zipFile);
  });
});

test("rechaza simulaciones y aprobaciones distintas de la publicación vigente", async () => {
  await withWorkspace(async (root, desktop) => {
    const result = await publishIndividualTestWorkspace(root, desktop);
    await assert.rejects(collectPublishedWork(root, { ...result, mode: "simulation" }), /solo para publicaciones/);
    const first = result.providers[0];
    assert.ok(first);
    await assert.rejects(collectPublishedWork(root, {
      ...result, providers: [{ ...first, approvalSha256: "0".repeat(64) }]
    }), /aprobación vigente cambiada/);
  });
});
