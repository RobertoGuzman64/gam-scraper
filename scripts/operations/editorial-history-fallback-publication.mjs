import { createHash } from 'node:crypto';
import { inspectArchivedFallbackTechnical } from './editorial-history-technical.mjs';

const digest = (value) => createHash('sha256').update(value).digest('hex');
const text = (value) => String(value ?? '').normalize('NFC').replace(/\s+/gu, ' ').trim();

export const inspectEditorialFallbackPublication = (item, original, published, digestUnit, continuity) => {
  if (item?.nature !== 'signed_unit' || item.field !== 'general' ||
    !['PENDIENTE_EQUIVALENCIA', 'NO_APLICABLE_JUSTIFICADO', 'ACREDITADO_ESPECIFICO'].includes(item.status) ||
    (item.status === 'NO_APLICABLE_JUSTIFICADO' && item.consumption?.discardedWithEvidence !== true) ||
    (item.status === 'ACREDITADO_ESPECIFICO' && item.consumption?.factsPreserved !== true) ||
    item.consumption?.result !== 'composed_instead_of_fallback' ||
    item.consumption.selectedRoles?.length !== 1 ||
    item.consumption.selectedRoles[0] !== 'fallbackGeneral' ||
    typeof digestUnit !== 'function') return null;

  const selected = item.sources?.filter((source) => source.role === 'fallbackGeneral' &&
    source.selection === 'selected' && source.selectedInstead === null);
  if (selected?.length !== 1 || !selected[0].file || !selected[0].exportName) return null;

  const sameOrigin = original && published &&
    item.subject === `${original.providerId}:${original.reference}` &&
    published.providerId === original.providerId && published.reference === original.reference &&
    item.sourceUrl === original.url && published.sourceUrl === original.url &&
    item.sourceDigest === digestUnit(original);
  const archived = text(item.value);
  const current = text(published?.description_general);
  const normalized = archived.replace(/(\d) KG\b/gu, '$1 kg');
  const literal = (continuity?.kind === 'literal' && current === archived) ||
    (continuity?.kind === 'unit_normalized' && current === normalized);
  const extended = continuity?.kind === 'full_text_retained_with_suffix' &&
    (current.startsWith(`${archived} `) || current.startsWith(`${normalized} `));
  const result = !sameOrigin ? 'sin_procedencia_acreditable' :
    literal ? 'texto_historico_literal' : extended ? 'texto_historico_ampliado' :
    'redaccion_sustituida';
  const excluded = item.consumption.technicalReconciliation?.signals.filter((signal) =>
    signal.concept === 'altura_plataforma' && signal.result === 'contradiccion_excluida') ?? [];
  const currentTechnical = sameOrigin ? inspectArchivedFallbackTechnical(item.value,
    published.description_general, original, { product: { spec: published.spec } }, null) : null;
  const technicalContradictions = excluded.flatMap((signal) => {
    if (!currentTechnical) return [];
    const current = currentTechnical.signals.find((candidate) =>
      candidate.concept === signal.concept && candidate.value === signal.value);
    if (!current || !['contradiccion_excluida', 'contradiccion_advertida_sin_atribuir',
      'publicacion_conceptualmente_incompatible'].includes(current.result)) {
      throw new Error(`Contradicción de magnitud sin conciliación: ${item.subject}`);
    }
    return [{ concept: signal.concept, value: signal.value, result: current.result,
      publishedSpecValue: current.currentSpecValue }];
  });

  return {
    result,
    source: { file: selected[0].file, exportName: selected[0].exportName },
    historicalTextSha256: digest(item.value),
    technicalClaims: currentTechnical,
    technicalContradictions,
    unverifiableContradictions: sameOrigin ? 0 : excluded.length,
    unitFactsAccredited: item.consumption.factsPreserved === true,
    semanticEquivalenceAccredited: false,
    preparedEquivalenceAccredited: false
  };
};
