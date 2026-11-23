import assert from 'node:assert/strict';
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { comparablePopulation, readEditorialPopulations } from '../editorial-populations.mjs';
import { editorialAuditFingerprints, loadEditorialAuditPopulation } from '../../operations/editorial-audit-population.mjs';
import { prepareSourceProduct } from '../../../dist/preparation/prepare-product.js';
import { prepareImportBatch } from '../../../dist/preparation/batch-identity.js';
import { discoverAccreditedPublications, readAccreditedPublication } from '../../../dist/infrastructure/filesystem/catalog/accredited-publication.js';

const root = fileURLToPath(new URL('../../../', import.meta.url));

const gam = JSON.parse(readFileSync(resolve(root, 'catalogs/providers/gam/original/scrape-gam-catalog.json'), 'utf8'));
const record = (reference) => {
  const product = gam.products.find((item) => item.reference === reference);
  assert.ok(product, `Falta referencia histórica GAM ${reference}`);
  return product;
};

test('la auditoría por ficha no sustituye la calidad de preparación por lote', () => {
  const references = ['6682', '6703'];
  const rows = references.map(record);
  assert.ok(rows.every((item) => item.serialNumber === 'P177B10585U'));
  assert.ok(rows.every((item) => prepareSourceProduct(item).status === 'ready'));
  const prepared = prepareImportBatch(rows);
  assert.equal(prepared.totals.review, 2);
  assert.equal(prepared.totals.ready, 0);
  assert.ok(prepared.products.every((item) => item.issues.some((issue) => issue.includes('Número de serie'))));
  assert.ok(prepared.products.every((item) => item.issues.some((issue) => issue.includes('Stock GAM diferenciado'))));
});

test('excepciones de identidad verificadas no crean reviews adicionales', () => {
  for (const references of [['6835', '6858'], ['6806', '6807']]) {
    const rows = references.map(record);
    const results = prepareImportBatch(rows);
    assert.equal(results.totals.review, 0);
    assert.equal(results.totals.ready, 2);
  }
});

test('las tres poblaciones quedan separadas por corte, fuente y proveedor', async () => {
  const report = await readEditorialPopulations(root);
  assert.deepEqual(report.byStage.map((item) => item.stage),
    ['originales_canonicos', 'publicacion_final', 'publicacion_tecnica']);
  const accredited = await Promise.all((await discoverAccreditedPublications(root)).map(readAccreditedPublication));
  const totalPublished = accredited.reduce((sum, item) => sum + item.products.length, 0);
  assert.deepEqual(report.byStage.map((item) => item.products), [1751, totalPublished, 931]);
  assert.deepEqual(report.byStage[1].providers.map((item) => [item.providerId, item.products]),
    accredited.map((item) => [item.providerId, item.products.length]));
  assert.deepEqual(report.byStage.map((item) => item.providers.map((provider) => provider.providerId)),
    [['gam', 'gomariz', 'mercaeleva'], accredited.map((item) => item.providerId), ['gomariz', 'manain']]);
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
  assert.equal(report.byStage[2].providers.find((item) => item.providerId === 'manain').complete, false);
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
