import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { comparablePopulation, readEditorialPopulations } from '../editorial-populations.mjs';
import { editorialAuditCoverage, editorialAuditFingerprints, loadEditorialAuditPopulation, readEditorialAuditSource } from '../../operations/editorial-audit-population.mjs';
import { discoverAccreditedPublications, readAccreditedPublication } from '../../../dist/infrastructure/filesystem/catalog/publications/accredited-publication.js';
import { readPortableOriginalArtifacts } from '../../../dist/infrastructure/filesystem/catalog/originals/portable-original.js';
import { readVerifiedManainRecordSource } from '../../../dist/infrastructure/filesystem/catalog/originals/manain-record-source.js';
import { readActiveTechnicalPublication, activateTechnicalPublication } from '../../../dist/infrastructure/filesystem/catalog/publications/technical-publication.js';
import { CAMPAIGN_PROVIDERS } from '../../../dist/contracts/campaign-providers.js';
import { buildManainRecord } from '../../../dist/preparation/workflow/manain-record.js';
import { discardedManainProductUrls } from '../../../dist/preparation/manain/discarded-urls.js';
import { buildProductIdentity } from '../../../dist/catalog/identity.js';
import { toCsv } from '../../../dist/shared/csv.js';
import { baseProductHeaders } from '../../../dist/scraping/output/csv-serializer.js';
import { inspectPublicationOriginals } from '../publication-original-provenance.mjs';

const root = fileURLToPath(new URL('../../../', import.meta.url));

test('las tres poblaciones quedan separadas por corte, fuente y proveedor', async () => {
  const report = await readEditorialPopulations(root);
  assert.deepEqual(report.byStage.map((item) => item.stage),
    ['originales_canonicos', 'publicacion_final', 'publicacion_tecnica']);
  const accredited = await Promise.all((await discoverAccreditedPublications(root)).map(readAccreditedPublication));
  const totalPublished = accredited.reduce((sum, item) => sum + item.products.length, 0);
  const originalCounts = await Promise.all(CAMPAIGN_PROVIDERS.map(async (providerId) => {
    if (providerId === 'manain') return (await readVerifiedManainRecordSource(root)).originalProducts.length;
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
    [CAMPAIGN_PROVIDERS, accredited.map((item) => item.providerId),
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


test('la cobertura editorial deriva del contrato y distingue ausencias de procesamiento incompleto', () => {
  const providers = Object.fromEntries(CAMPAIGN_PROVIDERS.map((provider) => [provider, { exceptions: 0 }]));
  assert.deepEqual(editorialAuditCoverage(providers), {
    expected: CAMPAIGN_PROVIDERS, selected: CAMPAIGN_PROVIDERS, processed: CAMPAIGN_PROVIDERS,
    unavailable: [], incomplete: []
  });
  const [missing, incomplete] = CAMPAIGN_PROVIDERS;
  delete providers[missing];
  providers[incomplete] = { exceptions: 1 };
  assert.deepEqual(editorialAuditCoverage(providers).unavailable, [missing]);
  assert.deepEqual(editorialAuditCoverage(providers).incomplete, [incomplete]);
});


test('el registro parcial sintético se audita sin convertirlo en original canónico y exige el corte técnico', async () => {
  const temp = mkdtempSync(join(tmpdir(), 'equipzilla-editorial-record-'));
  try {
    const providerId = 'manain';
    const url = 'https://manain.com/producto/venta-elevacion-tijera-prueba/';
    const csv = toCsv([{ providerId, categoryKey: 'venta', categoryName: 'Maquinaria en venta',
      url, reference: 'REF-PRUEBA', title: 'Plataforma de tijera', condition: 'Segunda mano',
      specJson: JSON.stringify({ Peso: '2100 kg' }), imagesJson: '[]', breadcrumbsJson: '[]' }], baseProductHeaders);
    const sha = (text) => createHash('sha256').update(text).digest('hex');
    const urls = [url, ...discardedManainProductUrls];
    const census = { type: 'manain-diagnostic-census', providerId, complete: true, published: false,
      endReason: 'control-exhausted', urlCount: urls.length, urls };
    const summary = { quality: { status: 'partial', published: false },
      totals: { scrapedProducts: 1, discoveredProductUrls: urls.length, failures: discardedManainProductUrls.length },
      artifacts: { csvSha256: sha(csv) } };
    const errors = { quality: 'partial', failures: discardedManainProductUrls.map((url) =>
      ({ categoryKey: 'venta', url, error: 'Ficha inaccesible' })) };
    const record = buildManainRecord(csv, summary, errors, census);
    const directory = join(temp, 'catalogs', 'providers', providerId, 'records');
    mkdirSync(directory, { recursive: true });
    const path = join(directory, 'manain-record.json');
    const raw = `${JSON.stringify(record, null, 2)}\n`;
    writeFileSync(path, raw);
    await assert.rejects(readEditorialAuditSource(temp, providerId));
    const fingerprints = await editorialAuditFingerprints();
    await activateTechnicalPublication(temp, { version: 1, providerId, quality: 'partial',
      source: { kind: 'manain-record', recordSha256: sha(raw), sourceCsvSha256: record.sourceCsvSha256,
        rulesSha256: fingerprints.rulesSha256, discoveredProductUrls: record.discoveredProductUrls,
        discardedUrls: record.discardedUrls }, totals: record.totals,
      identities: record.products.map(({ original }) => buildProductIdentity(original).key),
      products: record.products.map(({ prepared }) => prepared) });
    const population = await loadEditorialAuditPopulation(temp, providerId, fingerprints);
    assert.equal(population.records.length, 1);
    assert.equal(population.prepared.length, 1);
    assert.equal(population.provenance.source.record.quality, 'partial');
    assert.equal(population.provenance.source.catalogSha256, sha(raw));
    assert.equal(readFileSync(path, 'utf8'), raw);
    const approvalSha256 = 'a'.repeat(64);
    const publications = join(directory, '..', 'publications');
    const version = join(publications, approvalSha256.slice(0, 12));
    mkdirSync(version, { recursive: true });
    writeFileSync(join(publications, 'active.json'), JSON.stringify({ version: 1, providerId, approvalSha256 }));
    writeFileSync(join(version, 'manifest.json'), JSON.stringify({ version: 1, providerId, approvalSha256,
      source: population.provenance.source }));
    assert.equal((await inspectPublicationOriginals(temp)).sources[0].available, true);
    writeFileSync(path, raw + ' ');
    await assert.rejects(readEditorialAuditSource(temp, providerId));
    assert.equal((await inspectPublicationOriginals(temp)).sources[0].current.state, 'INVALIDO');
    rmSync(path);
    await assert.rejects(readEditorialAuditSource(temp, providerId));
    assert.equal((await inspectPublicationOriginals(temp)).sources[0].current.state, 'AUSENTE');
  } finally {
    rmSync(temp, { recursive: true, force: true });
  }
});
