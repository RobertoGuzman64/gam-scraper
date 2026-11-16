import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import { loadEditorialHistoryInventory } from '../editorial-history-inventory.mjs';
import { loadActiveEditorialPublications } from '../editorial-history-publications.mjs';
import { inspectEditorialApprovedCorrection } from '../editorial-history-approved-corrections.mjs';
import { reconcileGamVerifiedYaleGp80vx as reconcileYale } from '../../../dist/preparation/gam/technical/reconciliation/gam-yale-gp80vx.js';
import { reconcileGamVerifiedXcmg1523Model as reconcileXcmg } from '../../../dist/preparation/gam/technical/models/xcmg-1523-model-evidence.js';
import { reconcileGamVerifiedHysterH45fts5Title as reconcileHysterTitle,
  verifiedGamHysterH45fts5Editorial as verifiedHysterEditorial } from '../../../dist/preparation/gam/technical/reconciliation/gam-hyster-h45fts5.js';
import { reconcileGamVerifiedEditorialCoherence as reconcileEditorialCoherence } from '../../../dist/preparation/gam/technical/reconciliation/gam-verified-capacity-coherence.js';
import { normalizeMercaelevaAusaHeightText as normalizeAusaHeight } from '../../../dist/preparation/mercaeleva/technical/reconciliation/mercaeleva-ausa-height.js';

const root = resolve(fileURLToPath(new URL('../../..', import.meta.url)));
const read = (path) => JSON.parse(readFileSync(resolve(root, path), 'utf8'));
const originals = new Map(['gam', 'gomariz', 'mercaeleva'].flatMap((provider) =>
  read(`catalogs/providers/${provider}/original/scrape-${provider}-catalog.json`).products)
  .map((record) => [`${record.providerId}:${record.reference}`, record]));
const publications = new Map(loadActiveEditorialPublications(root).flatMap((group) =>
  group.products.map((product) => [`${product.providerId}:${product.reference}`, product])));
const inventory = loadEditorialHistoryInventory(root);
const reconciliation = { reconcileYale, reconcileXcmg, reconcileHysterTitle,
  verifiedHysterEditorial, reconcileEditorialCoherence, normalizeAusaHeight };
const candidates = [
  ['gam:2328', 'general', 'identidad_yale_corregida'],
  ['gam:4802', 'general', 'identidad_xcmg_corregida'],
  ['gam:5258', 'short', 'identidad_hyster_corregida'],
  ['gam:6666', 'short', 'identidad_hyster_corregida'],
  ['mercaeleva:M855-6850', 'general', 'notacion_altura_ausa_corregida'],
  ['mercaeleva:M640-1938', 'general', 'notacion_altura_ausa_corregida']
];
const selected = (subject, field) => {
  const match = inventory.entries.find((item) => item.subject === subject && item.field === field &&
    item.nature === 'signed_unit' && item.sources.some((source) => source.selection === 'selected'));
  assert.ok(match, `${subject}/${field}`);
  return match;
};
const check = (subject, field, item = selected(subject, field),
  original = originals.get(subject), published = publications.get(subject)) =>
  inspectEditorialApprovedCorrection(item, original, published, reconciliation);

test('justifica seis correcciones por los reconciliadores reales y las copias aprobadas', () => {
  const matched = [];
  for (const [subject, field, kind] of candidates) {
    const proof = check(subject, field);
    assert.equal(proof?.kind, kind, subject);
    assert.equal(proof.evidence, 'reconciliacion_productiva_y_publicacion_aprobada');
    matched.push(selected(subject, field).id);
  }
  assert.equal(new Set(matched).size, candidates.length);
});

test('no atribuye una corrección de identidad a un original con URL o referencia alteradas', () => {
  for (const [subject, field] of candidates) {
    const source = originals.get(subject);
    assert.equal(check(subject, field, undefined, { ...source, url: `${source.url}-otra` }), null);
    assert.equal(check(subject, field, undefined, { ...source, reference: `${source.reference}-otra` }), null);
  }
});

test('la copia publicada debe conservar proveedor, referencia y URL aprobados', () => {
  for (const [subject, field] of candidates) {
    const product = publications.get(subject);
    assert.equal(check(subject, field, undefined, undefined, { ...product, sourceUrl: `${product.sourceUrl}-otra` }), null);
    assert.equal(check(subject, field, undefined, undefined, { ...product, reference: `${product.reference}-otra` }), null);
    assert.equal(check(subject, field, undefined, undefined, { ...product, providerId: 'otro' }), null);
  }
});

test('no basta con coincidir en una cifra si cambia la redacción aprobada', () => {
  for (const [subject, field] of candidates) {
    const product = publications.get(subject);
    const property = field === 'short' ? 'description' : 'description_general';
    assert.equal(check(subject, field, undefined, undefined,
      { ...product, [property]: `${product[property]} Prestación no documentada.` }), null);
  }
});

test('los datos de serie y capacidad no se heredan de otra unidad Hyster', () => {
  for (const subject of ['gam:5258', 'gam:6666']) {
    const original = originals.get(subject);
    assert.equal(check(subject, 'short', undefined,
      { ...original, specs: { ...original.specs, 'Nº de serie': 'DISTINTO' } }), null);
    assert.equal(check(subject, 'short', undefined,
      { ...original, specs: { ...original.specs, 'Capacidad de carga (kg)': '3500 KG' } }), null);
  }
});

test('una identidad de modelo ajena invalida la corrección XCMG y Yale', () => {
  for (const subject of ['gam:2328', 'gam:4802']) {
    const source = originals.get(subject);
    assert.equal(check(subject, 'general', undefined,
      { ...source, model: 'MODELO-NO-CONCILIADO' }), null);
  }
});

test('las dos Ausa requieren la ficha técnica y el origen que justifica la notación corregida', () => {
  for (const subject of ['mercaeleva:M855-6850', 'mercaeleva:M640-1938']) {
    const source = originals.get(subject);
    assert.equal(check(subject, 'general', undefined,
      { ...source, specs: { ...source.specs, 'Altura máxima de elevación': 'otro' } }), null);
    assert.equal(check(subject, 'general', undefined,
      { ...source, longDescription: 'Sin la notación original de altura' }), null);
  }
});

test('no permite acreditar un texto que no es el firmado para la unidad y campo originales', () => {
  for (const [subject, field] of candidates) {
    const item = selected(subject, field);
    assert.equal(check(subject, field, { ...item, subject: 'gam:otro' }), null);
    assert.equal(check(subject, field, { ...item, sourceUrl: 'https://otro.example' }), null);
    assert.equal(check(subject, field, { ...item, nature: 'excluded_unit' }), null);
  }
});

test('no trata cualquier narración general o un respaldo histórico como corrección productiva acreditada', () => {
  const item = selected('gam:5258', 'short');
  assert.equal(check('gam:5258', 'short', { ...item, field: 'general' }), null);
  const other = inventory.entries.find((entry) => entry.nature === 'signed_unit' &&
    entry.subject === 'mercaeleva:M030-7485' && entry.field === 'general');
  assert.ok(other);
  assert.equal(check(other.subject, other.field, other), null);
});

test('sin reconciliador productivo no se justifica una sustitución histórica', () => {
  for (const [subject, field] of candidates) {
    assert.equal(inspectEditorialApprovedCorrection(selected(subject, field), originals.get(subject),
      publications.get(subject), null), null);
  }
});

test('el auditor concilia las correcciones sin alterar las acreditaciones del motor ni las pendientes', async () => {
  const [{ accreditEditorialHistoryConsumption }, { assessEditorialHistoryPublications },
    { editorialSourceDigest }, { resolveKnowledgeEditorial }, { prepareSourceProduct },
    { resolveEditorialFacts }] = await Promise.all([
    import('../editorial-history-inventory.mjs'),
    import('../editorial-history-publications.mjs'),
    import('../../../dist/infrastructure/filesystem/editorial/knowledge.js'),
    import('../../../dist/preparation/shared/editorial/mapping/knowledge-editorial.js'),
    import('../../../dist/preparation/prepare-product.js'),
    import('../../../dist/preparation/shared/editorial/domain/editorial-facts.js')
  ]);
  const records = [...originals.values()];
  const accredited = accreditEditorialHistoryConsumption(inventory, records, {
    digestUnit: editorialSourceDigest, resolveUnit: resolveKnowledgeEditorial,
    prepareUnit: prepareSourceProduct, resolveFacts: resolveEditorialFacts
  });
  const result = assessEditorialHistoryPublications(accredited, records,
    loadActiveEditorialPublications(root), reconciliation);
  assert.equal(accredited.totals.discovered, 689);
  assert.equal(accredited.totals.runtime.finalExact + accredited.totals.runtime.finalUnitNormalized, 603);
  assert.equal(accredited.totals.runtime.composedInsteadOfFallback, 35);
  assert.equal(result.totals.textContinuity.signedDirect.different_text, 17);
  assert.equal(result.totals.approvedCorrections.justified, 6);
  assert.equal(result.totals.approvedCorrections.pendingChanged, 11);
  assert.deepEqual(result.totals.approvedCorrections.byKind, {
    identidad_xcmg_corregida: 1,
    identidad_hyster_corregida: 2,
    notacion_altura_ausa_corregida: 2,
    identidad_yale_corregida: 1
  });
  assert.deepEqual(result.signed.filter((item) => item.approvedCorrection)
    .map((item) => item.subject).sort(), candidates.map(([subject]) => subject).sort());
});
