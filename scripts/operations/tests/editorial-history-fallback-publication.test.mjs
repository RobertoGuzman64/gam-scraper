import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { inspectEditorialFallbackPublication } from '../editorial-history-fallback-publication.mjs';
import { accreditEditorialHistoryConsumption, loadEditorialHistoryInventory } from '../editorial-history-inventory.mjs';
import { assessEditorialHistoryPublications, loadActiveEditorialPublications } from '../editorial-history-publications.mjs';
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
const reconciliation = { reconcileYale, reconcileXcmg, reconcileHysterTitle,
  verifiedHysterEditorial, reconcileEditorialCoherence, normalizeAusaHeight,
  digestUnit: editorialSourceDigest };
let saved;
const current = () => {
  saved ??= accreditEditorialHistoryConsumption(loadEditorialHistoryInventory(root), originals, {
    digestUnit: editorialSourceDigest, resolveUnit: resolveKnowledgeEditorial,
    prepareUnit: prepareSourceProduct, resolveFacts: resolveEditorialFacts
  });
  return saved;
};
const inspect = (subject, changes = {}) => {
  const item = current().entries.find((entry) => entry.subject === subject &&
    entry.consumption?.result === 'composed_instead_of_fallback');
  assert.ok(item, subject);
  const original = originalByKey.get(subject);
  const published = publishedByKey.get(subject);
  const continuity = changes.continuity ?? assessEditorialHistoryPublications(current(), originals,
    publications, reconciliation).signed.find((entry) => entry.id === item.id)?.continuity;
  return inspectEditorialFallbackPublication(changes.item ?? item, changes.original ?? original,
    changes.published ?? published, changes.digestUnit ?? editorialSourceDigest, continuity);
};

test('los 35 respaldos quedan trazados con procedencia, sin alterar su estado K', () => {
  const result = assessEditorialHistoryPublications(current(), originals, publications, reconciliation);
  assert.deepEqual(result.totals.fallbackPublication,
    { retainedLiteral: 24, retainedExtended: 3, substituted: 8, unverifiable: 0 });
  assert.equal(current().totals.states.PENDIENTE_EQUIVALENCIA, 0);
  const matches = result.signed.filter((entry) => entry.fallbackPublication);
  assert.equal(matches.length, 35);
  assert.ok(matches.every((entry) => entry.baseline === (entry.fallbackPublication.technicalContradictions.length > 0 ?
      'NO_APLICABLE_JUSTIFICADO' : entry.fallbackPublication.unitFactsAccredited ?
        'ACREDITADO_ESPECIFICO' : 'PENDIENTE_EQUIVALENCIA') &&
    !entry.fallbackPublication.semanticEquivalenceAccredited &&
    !entry.fallbackPublication.preparedEquivalenceAccredited &&
    /^[a-f\d]{64}$/u.test(entry.fallbackPublication.historicalTextSha256)));
  assert.deepEqual(result.signed.filter((entry) => entry.fallbackPublication?.result === 'texto_historico_ampliado')
    .map((entry) => entry.subject).sort(), ['gomariz:TE1621', 'gomariz:TE1622', 'gomariz:TE1858']);
});

test('conservación literal exige fuente histórica e identidad originales', () => {
  const item = current().entries.find((entry) => entry.subject === 'mercaeleva:M572-8190' &&
    entry.consumption?.result === 'composed_instead_of_fallback');
  assert.ok(item);
  const result = inspectEditorialFallbackPublication(item, originalByKey.get(item.subject),
    publishedByKey.get(item.subject), editorialSourceDigest, { kind: 'literal' });
  assert.equal(result?.result, 'texto_historico_literal');
  assert.equal(result.historicalTextSha256, createHash('sha256').update(item.value).digest('hex'));
  assert.equal(result.source.exportName, 'verifiedPriorityPlatformGeneral');
  assert.match(result.source.file, /priority-platform-generals\.json$/u);
});

test('una exclusión sin prueba de contradicción no permite acreditar publicación de respaldo', () => {
  const subject = 'gomariz:TE1858';
  const entry = current().entries.find((item) => item.subject === subject &&
    item.consumption?.result === 'composed_instead_of_fallback');
  assert.equal(entry?.status, 'NO_APLICABLE_JUSTIFICADO');
  assert.equal(inspect(subject, { item: { ...entry, consumption: {
    ...entry.consumption, discardedWithEvidence: false
  } } }), null);
  assert.equal(inspect(subject)?.semanticEquivalenceAccredited, false);
  assert.equal(inspect(subject)?.preparedEquivalenceAccredited, false);
});

test('tres textos completos ampliados no acreditan sus nuevas afirmaciones', () => {
  const result = inspect('gomariz:TE1858', { continuity: { kind: 'full_text_retained_with_suffix' } });
  assert.equal(result?.result, 'texto_historico_ampliado');
  assert.equal(result.semanticEquivalenceAccredited, false);
  assert.equal(result.preparedEquivalenceAccredited, false);
});

test('ocho redacciones sustituidas no se computan como conocimiento publicado literalmente', () => {
  const result = inspect('mercaeleva:M131-5855', { continuity: { kind: 'different_text' } });
  assert.equal(result?.result, 'redaccion_sustituida');
  assert.equal(result.semanticEquivalenceAccredited, false);
});

test('un original o publicación alterado pierde la justificación aunque el texto siga igual', () => {
  const subject = 'mercaeleva:M572-8190';
  const original = originalByKey.get(subject);
  const published = publishedByKey.get(subject);
  assert.equal(inspect(subject, { original: { ...original, year: '2020' },
    continuity: { kind: 'literal' } })?.result, 'sin_procedencia_acreditable');
  assert.equal(inspect(subject, { published: { ...published, sourceUrl: 'https://otro.example' },
    continuity: { kind: 'literal' } })?.result, 'sin_procedencia_acreditable');
  assert.equal(inspect(subject, { published: { ...published, reference: 'otra-referencia' },
    continuity: { kind: 'literal' } })?.result, 'sin_procedencia_acreditable');
  assert.equal(inspect(subject, { original: originalByKey.get('mercaeleva:M205-2951'),
    continuity: { kind: 'literal' } })?.result, 'sin_procedencia_acreditable');
  assert.equal(inspect(subject, { published: { ...published, description_general: 'Otro texto' },
    continuity: { kind: 'literal' } })?.result, 'redaccion_sustituida');
});

test('sin selección firmada o reconciliador de huella no concede continuidad', () => {
  const item = current().entries.find((entry) => entry.subject === 'mercaeleva:M572-8190' &&
    entry.consumption?.result === 'composed_instead_of_fallback');
  const original = originalByKey.get(item.subject);
  const published = publishedByKey.get(item.subject);
  assert.equal(inspectEditorialFallbackPublication({ ...item, sources: [] }, original, published,
    editorialSourceDigest, { kind: 'literal' }), null);
  assert.equal(inspectEditorialFallbackPublication({ ...item, status: 'ACREDITADO_COMPARTIDO' }, original,
    published, editorialSourceDigest, { kind: 'literal' }), null);
  assert.equal(inspectEditorialFallbackPublication(item, original, published,
    undefined, { kind: 'literal' }), null);
});

test('la conciliación sin digest no declara conservación con procedencia', () => {
  const result = assessEditorialHistoryPublications(current(), originals, publications);
  assert.deepEqual(result.totals.fallbackPublication,
    { retainedLiteral: 0, retainedExtended: 0, substituted: 0, unverifiable: 0 });
  assert.ok(result.signed.filter((entry) => entry.role === 'fallbackGeneral')
    .every((entry) => entry.fallbackPublication === null));
});

test('tres alturas históricas contradictorias permanecen advertidas sin atribución en las copias aprobadas', () => {
  const result = assessEditorialHistoryPublications(current(), originals, publications, reconciliation);
  assert.deepEqual(result.totals.fallbackContradictions, { excluded: 0, disclaimed: 3, reintroduced: 0, unverifiable: 0 });
  const claims = result.signed.filter((entry) => entry.fallbackPublication?.technicalContradictions.length);
  assert.deepEqual(claims.map((entry) => entry.subject).sort(),
    ['gomariz:TE1621', 'gomariz:TE1622', 'gomariz:TE1858']);
  assert.ok(claims.every((entry) => entry.baseline === (entry.fallbackPublication.technicalContradictions.length > 0 ?
      'NO_APLICABLE_JUSTIFICADO' : entry.fallbackPublication.unitFactsAccredited ?
        'ACREDITADO_ESPECIFICO' : 'PENDIENTE_EQUIVALENCIA') &&
    entry.fallbackPublication.technicalContradictions.length === 1 &&
    entry.fallbackPublication.technicalContradictions[0].concept === 'altura_plataforma' &&
    entry.fallbackPublication.technicalContradictions[0].value === '14.3 m' &&
    entry.fallbackPublication.technicalContradictions[0].publishedSpecValue === '4.3 m' &&
    entry.fallbackPublication.technicalContradictions[0].result === 'contradiccion_advertida_sin_atribuir'));
});

test('la altura advertida deja de ser segura si se añade como prestación afirmativa', () => {
  const subject = 'gomariz:TE1622';
  const published = publishedByKey.get(subject);
  const changed = { ...published,
    description_general: `${published.description_general} La altura de plataforma alcanza 14,30 m.` };
  const result = inspect(subject, { published: changed,
    continuity: { kind: 'full_text_retained_with_suffix' } });
  assert.equal(result?.technicalContradictions[0]?.result, 'publicacion_conceptualmente_incompatible');
  assert.equal(result.preparedEquivalenceAccredited, false);
});

test('la pérdida de advertencia no transforma la cifra contradictoria en dato acreditado', () => {
  const subject = 'gomariz:TE1858';
  const published = publishedByKey.get(subject);
  const changed = { ...published,
    description_general: published.description_general.replace(
      'contradictorio con la altura de trabajo; esa cifra queda expresamente sin atribuir a la máquina',
      'que acredita la altura de elevación real') };
  const result = inspect(subject, { published: changed, continuity: { kind: 'different_text' } });
  assert.equal(result?.technicalContradictions[0]?.result, 'publicacion_conceptualmente_incompatible');
});

test('una especificación aprobada con altura contradictoria se denuncia aunque el texto la descarte', () => {
  const subject = 'gomariz:TE1621';
  const published = publishedByKey.get(subject);
  const result = inspect(subject, { published: { ...published,
    spec: { ...published.spec, 'Altura plataforma': '14,30 m' } },
  continuity: { kind: 'full_text_retained_with_suffix' } });
  assert.equal(result?.technicalContradictions[0]?.result, 'publicacion_conceptualmente_incompatible');
  assert.equal(result.technicalContradictions[0].publishedSpecValue, '14.3 m');
});

test('la retirada íntegra de una cifra incompatible es exclusión, no pérdida de prestación', () => {
  const subject = 'gomariz:TE1622';
  const published = publishedByKey.get(subject);
  const changed = { ...published,
    description_general: published.description_general.replace(
      'La altura de plataforma consignada como 14,30 m no concuerda con los 6,3 m de trabajo; por esa contradicción no se presenta como una prestación acreditada.',
      '') };
  const result = inspect(subject, { published: changed, continuity: { kind: 'different_text' } });
  assert.equal(result?.technicalContradictions[0]?.result, 'contradiccion_excluida');
  assert.equal(result.semanticEquivalenceAccredited, false);
});

test('las discrepancias de magnitud pierden acreditación al cambiar la procedencia de unidad', () => {
  const subject = 'gomariz:TE1622';
  const published = publishedByKey.get(subject);
  const result = inspect(subject, { published: { ...published, sourceUrl: 'https://otra-fuente.example' },
    continuity: { kind: 'full_text_retained_with_suffix' } });
  assert.equal(result?.result, 'sin_procedencia_acreditable');
  assert.deepEqual(result.technicalContradictions, []);
  assert.equal(result.unverifiableContradictions, 1);
});


test('el auditor cuenta reintroducciones reales por su identidad, no por el número sin contexto', () => {
  const changed = publications.map((group) => ({ ...group, products: group.products.map((product) =>
    group.providerId === 'gomariz' && product.reference === 'TE1622' ? {
      ...product, description_general: `${product.description_general} Alcanza 14,30 m de altura de plataforma.`
    } : product) }));
  const result = assessEditorialHistoryPublications(current(), originals, changed, reconciliation);
  assert.deepEqual(result.totals.fallbackContradictions,
    { excluded: 0, disclaimed: 2, reintroduced: 1, unverifiable: 0 });
  assert.equal(result.signed.find((entry) => entry.subject === 'gomariz:TE1622' &&
    entry.fallbackPublication)?.fallbackPublication.technicalContradictions[0].result,
  'publicacion_conceptualmente_incompatible');
});

test('la altura incompatible expresada en milímetros también activa el control', () => {
  const subject = 'gomariz:TE1622';
  const published = publishedByKey.get(subject);
  const withText = inspect(subject, { published: { ...published,
    description_general: `${published.description_general} La altura de plataforma es 14300 mm.` },
  continuity: { kind: 'full_text_retained_with_suffix' } });
  assert.equal(withText.technicalContradictions[0].result, 'publicacion_conceptualmente_incompatible');
  const withSpec = inspect(subject, { published: { ...published,
    spec: { ...published.spec, 'Altura plataforma': '14300 mm' } },
  continuity: { kind: 'full_text_retained_with_suffix' } });
  assert.equal(withSpec.technicalContradictions[0].result, 'publicacion_conceptualmente_incompatible');
});

test('la ausencia de ficha activa no inventa una reconciliación de altura', () => {
  const changed = publications.map((group) => ({ ...group, products: group.products.filter((product) =>
    !(group.providerId === 'gomariz' && product.reference === 'TE1622')) }));
  const result = assessEditorialHistoryPublications(current(), originals, changed, reconciliation);
  assert.deepEqual(result.totals.fallbackContradictions,
    { excluded: 0, disclaimed: 2, reintroduced: 0, unverifiable: 1 });
});

test('las 35 copias aprobadas separan magnitudes publicadas, estructuradas, descartadas y sin fuente de unidad', () => {
  const result = assessEditorialHistoryPublications(current(), originals, publications, reconciliation);
  assert.deepEqual(result.totals.fallbackTechnicalPublication, {
    published: 119, structured: 4, excluded: 0, disclaimed: 3, reintroduced: 0,
    modelOnly: 0, unsupported: 1, blocking: 0, unverifiable: 0
  });
  const fallback = result.signed.filter((entry) => entry.fallbackPublication);
  assert.equal(fallback.length, 35);
  assert.equal(fallback.reduce((sum, entry) => sum + entry.fallbackPublication.technicalClaims.signals.length, 0), 127);
  assert.ok(fallback.every((entry) => entry.baseline === (entry.fallbackPublication.technicalContradictions.length > 0 ?
      'NO_APLICABLE_JUSTIFICADO' : entry.fallbackPublication.unitFactsAccredited ?
        'ACREDITADO_ESPECIFICO' : 'PENDIENTE_EQUIVALENCIA') &&
    entry.fallbackPublication.preparedEquivalenceAccredited === false &&
    entry.fallbackPublication.semanticEquivalenceAccredited === false));
});

test('las anchuras de limpieza y exterior siguen siendo magnitudes diferentes', () => {
  const result = inspect('gomariz:FR1077');
  const signals = result.technicalClaims.signals;
  assert.ok(signals.some((claim) => claim.concept === 'anchura_limpieza' && claim.value === '0.81 m' &&
    claim.result === 'publicado_con_mismo_concepto'));
  assert.ok(signals.some((claim) => claim.concept === 'anchura' && claim.value === '0.88 m' &&
    claim.result === 'publicado_con_mismo_concepto'));
});

test('un dato deja de estar publicado en el texto, pero sigue conservado si existe en su spec', () => {
  const subject = 'gomariz:TE1814';
  const published = publishedByKey.get(subject);
  const changed = { ...published, description_general: published.description_general.replace(
    '7,8 m de altura de trabajo', 'una altura de trabajo no especificada') };
  const result = inspect(subject, { published: changed, continuity: { kind: 'different_text' } });
  assert.ok(result.technicalClaims.signals.some((claim) => claim.concept === 'altura_trabajo' &&
    claim.value === '7.8 m' && claim.result === 'conservado_en_spec_del_mismo_concepto'));
  assert.equal(result.technicalClaims.blocking, 0);
});

test('una magnitud desaparecida tanto del texto como de su spec queda bloqueada', () => {
  const subject = 'gomariz:TE1814';
  const published = publishedByKey.get(subject);
  const changed = { ...published,
    description_general: published.description_general.replace('7,8 m de altura de trabajo',
      'una altura de trabajo no especificada'),
    spec: { ...published.spec, 'Altura de trabajo': '' } };
  const result = inspect(subject, { published: changed, continuity: { kind: 'different_text' } });
  assert.ok(result.technicalClaims.signals.some((claim) => claim.concept === 'altura_trabajo' &&
    claim.result === 'perdido_del_producto'));
  assert.equal(result.technicalClaims.blocking, 1);
});

test('publicar la cifra en otro concepto no subsana su pérdida en el concepto original', () => {
  const subject = 'gomariz:TE1814';
  const published = publishedByKey.get(subject);
  const changed = { ...published,
    description_general: published.description_general.replace('7,8 m de altura de trabajo',
      '7,8 m de altura de plataforma'),
    spec: { ...published.spec, 'Altura de trabajo': '' } };
  const result = inspect(subject, { published: changed, continuity: { kind: 'different_text' } });
  assert.ok(result.technicalClaims.signals.some((claim) => claim.concept === 'altura_trabajo' &&
    claim.value === '7.8 m' && claim.result === 'perdido_del_producto'));
  assert.ok(result.technicalClaims.blocking > 0);
});

test('las afirmaciones de modelo sin corroboración individual no se convierten en evidencia', () => {
  const result = assessEditorialHistoryPublications(current(), originals, publications, reconciliation);
  const unsupported = result.signed.flatMap((entry) => entry.fallbackPublication?.technicalClaims?.signals
    .filter((signal) => signal.result === 'sin_correspondencia_en_spec_de_unidad')
    .map((signal) => ({ subject: entry.subject, concept: signal.concept, value: signal.value })) ?? []);
  assert.deepEqual(unsupported.sort((a, b) => a.subject.localeCompare(b.subject)), [
    { subject: 'mercaeleva:M144-5512', concept: 'alcance_lateral', value: '3 m' }
  ]);
});

test('cambiar la fuente de la copia aprobada impide atribuir sus magnitudes al original', () => {
  const subject = 'gomariz:TE1814';
  const published = publishedByKey.get(subject);
  const result = inspect(subject, { published: { ...published, sourceUrl: 'https://otra-fuente.example' },
    continuity: { kind: 'literal' } });
  assert.equal(result.result, 'sin_procedencia_acreditable');
  assert.equal(result.technicalClaims, null);
  const changed = publications.map((group) => ({ ...group, products: group.products.map((product) =>
    group.providerId === 'gomariz' && product.reference === 'TE1814' ?
      { ...product, sourceUrl: 'https://otra-fuente.example' } : product) }));
  const assessed = assessEditorialHistoryPublications(current(), originals, changed, reconciliation);
  assert.equal(assessed.totals.fallbackTechnicalPublication.unverifiable, 1);
  assert.equal(assessed.totals.fallbackPublication.unverifiable, 1);
});

test('la auditoría censal detecta pérdidas técnicas, sin alterar los estados históricos', () => {
  const modified = publications.map((group) => ({ ...group, products: group.products.map((product) =>
    group.providerId === 'gomariz' && product.reference === 'TE1814' ? {
      ...product, description_general: product.description_general.replace('7,8 m de altura de trabajo',
        'una altura de trabajo no especificada'),
      spec: { ...product.spec, 'Altura de trabajo': '' }
    } : product) }));
  const result = assessEditorialHistoryPublications(current(), originals, modified, reconciliation);
  assert.equal(result.totals.fallbackTechnicalPublication.blocking, 1);
  assert.equal(current().totals.states.PENDIENTE_EQUIVALENCIA, 0);
});
