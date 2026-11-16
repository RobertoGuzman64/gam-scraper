const plain = (value) => String(value ?? '').normalize('NFD')
  .replace(/[\u0300-\u036f]/gu, '').toLowerCase().replace(/\s+/gu, ' ').trim();
const integer = (value) => {
  const match = /^(\d+(?:[. ]\d{3})*)\s*(?:h|horas?)?$/iu.exec(plain(value));
  return match ? Number(match[1].replace(/[. ]/gu, '')) : null;
};
const hours = (value) => {
  const normalized = plain(value);
  const values = new Set();
  const forward = /(?<![\p{L}\d])([\d]+(?:[. ]\d{3})*)\s*(?:h|horas?)(?![\p{L}])/gu;
  const backward = /\bhoras?\s+(\d+(?:[. ]\d{3})*)\b/gu;
  for (const pattern of [forward, backward]) {
    for (const match of normalized.matchAll(pattern)) {
      const value = integer(match[1]);
      if (value !== null) values.add(value);
    }
  }
  return values;
};
const hasYear = (value, year) => year !== null &&
  /\b(?:ano|fabricad[ao]|fabricacion)\b/u.test(plain(value)) &&
  new RegExp(`(?<!\\d)${year}(?!\\d)`, 'u').test(plain(value));
const hasReference = (value, reference) => Boolean(reference) &&
  new RegExp(`\\b(?:ref(?:erencia)?\\.?|articulo(?: no\\.?)?)\\b[^.!?]{0,45}(?<![\\p{L}\\d])${reference.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&')}(?![\\p{L}\\d])`, 'iu')
    .test(plain(value));
const resolvePlace = (oldValue, same, other, spec, detector) => {
  if (!detector(oldValue)) return null;
  return detector(same) ? 'same_field' : detector(other) ? 'other_field' : detector(spec) ? 'structured' : 'missing';
};

export const inspectEditorialPublicationEvidence = (archived, original, published, role) => {
  const field = role === 'short' ? 'description' : role === 'title' ? 'title' : 'description_general';
  const same = String(published[field] ?? '');
  const other = [published.title, published.description, published.description_general]
    .filter((_, index) => ['title', 'description', 'description_general'][index] !== field).join(' ');
  const yearValue = /^(?:19|20)\d{2}$/u.test(String(original.year ?? '')) ? String(original.year) : null;
  const hourValue = integer(original.horometer);
  const article = String(original.specs?.['Artículo No.'] ?? '').trim();
  const referenceValue = article && hasReference(archived, article) ? article : null;
  const claims = [];
  const year = resolvePlace(archived, same, other,
    `año de fabricación ${published.spec?.['Año de fabricación'] ?? ''}`, 
    (value) => hasYear(value, yearValue));
  if (year) claims.push({ kind: 'year', value: yearValue, location: year });
  const horometer = resolvePlace(archived, same, other,
    [published.spec?.['Horas laborales'], published.spec?.['Horómetro']].join(' '),
    (value) => hourValue !== null && hours(value).has(hourValue));
  if (horometer) claims.push({ kind: 'horometer', value: hourValue, location: horometer });
  if (referenceValue) {
    const reference = resolvePlace(archived, same, other,
      `articulo no ${published.spec?.['Artículo No.'] ?? ''}`,
      (value) => hasReference(value, referenceValue));
    claims.push({ kind: 'seller_reference', value: referenceValue, location: reference });
  }
  const announcement = /\bhoras?\s+(\d+(?:[. ]\d{3})*)\b/iu.exec(plain(original.longDescription))?.[1];
  const announcedHours = announcement ? integer(announcement) : null;
  let discordance = null;
  if (hourValue !== null && announcedHours !== null && hourValue !== announcedHours &&
    hours(archived).has(hourValue) && hours(archived).has(announcedHours)) {
    const publishedGeneral = plain(published.description_general);
    const numbers = hours(publishedGeneral);
    const retained = numbers.has(hourValue) && numbers.has(announcedHours) &&
      /\b(?:discrepancia|discordancia|discordantes|difieren|no se consideran lecturas equivalentes)\b/u
        .test(publishedGeneral);
    discordance = { announcedHours, structuredHours: hourValue,
      result: retained ? 'retained_with_caution' : 'at_risk' };
  }
  return { claims, discordance, missing: claims.filter((claim) => claim.location === 'missing').length,
    atRisk: discordance?.result === 'at_risk' ? 1 : 0 };
};
