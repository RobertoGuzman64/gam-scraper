import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import { accreditEditorialHistoryConsumption, loadEditorialHistoryInventory } from '../editorial-history-inventory.mjs';
import { assessEditorialHistoryPublications, loadActiveEditorialPublications } from '../editorial-history-publications.mjs';
import { inspectEditorialPublishedAlternative } from '../editorial-history-published-alternatives.mjs';
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
const read = (file) => JSON.parse(readFileSync(resolve(root, file), 'utf8'));
const originals = ['gam', 'gomariz', 'mercaeleva'].flatMap((provider) =>
  read(`catalogs/providers/${provider}/original/scrape-${provider}-catalog.json`).products);
const publishedGroups = loadActiveEditorialPublications(root);
const published = new Map(publishedGroups.flatMap((group) => group.products.map((item) =>
  [`${item.providerId}:${item.reference}`, item])));
const byOriginal = new Map(originals.map((item) => [`${item.providerId}:${item.reference}`, item]));
const reconciliation = { reconcileYale, reconcileXcmg, reconcileHysterTitle,
  verifiedHysterEditorial, reconcileEditorialCoherence, normalizeAusaHeight,
  digestUnit: editorialSourceDigest };
let accredited;
const inventory = () => {
  accredited ??= accreditEditorialHistoryConsumption(loadEditorialHistoryInventory(root), originals, {
    digestUnit: editorialSourceDigest, resolveUnit: resolveKnowledgeEditorial,
    prepareUnit: prepareSourceProduct, resolveFacts: resolveEditorialFacts
  });
  return accredited;
};
const pairs = () => ['gomariz:CC1535', 'gomariz:CC1666'].map((subject) => {
  const entries = inventory().entries.filter((item) => item.nature === 'signed_unit' &&
    item.subject === subject && item.field === 'general');
  const winner = entries.find((item) => item.consumption?.result === 'final_exact');
  const alternative = entries.find((item) => item.consumption?.result === 'displaced_by_signed_priority');
  assert.ok(winner && alternative);
  return { subject, winner, alternative, original: byOriginal.get(subject), active: published.get(subject) };
});
const inspect = (pair, changes = {}) => inspectEditorialPublishedAlternative(
  changes.winner ?? pair.winner, changes.original ?? pair.original, changes.active ?? pair.active,
  changes.alternatives ?? [pair.alternative], changes.digestUnit ?? editorialSourceDigest);

test('dos publicaciones aprobadas conservan una firma histórica desplazada de la misma unidad', () => {
  for (const pair of pairs()) {
    const proof = inspect(pair);
    assert.equal(proof?.alternativeId, pair.alternative.id);
    assert.equal(proof.evidence, 'texto_firmado_alternativo_en_copia_aprobada');
    assert.equal(proof.semanticEquivalenceAccredited, false);
    assert.equal(proof.source, pair.alternative.sources[0].file);
  }
});

test('las firmas desplazadas no se convierten en ganadoras del motor', () => {
  for (const pair of pairs()) {
    assert.equal(pair.alternative.status, 'NO_APLICABLE_JUSTIFICADO');
    assert.equal(pair.alternative.consumption.replacedBy, pair.winner.id);
    assert.equal(pair.winner.consumption.result, 'final_exact');
    assert.notEqual(pair.winner.value, pair.alternative.value);
    assert.equal(inspect(pair).semanticEquivalenceAccredited, false);
  }
});

test('no se atribuyen textos a otra unidad, proveedor o procedencia', () => {
  for (const pair of pairs()) {
    assert.equal(inspect(pair, { original: { ...pair.original, reference: `${pair.original.reference}-otra` } }), null);
    assert.equal(inspect(pair, { original: { ...pair.original, url: `${pair.original.url}?otra` } }), null);
    assert.equal(inspect(pair, { active: { ...pair.active, providerId: 'gam' } }), null);
    assert.equal(inspect(pair, { active: { ...pair.active, reference: `${pair.active.reference}-otra` } }), null);
    assert.equal(inspect(pair, { active: { ...pair.active, sourceUrl: `${pair.active.sourceUrl}?otra` } }), null);
  }
});

test('cualquier cambio en las características que componen la huella original invalida la atribución', () => {
  for (const pair of pairs()) {
    assert.equal(inspect(pair, { original: { ...pair.original, model: 'VARIANTE-DISTINTA' } }), null);
    assert.equal(inspect(pair, { original: { ...pair.original, specs: { ...pair.original.specs, Capacidad: '180 kg' } } }), null);
    assert.equal(inspect(pair, { original: { ...pair.original, longDescription: 'Otro anuncio' } }), null);
    assert.equal(inspect(pair, { original: { ...pair.original, year: '2023' } }), null);
  }
});

test('no acredita una alteración de la redacción publicada como firma histórica', () => {
  for (const pair of pairs()) {
    assert.equal(inspect(pair, { active: { ...pair.active,
      description_general: `${pair.active.description_general} Incluye opción no acreditada.` } }), null);
    assert.equal(inspect(pair, { active: { ...pair.active,
      description_general: pair.winner.value } }), null);
  }
});

test('la alternativa exige la precedencia, campo y vínculo histórico exactos', () => {
  for (const pair of pairs()) {
    const candidate = pair.alternative;
    assert.equal(inspect(pair, { alternatives: [{ ...candidate, sourceDigest: 'otro' }] }), null);
    assert.equal(inspect(pair, { alternatives: [{ ...candidate, sourceUrl: 'https://otra.example' }] }), null);
    assert.equal(inspect(pair, { alternatives: [{ ...candidate, field: 'short' }] }), null);
    assert.equal(inspect(pair, { alternatives: [{ ...candidate, subject: 'gomariz:otro' }] }), null);
    assert.equal(inspect(pair, { alternatives: [{ ...candidate, status: 'PENDIENTE_EQUIVALENCIA' }] }), null);
    assert.equal(inspect(pair, { alternatives: [{ ...candidate,
      consumption: { ...candidate.consumption, replacedBy: 'K_otro' } }] }), null);
    assert.equal(inspect(pair, { alternatives: [{ ...candidate,
      sources: candidate.sources.map((source) => ({ ...source, selectedInstead: 'K_otro' })) }] }), null);
    assert.equal(inspect(pair, { alternatives: [candidate, candidate] }), null);
    assert.equal(inspect(pair, { winner: { ...pair.winner,
      consumption: { ...pair.winner.consumption, selectedRoles: ['short'] } } }), null);
    assert.equal(inspectEditorialPublishedAlternative(pair.winner, pair.original, pair.active,
      [candidate], null), null);
  }
});

test('el censo de 1751 unidades separa las dos alternativas publicadas de las seis correcciones productivas', () => {
  const current = inventory();
  const result = assessEditorialHistoryPublications(current, originals, publishedGroups, reconciliation);
  assert.equal(current.totals.discovered, 689);
  assert.equal(current.totals.runtime.finalExact + current.totals.runtime.finalUnitNormalized, 603);
  assert.equal(result.totals.textContinuity.signedDirect.different_text, 17);
  assert.equal(result.totals.approvedCorrections.justified, 6);
  assert.equal(result.totals.approvedCorrections.pendingChanged, 11);
  assert.deepEqual(result.totals.publishedHistoricalAlternatives, { matched: 2, pendingWithoutMatch: 9 });
  assert.deepEqual(result.signed.filter((item) => item.publishedHistoricalAlternative)
    .map((item) => item.subject).sort(), pairs().map((item) => item.subject).sort());
  assert.ok(result.signed.filter((item) => item.publishedHistoricalAlternative)
    .every((item) => !item.approvedCorrection && item.continuity.kind === 'different_text'));
});
