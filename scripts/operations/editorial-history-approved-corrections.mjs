const text = (value) => String(value ?? '').normalize('NFC').replace(/\s+/gu, ' ').trim();

export const inspectEditorialApprovedCorrection = (item, original, published, reconciliation) => {
  if (item.nature !== 'signed_unit' || item.subject !== `${original?.providerId}:${original?.reference}` ||
    item.sourceUrl !== original.url || published?.providerId !== original.providerId ||
    published.reference !== original.reference || published.sourceUrl !== original.url ||
    !reconciliation) return null;

  if (original.providerId === 'gam' && item.field === 'general') {
    const yale = reconciliation.reconcileYale(original);
    if (yale !== original && yale.title === published.title &&
      text(yale.shortDescription) === text(published.description) &&
      text(yale.longDescription) === text(published.description_general) &&
      text(item.value) !== text(yale.longDescription)) {
      return { kind: 'identidad_yale_corregida', evidence: 'reconciliacion_productiva_y_publicacion_aprobada' };
    }
    const xcmg = reconciliation.reconcileXcmg(original);
    if (xcmg !== original && xcmg.model === xcmg.specs?.Modelo &&
      text(published.title).includes(xcmg.model) &&
      text(reconciliation.reconcileEditorialCoherence(xcmg, item.value)) === text(published.description_general) &&
      text(item.value) !== text(published.description_general)) {
      return { kind: 'identidad_xcmg_corregida', evidence: 'reconciliacion_productiva_y_publicacion_aprobada' };
    }
  }

  if (original.providerId === 'gam' && item.field === 'short') {
    const hyster = reconciliation.reconcileHysterTitle(original);
    const editorial = reconciliation.verifiedHysterEditorial(original, hyster);
    if (hyster !== original && editorial && hyster.title === published.title &&
      text(editorial.short) === text(published.description) &&
      text(editorial.general) === text(published.description_general) &&
      text(item.value) !== text(editorial.short)) {
      return { kind: 'identidad_hyster_corregida', evidence: 'reconciliacion_productiva_y_publicacion_aprobada' };
    }
  }

  if (original.providerId === 'mercaeleva' && item.field === 'general') {
    const normalized = reconciliation.normalizeAusaHeight(original, item.value);
    if (normalized !== item.value && text(normalized) === text(published.description_general)) {
      return { kind: 'notacion_altura_ausa_corregida', evidence: 'reconciliacion_productiva_y_publicacion_aprobada' };
    }
  }

  return null;
};
