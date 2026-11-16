const text = (value) => String(value ?? '').normalize('NFC').replace(/\s+/gu, ' ').trim();
const fields = { short: 'description', general: 'description_general', fallbackGeneral: 'description_general', title: 'title' };

export const inspectEditorialPublishedAlternative = (winner, original, published, alternatives, digestUnit) => {
  if (winner?.nature !== 'signed_unit' ||
    !['final_exact', 'final_unit_normalized'].includes(winner.consumption?.result) ||
    !original || !published || !Array.isArray(alternatives) || typeof digestUnit !== 'function' ||
    winner.subject !== `${original.providerId}:${original.reference}` ||
    winner.sourceUrl !== original.url || published.providerId !== original.providerId ||
    published.reference !== original.reference || published.sourceUrl !== original.url ||
    winner.sourceDigest !== digestUnit(original)) return null;

  const roles = winner.consumption.selectedRoles;
  if (!Array.isArray(roles) || roles.length !== 1 || !fields[roles[0]]) return null;
  const role = roles[0];
  const active = text(published[fields[role]]);
  if (!active || active === text(winner.value)) return null;

  const matches = alternatives.filter((candidate) =>
    candidate.nature === 'signed_unit' && candidate.status === 'NO_APLICABLE_JUSTIFICADO' &&
    candidate.subject === winner.subject && candidate.field === winner.field &&
    candidate.sourceDigest === winner.sourceDigest && candidate.sourceUrl === original.url &&
    candidate.consumption?.result === 'displaced_by_signed_priority' &&
    candidate.consumption.replacedBy === winner.id && text(candidate.value) === active &&
    candidate.sources?.some((source) => source.role === role && source.selection === 'displaced' &&
      source.selectedInstead === winner.id));
  if (matches.length !== 1) return null;

  const alternative = matches[0];
  const source = alternative.sources.find((entry) => entry.role === role &&
    entry.selection === 'displaced' && entry.selectedInstead === winner.id);
  return { alternativeId: alternative.id, source: source.file,
    evidence: 'texto_firmado_alternativo_en_copia_aprobada',
    semanticEquivalenceAccredited: false };
};
