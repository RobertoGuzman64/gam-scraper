import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
import { inspectEditorialTextDifference } from './editorial-history-text-differences.mjs';
import { inspectEditorialPublicationEvidence } from './editorial-history-publication-evidence.mjs';
import { inspectEditorialApprovedCorrection } from './editorial-history-approved-corrections.mjs';
import { inspectEditorialPublishedAlternative } from './editorial-history-published-alternatives.mjs';
import { inspectEditorialUnitContinuity } from './editorial-history-unit-continuity.mjs';
import { inspectEditorialFallbackPublication } from './editorial-history-fallback-publication.mjs';

const providers = ['gam', 'gomariz', 'mercaeleva'];
const digest = (value) => createHash('sha256').update(value).digest('hex');
const text = (value) => String(value ?? '').normalize('NFC').replace(/\s+/gu, ' ').trim();
const fields = { short: 'description', general: 'description_general', fallbackGeneral: 'description_general', title: 'title' };
const continuityKinds = [
  'literal', 'unit_normalized', 'full_text_retained_with_suffix', 'different_text',
  'without_active', 'source_mismatch'
];

const classifyContinuity = (expected, actual, observation) => {
  if (observation === 'withoutActive') return { kind: 'without_active' };
  if (observation === 'sourceMismatch') return { kind: 'source_mismatch' };
  if (['literal', 'winnerLiteral'].includes(observation)) return { kind: 'literal' };
  if (['normalizedKg', 'winnerNormalizedKg'].includes(observation)) return { kind: 'unit_normalized' };
  const suffix = actual.startsWith(`${expected} `) ? actual.slice(expected.length + 1) : null;
  return suffix?.trim() ? {
    kind: 'full_text_retained_with_suffix', suffixSha256: digest(suffix), suffixLength: suffix.length
  } : { kind: 'different_text' };
};

export const loadActiveEditorialPublications = (root) => {
  const read = (path) => JSON.parse(readFileSync(join(root, path), 'utf8'));
  return providers.map((providerId) => {
    const active = read(`catalogs/providers/${providerId}/publications/active.json`);
    if (active.version !== 1 || active.providerId !== providerId ||
      typeof active.approvalSha256 !== 'string' || !/^[\da-f]{64}$/u.test(active.approvalSha256)) {
      throw new Error(`Puntero de publicación activa inválido: ${providerId}`);
    }
    const folder = `catalogs/providers/${providerId}/publications/${active.approvalSha256.slice(0, 12)}`;
    const manifest = read(`${folder}/manifest.json`);
    const publishableFile = `${providerId}-publishable.json`;
    if (manifest.version !== 1 || manifest.providerId !== providerId ||
      manifest.approvalSha256 !== active.approvalSha256 ||
      manifest.files?.['accreditation.json'] !== active.approvalSha256 ||
      typeof manifest.files?.[publishableFile] !== 'string') {
      throw new Error(`Manifiesto de publicación activa inconsistente: ${providerId}`);
    }
    const rawPublished = readFileSync(join(root, folder, publishableFile));
    const rawAccreditation = readFileSync(join(root, folder, 'accreditation.json'));
    if (digest(rawPublished) !== manifest.files[publishableFile] ||
      digest(rawAccreditation) !== active.approvalSha256) {
      throw new Error(`Huella de publicación activa inconsistente: ${providerId}`);
    }
    const products = JSON.parse(rawPublished.toString('utf8'));
    if (!Array.isArray(products) || manifest.totals?.publishable !== products.length) {
      throw new Error(`Catálogo aprobado inválido: ${providerId}`);
    }
    return { providerId, approvalSha256: active.approvalSha256, products };
  });
};

export const assessEditorialHistoryPublications = (inventory, originals, publications, reconciliation = null) => {
  if (!Array.isArray(originals) || originals.length !== inventory.totals.originalRecords ||
    !Array.isArray(inventory.entries) || inventory.entries.length !== inventory.totals.discovered ||
    !inventory.totals.runtime || !Array.isArray(publications) || publications.length !== providers.length) {
    throw new Error('Censo, acreditación o publicaciones incompletos');
  }
  const originalByKey = new Map();
  for (const record of originals) {
    const key = `${record.providerId}:${record.reference}`;
    if (originalByKey.has(key)) throw new Error(`Original duplicado: ${key}`);
    originalByKey.set(key, record);
  }
  const activeByKey = new Map();
  const byProvider = [];
  const visitedProviders = new Set();
  for (const group of publications) {
    if (!providers.includes(group.providerId) || visitedProviders.has(group.providerId) ||
      !/^[\da-f]{64}$/u.test(group.approvalSha256) || !Array.isArray(group.products)) {
      throw new Error('Conjunto de publicaciones activas inválido');
    }
    visitedProviders.add(group.providerId);
    const counters = { providerId: group.providerId, approvalSha256: group.approvalSha256,
      activeUnits: 0, alignedToOriginals: 0, withoutCurrentOriginal: [], sourceMismatch: [] };
    for (const product of group.products) {
      if (product?.providerId !== group.providerId || typeof product.reference !== 'string' ||
        !product.reference.trim() || typeof product.sourceUrl !== 'string' || !product.sourceUrl.trim()) {
        throw new Error(`Identidad de publicación activa inválida: ${group.providerId}`);
      }
      const key = `${group.providerId}:${product.reference}`;
      if (activeByKey.has(key)) throw new Error(`Publicación activa duplicada: ${key}`);
      activeByKey.set(key, product);
      counters.activeUnits++;
      const original = originalByKey.get(key);
      if (!original) counters.withoutCurrentOriginal.push(key);
      else if (original.url !== product.sourceUrl) counters.sourceMismatch.push(key);
      else counters.alignedToOriginals++;
    }
    counters.withoutCurrentOriginal.sort();
    counters.sourceMismatch.sort();
    byProvider.push(counters);
  }
  const signedById = new Map(inventory.entries.filter((item) => item.nature === 'signed_unit')
    .map((item) => [item.id, item]));
  const alternativesByWinner = new Map();
  for (const item of inventory.entries) {
    if (item.nature !== 'signed_unit' || item.consumption?.result !== 'displaced_by_signed_priority') continue;
    const winner = item.consumption.replacedBy;
    const alternatives = alternativesByWinner.get(winner) ?? [];
    alternatives.push(item);
    alternativesByWinner.set(winner, alternatives);
  }
  const results = [];
  const totals = {
    activeUnits: activeByKey.size,
    alignedToOriginals: byProvider.reduce((sum, group) => sum + group.alignedToOriginals, 0),
    withoutCurrentOriginal: byProvider.reduce((sum, group) => sum + group.withoutCurrentOriginal.length, 0),
    sourceMismatch: byProvider.reduce((sum, group) => sum + group.sourceMismatch.length, 0),
    originalsWithoutActive: originals.length - [...activeByKey.keys()].filter((key) => originalByKey.has(key)).length,
    signedDirect: { literal: 0, normalizedKg: 0, different: 0, withoutActive: 0, sourceMismatch: 0 },
    historicalFallback: { literal: 0, normalizedKg: 0, composed: 0, withoutActive: 0, sourceMismatch: 0 },
    displaced: { winnerLiteral: 0, winnerNormalizedKg: 0, otherText: 0, withoutActive: 0, sourceMismatch: 0 },
    textDifferences: {
      signedDirect: { differentText: 0, changedNumbers: 0, removedCautions: 0, addedCautions: 0,
        suffixWithNewNumbers: 0 },
      historicalFallback: { differentText: 0, changedNumbers: 0, removedCautions: 0, addedCautions: 0,
        suffixWithNewNumbers: 0 },
      displaced: { differentText: 0, changedNumbers: 0, removedCautions: 0, addedCautions: 0,
        suffixWithNewNumbers: 0 }
    },
    changedUnitFields: 0,
    approvedCorrections: { justified: 0, pendingChanged: 0, byKind: {} },
    publishedHistoricalAlternatives: { matched: 0, pendingWithoutMatch: 0 },
    publishedUnitContinuity: { conserved: 0, pending: 0, movedClaims: 0 },
    fallbackPublication: { retainedLiteral: 0, retainedExtended: 0, substituted: 0, unverifiable: 0 },
    fallbackContradictions: { excluded: 0, disclaimed: 0, reintroduced: 0, unverifiable: 0 },
    fallbackTechnicalPublication: { published: 0, structured: 0, excluded: 0, disclaimed: 0,
      reintroduced: 0, modelOnly: 0, unsupported: 0, blocking: 0, unverifiable: 0 },
    unitEvidence: { changedDirect: 0, sameField: 0, otherField: 0, structured: 0, missing: 0,
      hourDiscordances: 0, discordancesRetained: 0, discordancesAtRisk: 0 },
    textContinuity: {
      signedDirect: Object.fromEntries(continuityKinds.map((kind) => [kind, 0])),
      historicalFallback: Object.fromEntries(continuityKinds.map((kind) => [kind, 0])),
      displaced: Object.fromEntries(continuityKinds.map((kind) => [kind, 0]))
    }
  };
  const changedFields = new Set();
  for (const item of inventory.entries) {
    if (item.nature !== 'signed_unit') continue;
    const result = item.consumption?.result;
    const direct = result === 'final_exact' || result === 'final_unit_normalized';
    const fallback = result === 'composed_instead_of_fallback';
    const displaced = result === 'displaced_by_signed_priority';
    if (!direct && !fallback && !displaced) throw new Error(`Firma sin clasificación previa: ${item.id}`);
    const group = direct ? 'signedDirect' : fallback ? 'historicalFallback' : 'displaced';
    const winner = displaced ? signedById.get(item.consumption.replacedBy) : item;
    if (!winner || (displaced && (winner.subject !== item.subject || winner.field !== item.field))) {
      throw new Error(`Ganador histórico inconsistente: ${item.id}`);
    }
    const role = winner.consumption?.selectedRoles?.[0];
    const field = fields[role];
    if (!field) throw new Error(`Campo de firma no acreditado: ${winner.id}`);
    const active = activeByKey.get(item.subject);
    const activeText = active ? text(active[field]) : '';
    let observation;
    if (!active) observation = 'withoutActive';
    else if (active.sourceUrl !== item.sourceUrl) observation = 'sourceMismatch';
    else if (activeText === winner.value) observation = displaced ? 'winnerLiteral' : 'literal';
    else if (activeText === winner.value.replace(/(\d) KG\b/gu, '$1 kg')) {
      observation = displaced ? 'winnerNormalizedKg' : 'normalizedKg';
    } else observation = displaced ? 'otherText' : direct ? 'different' : 'composed';
    const continuity = classifyContinuity(winner.value, activeText, observation);
    const difference = active && observation !== 'sourceMismatch' ?
      inspectEditorialTextDifference(winner.value, activeText, continuity.kind) : null;
    const approvedCorrection = direct && continuity.kind === 'different_text' && active ?
      inspectEditorialApprovedCorrection(item, originalByKey.get(item.subject), active, reconciliation) : null;
    const publishedHistoricalAlternative = direct && continuity.kind === 'different_text' &&
      !approvedCorrection && active ? inspectEditorialPublishedAlternative(item,
        originalByKey.get(item.subject), active, alternativesByWinner.get(item.id) ?? [],
        reconciliation?.digestUnit) : null;
    const fallbackPublication = fallback ? inspectEditorialFallbackPublication(item, originalByKey.get(item.subject),
      active, reconciliation?.digestUnit, continuity) : null;
    if (fallbackPublication) {
      const counter = { texto_historico_literal: 'retainedLiteral',
        texto_historico_ampliado: 'retainedExtended', redaccion_sustituida: 'substituted',
        sin_procedencia_acreditable: 'unverifiable' }[fallbackPublication.result];
      totals.fallbackPublication[counter]++;
      if (!fallbackPublication.technicalClaims) totals.fallbackTechnicalPublication.unverifiable++;
      else {
        const claims = totals.fallbackTechnicalPublication;
        for (const signal of fallbackPublication.technicalClaims.signals) {
          const key = { publicado_con_mismo_concepto: 'published',
            conservado_en_spec_del_mismo_concepto: 'structured',
            contradiccion_excluida: 'excluded',
            contradiccion_advertida_sin_atribuir: 'disclaimed',
            publicacion_conceptualmente_incompatible: 'reintroduced',
            referencia_de_modelo_no_acredita_unidad: 'modelOnly',
            sin_correspondencia_en_spec_de_unidad: 'unsupported',
            perdido_del_producto: 'blocking' }[signal.result];
          if (!key) throw new Error(`Magnitud publicada sin clasificación: ${item.subject}`);
          claims[key]++;
        }
      }
      totals.fallbackContradictions.unverifiable += fallbackPublication.unverifiableContradictions;
      for (const contradiction of fallbackPublication.technicalContradictions) {
        const key = { contradiccion_excluida: 'excluded',
          contradiccion_advertida_sin_atribuir: 'disclaimed',
          publicacion_conceptualmente_incompatible: 'reintroduced' }[contradiction.result];
        totals.fallbackContradictions[key]++;
      }
    }
    const publishedUnitContinuity = direct && continuity.kind === 'different_text' &&
      !approvedCorrection && !publishedHistoricalAlternative && active &&
      active.sourceUrl === item.sourceUrl ?
      inspectEditorialUnitContinuity(item, originalByKey.get(item.subject), active, reconciliation?.digestUnit) : null;
    if (publishedUnitContinuity) {
      totals.publishedUnitContinuity[publishedUnitContinuity.result === 'hechos_de_unidad_conservados' ?
        'conserved' : 'pending']++;
      totals.publishedUnitContinuity.movedClaims += publishedUnitContinuity.movedClaims;
    }
    if (publishedHistoricalAlternative) totals.publishedHistoricalAlternatives.matched++;
    if (approvedCorrection) {
      totals.approvedCorrections.justified++;
      totals.approvedCorrections.byKind[approvedCorrection.kind] =
        (totals.approvedCorrections.byKind[approvedCorrection.kind] ?? 0) + 1;
    }
    const unitEvidence = direct && continuity.kind === 'different_text' ?
      inspectEditorialPublicationEvidence(winner.value, originalByKey.get(item.subject), active, role) : null;
    if (unitEvidence) {
      const counts = totals.unitEvidence;
      counts.changedDirect++;
      for (const claim of unitEvidence.claims) {
        const key = { same_field: 'sameField', other_field: 'otherField', structured: 'structured', missing: 'missing' }[claim.location];
        counts[key]++;
      }
      if (unitEvidence.discordance) {
        counts.hourDiscordances++;
        counts[unitEvidence.discordance.result === 'retained_with_caution' ?
          'discordancesRetained' : 'discordancesAtRisk']++;
      }
    }
    if (difference) {
      const changes = totals.textDifferences[group];
      if (continuity.kind === 'different_text') {
        changes.differentText++;
        changedFields.add(`${item.subject}:${role}`);
        if (difference.removedNumbers.length || difference.addedNumbers.length) changes.changedNumbers++;
        if (difference.removedCautions.length) changes.removedCautions++;
        if (difference.addedCautions.length) changes.addedCautions++;
      } else if (difference.addedNumbers.length) changes.suffixWithNewNumbers++;
    }
    totals[group][observation]++;
    totals.textContinuity[group][continuity.kind]++;
    results.push({ id: item.id, subject: item.subject, role, observation, continuity,
      difference, unitEvidence, approvedCorrection, publishedHistoricalAlternative, publishedUnitContinuity,
      fallbackPublication, baseline: item.status, activeTextSha256: active ? digest(activeText) : null });
  }
  totals.changedUnitFields = changedFields.size;
  totals.approvedCorrections.pendingChanged =
    totals.textContinuity.signedDirect.different_text - totals.approvedCorrections.justified;
  totals.publishedHistoricalAlternatives.pendingWithoutMatch =
    totals.approvedCorrections.pendingChanged - totals.publishedHistoricalAlternatives.matched;
  const numberOf = (group) => Object.values(totals[group]).reduce((sum, count) => sum + count, 0);
  if (numberOf('signedDirect') !== inventory.totals.runtime.finalExact + inventory.totals.runtime.finalUnitNormalized ||
    Object.entries(totals.textContinuity).some(([group, counts]) =>
      Object.values(counts).reduce((sum, count) => sum + count, 0) !== numberOf(group)) ||
    Object.entries(totals.textDifferences).some(([group, changes]) =>
      changes.differentText !== totals.textContinuity[group].different_text) ||
    numberOf('historicalFallback') !== inventory.totals.runtime.composedInsteadOfFallback ||
    numberOf('displaced') !== inventory.totals.runtime.displacedBySignedPriority ||
    results.length !== inventory.totals.signedKnowledge ||
    totals.activeUnits !== totals.alignedToOriginals + totals.withoutCurrentOriginal + totals.sourceMismatch ||
    totals.unitEvidence.changedDirect !== totals.textContinuity.signedDirect.different_text ||
    totals.approvedCorrections.pendingChanged < 0 ||
    totals.publishedHistoricalAlternatives.pendingWithoutMatch < 0 ||
    totals.publishedUnitContinuity.conserved + totals.publishedUnitContinuity.pending >
      totals.publishedHistoricalAlternatives.pendingWithoutMatch ||
    Object.values(totals.fallbackPublication).reduce((sum, count) => sum + count, 0) !==
      (typeof reconciliation?.digestUnit === 'function' ? numberOf('historicalFallback') : 0) ||
    totals.approvedCorrections.justified !== Object.values(totals.approvedCorrections.byKind).reduce((a, b) => a + b, 0) ||
    (typeof reconciliation?.digestUnit === 'function' &&
      Object.values(totals.fallbackContradictions).reduce((sum, count) => sum + count, 0) !==
      inventory.entries.reduce((sum, item) => sum + (item.consumption?.result === 'composed_instead_of_fallback' ?
        item.consumption.technicalReconciliation?.excluded ?? 0 : 0), 0)) ||
    totals.unitEvidence.hourDiscordances !== totals.unitEvidence.discordancesRetained +
      totals.unitEvidence.discordancesAtRisk ||
    (typeof reconciliation?.digestUnit === 'function' &&
      (totals.fallbackTechnicalPublication.unverifiable !== totals.fallbackPublication.unverifiable ||
      totals.fallbackTechnicalPublication.excluded !== totals.fallbackContradictions.excluded ||
      totals.fallbackTechnicalPublication.disclaimed !== totals.fallbackContradictions.disclaimed ||
      totals.fallbackTechnicalPublication.reintroduced !== totals.fallbackContradictions.reintroduced))) {
    throw new Error('Conciliación de publicación activa incompleta');
  }
  return { version: 1, scope: 'copias_de_publicacion_activa_sin_presuponer_equivalencia_con_preparacion',
    byProvider, totals, signed: results };
};
