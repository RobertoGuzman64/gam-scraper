const fold = (value) => String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/gu, '').toLowerCase()
  .replace(/\s+/gu, ' ').trim();
const numeric = String.raw`\d+(?:[.,]\d+)*`;
const normalizeNumber = (value) => {
  let normalized = value.replace(/,/gu, '.');
  if (/^\d{1,3}(?:\.\d{3})+(?:\.\d+)?$/u.test(normalized)) {
    normalized = normalized.replace(/\.(?=\d{3}(?:\.|$))/gu, '');
  }
  const [whole, fraction] = normalized.split('.');
  const decimal = fraction?.replace(/0+$/u, '') ?? '';
  return `${whole.replace(/^0+(?=\d)/u, '')}${decimal ? `.${decimal}` : ''}`;
};
const measurements = (value) => {
  const result = new Set();
  for (const match of fold(value).matchAll(new RegExp(String.raw`\b(${numeric})\s*(kg|mm|m|ah|v|a|w)\b`, 'gu'))) {
    result.add(`${normalizeNumber(match[1])}|${match[2]}`);
  }
  return result;
};
const warning = /\b(?:discrepanc\w*|contradic\w*|difier\w*|diferenc\w*|no concuerd\w*|no puede darse|no se (?:confirma|fija|acredita|considera|declara)|deben contrastarse|debe contrastarse|deben verificarse|debe verificarse|se mantienen ambas)\b/u;
const readings = (value) => {
  const source = fold(value);
  const result = new Set([...source.matchAll(new RegExp(
    String.raw`\b(${numeric})\s*(?:horas?|h\b)`, 'gu'))].map((match) => normalizeNumber(match[1])));
  for (const sentence of source.split(/(?<=[.!?])\s+(?=\p{L})/u)) {
    if (!/\b(?:horas?|horometro)\b/u.test(sentence) || !warning.test(sentence)) continue;
    for (const match of sentence.matchAll(new RegExp(String.raw`\b(${numeric})\b`, 'gu'))) {
      if (/^\s*(?:kg|mm|m\b|ah|v\b|a\b|w\b)/u.test(sentence.slice(match.index + match[0].length))) continue;
      result.add(normalizeNumber(match[0]));
    }
  }
  return result;
};

export const preservesEditorialSupersession = (archived, selected, record, prepared) => {
  if (typeof archived !== 'string' || typeof selected !== 'string' || !record || !prepared?.product) return false;
  const previous = fold(archived);
  const current = fold(selected);
  const retainedMeasurements = measurements(current);
  if ([...measurements(previous)].some((value) => !retainedMeasurements.has(value))) return false;
  const archivedReadings = readings(previous);
  const selectedReadings = readings(current);
  if ([...archivedReadings].some((value) => !selectedReadings.has(value))) return false;
  if (archivedReadings.size > 1 && warning.test(previous) && !warning.test(current)) return false;
  const model = fold(record.model);
  if (model && previous.includes(model) && !current.includes(model) &&
    !fold(prepared.product.title).includes(model) && !fold(prepared.product.model).includes(model)) return false;
  if (/\bmotor:\s*electrico\b/u.test(previous) && /\bno\b[^.]{0,120}\b(?:traccion|vehiculo)\b/u.test(previous) &&
    (!/\bno\b[^.]{0,120}\b(?:traccion|vehiculo)\b/u.test(current) ||
      /(?<!\bno\s)\b(?:permite afirmar|acredita que)\b[^.]{0,120}\b(?:traccion|vehiculo)\b/u.test(current))) return false;
  return true;
};
