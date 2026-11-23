import assert from 'node:assert/strict';
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { comparablePopulation, readEditorialPopulations } from '../editorial-populations.mjs';
import { editorialAuditFingerprints, loadEditorialAuditPopulation } from '../../operations/editorial-audit-population.mjs';
import { discoverAccreditedPublications, readAccreditedPublication } from '../../../dist/infrastructure/filesystem/catalog/accredited-publication.js';
import { readPortableOriginalArtifacts } from '../../../dist/infrastructure/filesystem/catalog/portable-original.js';
import { readActiveTechnicalPublication } from '../../../dist/infrastructure/filesystem/catalog/technical-publication.js';
import { LEGACY_CAMPAIGN_PROVIDERS, CAMPAIGN_PROVIDERS } from '../../../dist/contracts/campaign-providers.js';

const root = fileURLToPath(new URL('../../../', import.meta.url));

test('las tres poblaciones quedan separadas por corte, fuente y proveedor', async () => {
  const report = await readEditorialPopulations(root);
  assert.deepEqual(report.byStage.map((item) => item.stage),
    ['originales_canonicos', 'publicacion_final', 'publicacion_tecnica']);
  const accredited = await Promise.all((await discoverAccreditedPublications(root)).map(readAccreditedPublication));
  const totalPublished = accredited.reduce((sum, item) => sum + item.products.length, 0);
  const originalCounts = await Promise.all(LEGACY_CAMPAIGN_PROVIDERS.map(async (providerId) => {
    const { catalog } = await readPortableOriginalArtifacts(root, providerId);
    return catalog.productCount;
  }));
  const technicalPublications = (await Promise.all(CAMPAIGN_PROVIDERS.map(async (providerId) =>
    ({ providerId, active: await readActiveTechnicalPublication(root, providerId) })))).filter(({ active }) => active !== null);
  const technicalTotal = technicalPublications.length > 0
    ? technicalPublications.reduce((sum, { active }) => sum + active.snapshot.products.length, 0) : null;
  assert.deepEqual(report.byStage.map((item) => item.products), [
    originalCounts.reduce((sum, count) => sum + count, 0), totalPublished, technicalTotal
  ]);
  assert.deepEqual(report.byStage[1].providers.map((item) => [item.providerId, item.products]),
    accredited.map((item) => [item.providerId, item.products.length]));
  assert.deepEqual(report.byStage.map((item) => item.providers.map((provider) => provider.providerId)),
    [LEGACY_CAMPAIGN_PROVIDERS, accredited.map((item) => item.providerId),
      technicalPublications.map((item) => item.providerId)]);
  for (const stage of report.byStage) {
    assert.equal(stage.products, stage.providers.reduce((sum, item) => sum + item.products, 0));
    assert.ok(stage.providers.every((item) => item.sourceCut && item.sourceSha256));
  }
  const originals = report.byStage[0].providers;
  const finals = report.byStage[1].providers;
  assert.equal(comparablePopulation(originals[0], originals[0]), true);
  assert.equal(comparablePopulation(originals[0], originals[1]), false);
  assert.equal(comparablePopulation(originals[0], finals[0]), false);
  assert.equal(comparablePopulation(originals[0], { ...originals[0], rulesSha256: 'otro-corte' }), false);
  assert.equal(comparablePopulation(originals[0], { ...originals[0], sourceCut: 'otro-corte' }), false);
  for (const { providerId, active } of technicalPublications) {
    const item = report.byStage[2].providers.find((candidate) => candidate.providerId === providerId);
    assert.ok(item);
    assert.equal(item.products, active.snapshot.products.length);
    assert.equal(item.complete, active.snapshot.quality === 'complete');
  }
});

test('un original adulterado no se convierte en una población auditable', async () => {
  const temp = mkdtempSync(join(tmpdir(), 'equipzilla-operativa-f3-'));
  try {
    const source = resolve(root, 'catalogs/providers/gam/original');
    const destination = join(temp, 'catalogs/providers/gam/original');
    mkdirSync(destination, { recursive: true });
    for (const name of ['scrape-gam-catalog.json', 'scrape-gam-catalog.manifest.json', 'scrape-gam-summary.json']) {
      copyFileSync(join(source, name), join(destination, name));
    }
    const manifestPath = join(destination, 'scrape-gam-catalog.manifest.json');
    const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
    writeFileSync(manifestPath, JSON.stringify({ ...manifest, catalogSha256: '0'.repeat(64) }));
    const fingerprints = await editorialAuditFingerprints();
    await assert.rejects(loadEditorialAuditPopulation(temp, 'gam', fingerprints),
      /catálogo y su manifest pertenecen a ejecuciones distintas|SHA|huella/u);
  } finally {
    rmSync(temp, { recursive: true, force: true });
  }
});
