import { inspectEditorialPublicationEvidence } from './editorial-history-publication-evidence.mjs';

const plain = (value) => String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/gu, '')
  .toLowerCase().replace(/\s+/gu, ' ').trim();
const escape = (value) => value.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');
const number = (value) => {
  const input = String(value ?? '').trim().replace(/\s/gu, '');
  if (/^\d{1,3}(?:\.\d{3})+(?:,\d+)?$/u.test(input)) return Number(input.replace(/\./gu, '').replace(',', '.'));
  return /^\d+(?:[.,]\d+)?$/u.test(input) ? Number(input.replace(',', '.')) : null;
};
const hours = (value) => {
  const match = /^(\d+(?:[. ]\d{3})*)\s*(?:h|horas?)?$/iu.exec(String(value ?? '').trim());
  return match ? Number(match[1].replace(/[. ]/gu, '')) : null;
};
const heights = (value) => {
  const source = plain(value);
  const claims = [
    ...source.matchAll(/\b(\d+(?:[.,]\d+)?)\s*m\s+de\s+altura de trabajo\b/gu),
    ...source.matchAll(/\baltura de trabajo\b[^.;!?]{0,80}?\b(\d+(?:[.,]\d+)?)\s*m\b/gu)
  ];
  return [...new Set(claims.map((match) => number(match[1])).filter((item) => item !== null))];
};
const metre = (value) => {
  const match = /^(\d+(?:[.,]\d+)?)\s*m$/u.exec(plain(value));
  return match ? number(match[1]) : null;
};
const capacities = (value) => {
  const source = plain(value);
  return [...new Set([...source.matchAll(/\bcapacidad nominal de\s+(\d+(?:[.,]\d+)*)\s*kg\b/gu)]
    .map((match) => number(match[1])).filter((item) => item !== null))];
};
const publishedCapacities = (value) => [...new Set([...plain(value)
  .matchAll(/\bcapacidad(?:\s+nominal)?\s+(?:de|:|segun texto comercial\s*:)\s*(\d+(?:[.,]\d+)*)\s*kg\b/gu)]
  .map((match) => number(match[1])).filter((item) => item !== null))];
const variants = (archived, original) => {
  const found = /\bdenominacion\s+(.+?)\s+en el texto original\b/u.exec(plain(archived));
  if (!found) return [];
  const variant = found[1].trim();
  return variant.startsWith(`${plain(original.model)} `) ? [variant] : [];
};

export const inspectEditorialUnitContinuity = (item, original, published, digestUnit) => {
  if (item?.nature !== 'signed_unit' || !['final_exact', 'final_unit_normalized'].includes(item.consumption?.result) ||
    !original || !published || typeof digestUnit !== 'function' ||
    item.subject !== `${original.providerId}:${original.reference}` ||
    item.sourceUrl !== original.url || item.sourceDigest !== digestUnit(original) ||
    published.providerId !== original.providerId || published.reference !== original.reference ||
    published.sourceUrl !== original.url || item.status !== 'ACREDITADO_ESPECIFICO' ||
    item.consumption.selectedRoles?.length !== 1 ||
    !['short', 'general', 'fallbackGeneral'].includes(item.consumption.selectedRoles[0]) ||
    !item.sources?.some((source) => source.role === item.consumption.selectedRoles[0] &&
      source.selection === 'selected' && source.selectedInstead === null)) return null;

  const evidence = inspectEditorialPublicationEvidence(item.value, original, published, item.consumption.selectedRoles[0]);
  const fields = [published.title, published.description, published.description_general].map(plain);
  const publishedText = fields.join(' ');
  const source = plain(item.value);
  const archivedHeights = heights(source);
  const archivedCapacities = capacities(source);
  const documentedVariants = variants(item.value, original);
  const originalHours = hours(original.horometer);
  const publishedHours = hours(published.spec?.['Horas laborales'] ?? published.spec?.['Horómetro']);
  const originalReference = String(original.specs?.['Artículo No.'] ?? '').trim();
  const checks = [
    { name: 'modelo_y_marca', passed: Boolean(original.brand && original.model &&
      source.includes(plain(original.brand)) && source.includes(plain(original.model)) &&
      plain(item.conditions?.brand) === plain(original.brand) &&
      plain(item.conditions?.model) === plain(original.model) &&
      plain(published.spec?.Marca) === plain(original.specs?.Marca) &&
      plain(published.spec?.Modelo) === plain(original.model) &&
      fields.some((field) => new RegExp(`(?<![\\p{L}\\d])${escape(plain(original.model))}(?![\\p{L}\\d])`, 'u').test(field))) },
    { name: 'ano_estructurado', passed: Boolean(original.year &&
      String(original.year) === String(original.specs?.['Año de fabricación']) &&
      String(original.year) === String(published.spec?.['Año de fabricación']) &&
      evidence.claims.some((claim) => claim.kind === 'year' && claim.value === String(original.year))) },
    { name: 'horometro_estructurado', passed: originalHours !== null && originalHours === publishedHours &&
      originalHours === hours(original.specs?.['Horas laborales']) &&
      evidence.claims.some((claim) => claim.kind === 'horometer' && claim.value === originalHours) },
    { name: 'referencia_vendedor', passed: Boolean(originalReference &&
      originalReference === String(published.spec?.['Artículo No.'] ?? '').trim()) },
    { name: 'hechos_historicos', passed: evidence.claims.length >= 2 &&
      evidence.missing === 0 && evidence.atRisk === 0 &&
      archivedHeights.length + archivedCapacities.length > 0 },
    { name: 'altura_de_trabajo', passed: archivedHeights.every((value) =>
      metre(original.specs?.['Altura de trabajo']) === value &&
      heights(published.description_general).includes(value) &&
      metre(published.spec?.['Altura de trabajo']) === value) },
    { name: 'capacidad_nominal', passed: archivedCapacities.every((value) =>
      [...plain(original.longDescription).matchAll(/\b(\d+(?:[.,]\d+)*)\s*kg\b/gu)]
        .some((match) => number(match[1]) === value) &&
      (publishedCapacities(published.description_general).includes(value) ||
        publishedCapacities(`capacidad: ${published.spec?.['Capacidad nominal según texto comercial'] ?? ''}`).includes(value))) },
    { name: 'denominacion_de_variante', passed: documentedVariants.every((variant) =>
      plain(original.longDescription).includes(variant) && publishedText.includes(variant)) }
  ];
  return {
    result: checks.every((check) => check.passed) ? 'hechos_de_unidad_conservados' : 'pendiente_conservacion',
    checks, documentedVariants, archivedHeights, archivedCapacities,
    claims: evidence.claims, discordance: evidence.discordance,
    movedClaims: evidence.claims.filter((claim) => claim.location !== 'same_field').length,
    semanticEquivalenceAccredited: false
  };
};
