const numericToken = /\d{1,3}(?:\.\d{3})+(?:,\d+)?|\d+(?:[.,]\d+)*/gu;
const cautionExpressions = [
  /pendiente de confirmar/giu,
  /debe(?:n)? verificarse/giu,
  /debe(?:n)? confirmarse/giu,
  /sin acreditar/giu,
  /no debe/giu,
  /no permite/giu,
  /no acredita/giu,
  /no se deducen/giu,
  /requiere confirmaci[oó]n/giu
];

const numberKey = (token) => {
  const compact = token.replace(/\.(?=\d{3}(?:\.|,|$))/gu, '');
  const decimal = compact.replace(',', '.');
  const [whole, fraction = ''] = decimal.split('.');
  const normalizedWhole = whole.replace(/^0+(?=\d)/u, '');
  const normalizedFraction = fraction.replace(/0+$/u, '');
  return normalizedFraction ? `${normalizedWhole}.${normalizedFraction}` : normalizedWhole;
};

const numbers = (value) => {
  const result = new Map();
  for (const token of value.match(numericToken) ?? []) {
    const key = numberKey(token);
    if (!result.has(key)) result.set(key, token);
  }
  return result;
};

const cautions = (value) => new Set(cautionExpressions.flatMap((pattern) =>
  [...value.matchAll(pattern)].map((match) => match[0].toLocaleLowerCase('es'))));

export const inspectEditorialTextDifference = (expected, actual, kind) => {
  if (!['different_text', 'full_text_retained_with_suffix'].includes(kind)) return null;
  const earlierNumbers = numbers(expected);
  const currentNumbers = numbers(actual);
  const earlierCautions = cautions(expected);
  const currentCautions = cautions(actual);
  const removedNumbers = [...earlierNumbers.entries()].filter(([key]) => !currentNumbers.has(key))
    .map(([, token]) => token).sort();
  const addedNumbers = [...currentNumbers.entries()].filter(([key]) => !earlierNumbers.has(key))
    .map(([, token]) => token).sort();
  const removedCautions = [...earlierCautions].filter((phrase) => !currentCautions.has(phrase)).sort();
  const addedCautions = [...currentCautions].filter((phrase) => !earlierCautions.has(phrase)).sort();
  if (kind === 'full_text_retained_with_suffix' && (removedNumbers.length || removedCautions.length)) {
    throw new Error('Una ampliación literal no puede eliminar contenido histórico');
  }
  return { removedNumbers, addedNumbers, removedCautions, addedCautions,
    semanticEquivalenceAccredited: false };
};
