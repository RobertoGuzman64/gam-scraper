import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import { accreditEditorialHistoryConsumption, loadEditorialHistoryInventory } from '../editorial-history-inventory.mjs';
import { assessEditorialHistoryPublications, loadActiveEditorialPublications } from '../editorial-history-publications.mjs';
import { inspectEditorialUnitContinuity } from '../editorial-history-unit-continuity.mjs';
import { editorialSourceDigest } from '../../../dist/infrastructure/filesystem/editorial/knowledge.js';
import { resolveKnowledgeEditorial } from '../../../dist/preparation/shared/editorial/mapping/knowledge-editorial.js';
import { prepareSourceProduct } from '../../../dist/preparation/prepare-product.js';
import { resolveEditorialFacts } from '../../../dist/preparation/shared/editorial/domain/editorial-facts.js';
import { reconcileGamVerifiedYaleGp80vx as reconcileYale } from '../../../dist/preparation/gam/technical/reconciliation/gam-yale-gp80vx.js';
import { reconcileGamVerifiedXcmg1523Model as reconcileXcmg } from '../../../dist/preparation/gam/technical/models/xcmg-1523-model-evidence.js';
import { reconcileGamVerifiedHysterH45fts5Title as reconcileHysterTitle,
  verifiedGamHysterH45fts5Editorial as verifiedHysterEditorial } from '../../../dist/preparation/gam/technical/reconciliation/gam-hyster-h45fts5.js';
import { reconcileGamVerifiedEditorialCoherence as reconcileEditorialCoherence } from '../../../dist/preparation/gam/technical/reconciliation/gam-verified-capacity-coherence.js';
import { normalizeMercaelevaAusaHeightText as normalizeAusaHeight } from '../../../dist/preparation/mercaeleva/technical/reconciliation/mercaeleva-ausa-height.js';

const root = resolve(fileURLToPath(new URL('../../..', import.meta.url)));
const read = (path) => JSON.parse(readFileSync(resolve(root, path), 'utf8'));
const originals = ['gam', 'gomariz', 'mercaeleva'].flatMap((provider) =>
  read(`catalogs/providers/${provider}/original/scrape-${provider}-catalog.json`).products);
const publications = loadActiveEditorialPublications(root);
const originalByKey = new Map(originals.map((item) => [`${item.providerId}:${item.reference}`, item]));
const publishedByKey = new Map(publications.flatMap((group) => group.products.map((item) =>
  [`${item.providerId}:${item.reference}`, item])));
const remaining = [
  'mercaeleva:M018-7013', 'mercaeleva:M988-6161', 'mercaeleva:M281-3486',
  'mercaeleva:M995-8408', 'mercaeleva:M547-2372', 'mercaeleva:M539-6438',
  'mercaeleva:M692-8041', 'mercaeleva:M229-0241', 'mercaeleva:M840-8278'
];
const reconciliation = { reconcileYale, reconcileXcmg, reconcileHysterTitle,
  verifiedHysterEditorial, reconcileEditorialCoherence, normalizeAusaHeight,
  digestUnit: editorialSourceDigest };
let history;
const inventory = () => {
  history ??= accreditEditorialHistoryConsumption(loadEditorialHistoryInventory(root), originals, {
    digestUnit: editorialSourceDigest, resolveUnit: resolveKnowledgeEditorial,
    prepareUnit: prepareSourceProduct, resolveFacts: resolveEditorialFacts
  });
  return history;
};
const pair = (subject) => {
  const item = inventory().entries.find((entry) => entry.nature === 'signed_unit' &&
    entry.subject === subject && ['final_exact', 'final_unit_normalized'].includes(entry.consumption?.result));
  assert.ok(item);
  return { item, original: originalByKey.get(subject), published: publishedByKey.get(subject) };
};
const inspect = (subject, changes = {}) => {
  const current = pair(subject);
  return inspectEditorialUnitContinuity(changes.item ?? current.item,
    changes.original ?? current.original, changes.published ?? current.published,
    changes.digestUnit ?? editorialSourceDigest);
};
const missing = (subject, transform) => {
  const current = pair(subject);
  const changed = transform(current.published);
  const result = inspect(subject, { published: changed });
  assert.equal(result?.result, 'pendiente_conservacion');
  assert.equal(result.semanticEquivalenceAccredited, false);
  return result;
};

test('nueve sustituciones reproducen hechos históricos sin presumir equivalencia textual', () => {
  for (const subject of remaining) {
    const result = inspect(subject);
    assert.equal(result?.result, 'hechos_de_unidad_conservados', subject);
    assert.equal(result.semanticEquivalenceAccredited, false);
    assert.ok(result.checks.every((check) => check.passed), subject);
  }
});

test('la Toyota conserva el año y el horómetro fuera de su antigua descripción corta', () => {
  const result = inspect('mercaeleva:M547-2372');
  assert.deepEqual(result.claims.map(({ kind, location }) => ({ kind, location })), [
    { kind: 'year', location: 'other_field' }, { kind: 'horometer', location: 'other_field' }
  ]);
  assert.equal(result.movedClaims, 2);
  assert.deepEqual(result.archivedCapacities, [1350]);
  assert.equal(result.semanticEquivalenceAccredited, false);
});

test('las tres Optimum 8 mantienen su denominación AC en el texto aprobado de la misma unidad', () => {
  for (const subject of ['mercaeleva:M281-3486', 'mercaeleva:M539-6438', 'mercaeleva:M229-0241']) {
    assert.deepEqual(inspect(subject).documentedVariants, ['optimum 8 ac']);
    const result = missing(subject, (product) => ({ ...product,
      description: product.description.replace('OPTIMUM 8 AC', 'OPTIMUM 8') }));
    assert.ok(result.checks.some((check) => check.name === 'denominacion_de_variante' && !check.passed));
  }
});

test('no acredita otro origen, huella, unidad o texto histórico sin firma válida', () => {
  const subject = 'mercaeleva:M281-3486';
  const current = pair(subject);
  assert.equal(inspect(subject, { original: { ...current.original, model: 'Optimum 8 distinta' } }), null);
  assert.equal(inspect(subject, { original: { ...current.original,
    longDescription: `${current.original.longDescription} versión distinta` } }), null);
  assert.equal(inspect(subject, { item: { ...current.item, sourceDigest: 'otra-huella' } }), null);
  assert.equal(inspect(subject, { item: { ...current.item, status: 'ACREDITADO_COMPARTIDO' } }), null);
  assert.equal(inspect(subject, { item: { ...current.item, value: 'otra descripción', sourceDigest: 'otra-huella' } }), null);
  assert.equal(inspect(subject, { item: { ...current.item, value: 'otra descripción' } })?.result, 'pendiente_conservacion');
  assert.equal(inspect(subject, { item: { ...current.item, sources: [] } }), null);
  assert.equal(inspect(subject, { published: { ...current.published, reference: 'otra' } }), null);
  assert.equal(inspect(subject, { published: { ...current.published, sourceUrl: 'https://otro.example' } }), null);
  assert.equal(inspectEditorialUnitContinuity(current.item, current.original, current.published, null), null);
});

test('la identidad del modelo y la marca deben coincidir con la ficha estructurada', () => {
  for (const subject of ['mercaeleva:M018-7013', 'mercaeleva:M547-2372']) {
    missing(subject, (product) => ({ ...product, spec: { ...product.spec, Modelo: 'Otro modelo' } }));
    missing(subject, (product) => ({ ...product, spec: { ...product.spec, Marca: 'Otra marca' } }));
  }
});

test('año, horas y referencia comercial no pueden cambiar aunque la redacción los mencione', () => {
  const subject = 'mercaeleva:M995-8408';
  for (const key of ['Año de fabricación', 'Horas laborales', 'Artículo No.']) {
    const result = missing(subject, (product) => ({ ...product,
      spec: { ...product.spec, [key]: 'incorrecto' } }));
    assert.ok(result.checks.some((check) => !check.passed));
  }
  missing('mercaeleva:M547-2372', (product) => ({ ...product,
    spec: { ...product.spec, 'Horas laborales': '' } }));
});

test('la altura anunciada debe mantenerse con su concepto en texto y especificaciones', () => {
  const subject = 'mercaeleva:M995-8408';
  const result = missing(subject, (product) => ({ ...product,
    description_general: product.description_general.replace('anunciada es 8 m', 'anunciada es 7,6 m') }));
  assert.ok(result.checks.some((check) => check.name === 'altura_de_trabajo' && !check.passed));
  missing(subject, (product) => ({ ...product,
    spec: { ...product.spec, 'Altura de trabajo': '7,6 m' } }));
});

test('una capacidad de la Toyota no equivale a otra cifra o concepto técnico', () => {
  const subject = 'mercaeleva:M547-2372';
  const result = missing(subject, (product) => ({ ...product,
    description_general: product.description_general.replace('capacidad de 1350 kg', 'peso de 1350 kg'),
    spec: { ...product.spec, 'Capacidad nominal según texto comercial': '' } }));
  assert.ok(result.checks.some((check) => check.name === 'capacidad_nominal' && !check.passed));
});

test('si una discrepancia de horómetro se presenta como dato coherente pierde la justificación', () => {
  for (const subject of ['mercaeleva:M018-7013', 'mercaeleva:M988-6161', 'mercaeleva:M840-8278']) {
    assert.equal(inspect(subject).discordance?.result, 'retained_with_caution');
    const result = missing(subject, (product) => ({ ...product,
      description_general: product.description_general
        .replace('Hay una discrepancia que debe verificarse:', 'El anuncio y la ficha indican:')
        .replace('no se consideran lecturas equivalentes', 'ambas lecturas son equivalentes') }));
    assert.equal(result.discordance?.result, 'at_risk');
  }
});

test('el censo mantiene las acreditaciones K y separa 6 correcciones, 2 alternativas y 9 continuidades', () => {
  const current = inventory();
  const result = assessEditorialHistoryPublications(current, originals, publications, reconciliation);
  const withoutReconciliation = assessEditorialHistoryPublications(current, originals, publications);
  assert.deepEqual(withoutReconciliation.totals.publishedUnitContinuity, { conserved: 0, pending: 0, movedClaims: 0 });
  assert.equal(current.totals.discovered, 689);
  assert.equal(current.totals.runtime.finalExact + current.totals.runtime.finalUnitNormalized, 603);
  assert.equal(result.totals.approvedCorrections.justified, 6);
  assert.equal(result.totals.publishedHistoricalAlternatives.matched, 2);
  assert.deepEqual(result.totals.publishedUnitContinuity, { conserved: 9, pending: 0, movedClaims: 2 });
  assert.deepEqual(result.signed.filter((entry) => entry.publishedUnitContinuity?.result === 'hechos_de_unidad_conservados')
    .map((entry) => entry.subject).sort(), remaining.slice().sort());
  assert.ok(result.signed.filter((entry) => entry.publishedUnitContinuity)
    .every((entry) => !entry.approvedCorrection && !entry.publishedHistoricalAlternative &&
      entry.continuity.kind === 'different_text' && !entry.publishedUnitContinuity.semanticEquivalenceAccredited));
});
