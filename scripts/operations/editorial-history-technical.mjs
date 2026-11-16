const fold = (value) => String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/gu, '').toLowerCase();
const numeric = String.raw`\d+(?:[.,]\d+)*`;
export const canonicalTechnicalNumber = (value) => {
  let text = value.replace(/,/gu, '.');
  if (/^\d{1,3}(?:\.\d{3})+(?:\.\d+)?$/u.test(text)) text = text.replace(/\.(?=\d{3}(?:\.|$))/gu, '');
  const [whole, decimal] = text.split('.');
  const fraction = decimal?.replace(/0+$/u, '') ?? '';
  return `${whole.replace(/^0+(?=\d)/u, '')}${fraction ? `.${fraction}` : ''}`;
};

const canonical = canonicalTechnicalNumber;

const concepts = [
  { name: 'altura_trabajo', names: ['altura de trabajo', 'altura de trabajo comercial indicada', 'altura consignada en el campo de trabajo'], field: 'Altura de trabajo', unit: 'm' },
  { name: 'altura_plataforma', names: ['altura de plataforma'], field: 'Altura plataforma', unit: 'm' },
  { name: 'altura_almacenaje', names: ['altura de almacenaje', 'altura en posicion de almacenaje'], field: 'Altura almacenaje', unit: 'm' },
  { name: 'alcance_lateral', names: ['alcance lateral', 'alcance horizontal'], field: 'Alcance lateral', unit: 'm' },
  { name: 'altura_elevacion', names: ['altura maxima de elevacion', 'altura de elevacion'], field: 'Altura máxima de elevación', unit: 'm|mm' },
  { name: 'capacidad', names: ['capacidad de carga', 'capacidad nominal', 'capacidad maxima', 'capacidad', 'carga nominal'], field: 'Capacidad', fields: ['Capacidad', 'Capacidad máxima de elevación'], unit: 'kg' },
  { name: 'peso', names: ['peso declarado', 'peso', 'masa'], field: 'Peso', unit: 'kg' },
  { name: 'longitud', names: ['longitud', 'largo'], field: 'Longitud', unit: 'm' },
  { name: 'anchura_limpieza', names: ['anchura de limpieza', 'anchura de trabajo de limpieza'], field: 'Anchura limpieza', unit: 'm' },
  { name: 'anchura', names: ['anchura(?! de (?:limpieza|trabajo))', 'ancho'], field: 'Anchura', unit: 'm' },
  { name: 'potencia_luminarias', names: [], field: 'Potencia', unit: 'w' }
];

const readClaims = (text, concept) => {
  const value = fold(text);
  if (concept.name === 'potencia_luminarias') return [...value.matchAll(
    /\b(?:potencia\s+(?:indicada|declarada)(?:\s+como)?|(?:configuracion\s+de\s+)?luminarias\s+declarada\s+de)\s*(\d+)\s*[x×]\s*(\d+)\s*w\b/gu)]
    .map((match) => ({ number: canonical(match[2]), unit: 'w', count: canonical(match[1]) }));
  const label = concept.names.map((name) => `(?:${name})`).join('|');
  const qualifier = String.raw`(?:\s+(?:declarada|declarado|indicada|indicado|publicada|publicado|consignada|consignado|nominal|maxima|maximo))?`;
  const forward = new RegExp(String.raw`\b(?:${label})${qualifier}\s*(?:(?:es\s+de|de|es|en|como|:|hasta|alcanza)\s*)?(${numeric})\s*(${concept.unit})(?!\w)`, 'gu');
  const backward = new RegExp(String.raw`\b(${numeric})\s*(${concept.unit})\s+de\s+(?:${label})\b`, 'gu');
  const claims = [...value.matchAll(forward), ...value.matchAll(backward)]
    .map((match) => ({ number: canonical(match[1]), unit: match[2] }));
  if (concept.name === 'altura_trabajo') {
    for (const match of value.matchAll(new RegExp(
      String.raw`\b(${numeric})\s*m\s+en el campo de altura de trabajo\b`, 'gu'))) {
      claims.push({ number: canonical(match[1]), unit: 'm' });
    }
  }
  return [...new Map(claims.map((claim) => [`${claim.number}|${claim.unit}`, claim])).values()];
};

const structured = (spec, concept) => {
  const field = (concept.fields ?? [concept.field]).find((name) =>
    typeof spec?.[name] === 'string' && spec[name].trim());
  if (!field) return null;
  const source = String(spec[field]);
  if (concept.name === 'potencia_luminarias') {
    const match = /\b(\d+)\s*[x×]\s*(\d+)\s*w\b/iu.exec(source);
    return match ? { number: canonical(match[2]), unit: 'w', count: canonical(match[1]), field } : null;
  }
  const match = new RegExp(String.raw`\b(${numeric})\s*(${concept.unit})(?!\w)`, 'iu').exec(source);
  return match ? { number: canonical(match[1]), unit: fold(match[2]), field } : null;
};

const same = (a, b) => a && b && a.number === b.number && a.unit === b.unit &&
  (a.count ?? null) === (b.count ?? null);

const sameHeight = (candidate, claim) => same(candidate, claim) ||
  candidate?.unit === 'mm' && claim.unit === 'm' && Number(candidate.number) === Number(claim.number) * 1000 ||
  candidate?.unit === 'm' && claim.unit === 'mm' && Number(candidate.number) * 1000 === Number(claim.number);

const contradictoryHeightIn = (value, claim) => [...fold(value).matchAll(new RegExp(
  String.raw`\b(${numeric})\s*(m|mm)(?!\w)`, 'gu'))].some((match) =>
  sameHeight({ number: canonical(match[1]), unit: match[2] }, claim));

const contradictoryPublication = (published, claim) => {
  const sentences = String(published ?? '').split(/(?<=[.!?])\s+(?=\p{Lu})/u);
  const pattern = new RegExp(String.raw`\b(${numeric})\s*(m|mm)(?!\w)`, 'gu');
  let mentioned = false;
  for (const sentence of sentences) {
    const source = fold(sentence);
    if (![...source.matchAll(pattern)].some((match) => sameHeight({ number: canonical(match[1]), unit: match[2] }, claim))) {
      continue;
    }
    mentioned = true;
    if (!source.includes('altura de plataforma') ||
      !/(?:contradic|incompatib|no concuerda|no se (?:utiliza|presenta|atribuye)|sin atribuir)/u.test(source)) {
      return 'atribuida';
    }
  }
  return mentioned ? 'advertida' : 'ausente';
};

export const inspectArchivedFallbackTechnical = (archived, published, record, prepared, modelReference) => {
  const productSpec = prepared.product.spec ?? {};
  const signals = [];
  for (const concept of concepts) {
    const sourceClaims = readClaims(archived, concept);
    const original = structured(record.specs, concept);
    if (concept.name === 'altura_plataforma' && original &&
      /altura (?:de )?plataforma/u.test(fold(archived)) &&
      /(?:contradic|incompatib|no concuerda|no se presenta como una prestacion)/u.test(fold(archived))) {
      const mentions = [...fold(archived).matchAll(new RegExp(String.raw`\b(${numeric})\s*(${concept.unit})(?!\w)`, 'gu'))]
        .map((match) => ({ number: canonical(match[1]), unit: match[2] }));
      if (mentions.some((value) => same(value, original)) &&
        !sourceClaims.some((claim) => same(claim, original))) sourceClaims.push(original);
    }
    if (sourceClaims.length === 0) continue;
    const current = structured(productSpec, concept);
    const finalClaims = readClaims(published, concept);
    for (const claim of sourceClaims) {
      const sourceCorroborated = same(claim, original);
      const publishedClaim = finalClaims.some((value) => same(value, claim));
      const modelCorroborated = !sourceCorroborated &&
        readClaims(modelReference, concept).some((value) => same(value, claim));
      const specCorroborated = sourceCorroborated && same(current, original);
      const specIncompatible = sourceCorroborated && current && !same(current, original);
      const conflictingPublication = sourceCorroborated && finalClaims.some((value) =>
        value.unit === claim.unit && !same(value, original));
      const historicalContradiction = concept.name === 'altura_plataforma' && sourceCorroborated &&
        /(?:contradic|incompatib|no concuerda|no se presenta como una prestacion)/iu.test(fold(archived));
      const contradictoryUse = historicalContradiction ? contradictoryPublication(published, claim) : null;
      const contradictorySpec = historicalContradiction && contradictoryHeightIn(productSpec[concept.field], claim);
      const result = historicalContradiction && (contradictorySpec || contradictoryUse === 'atribuida') ?
        'publicacion_conceptualmente_incompatible' :
        historicalContradiction && contradictoryUse === 'advertida' ? 'contradiccion_advertida_sin_atribuir' :
        historicalContradiction ? 'contradiccion_excluida' :
        specIncompatible ? 'publicacion_conceptualmente_incompatible' :
        modelCorroborated ? 'referencia_de_modelo_no_acredita_unidad' :
        !sourceCorroborated ? 'sin_correspondencia_en_spec_de_unidad' :
        conflictingPublication ? 'publicacion_conceptualmente_incompatible' :
        publishedClaim ? 'publicado_con_mismo_concepto' :
        specCorroborated ? 'conservado_en_spec_del_mismo_concepto' : 'perdido_del_producto';
      signals.push({ concept: concept.name, value: `${claim.number} ${claim.unit}`, result,
        sourceField: original?.field ?? concept.field, originalValue: original ? `${original.number} ${original.unit}` : null,
        publishedValue: finalClaims.map((value) => `${value.number} ${value.unit}`),
        currentSpecValue: current ? `${current.number} ${current.unit}` : null });
    }
  }
  return {
    signals,
    published: signals.filter((signal) => signal.result === 'publicado_con_mismo_concepto').length,
    structured: signals.filter((signal) => signal.result === 'conservado_en_spec_del_mismo_concepto').length,
    excluded: signals.filter((signal) => signal.result === 'contradiccion_excluida').length,
    modelOnly: signals.filter((signal) => signal.result === 'referencia_de_modelo_no_acredita_unidad').length,
    unsupported: signals.filter((signal) => signal.result === 'sin_correspondencia_en_spec_de_unidad').length,
    blocking: signals.filter((signal) => ['publicacion_conceptualmente_incompatible', 'perdido_del_producto'].includes(signal.result)).length
  };
};

export const justifiesDiscardedFallback = (numbers, meaning, technical) =>
  numbers?.category === 'altura_de_plataforma_contradictoria_excluida' &&
  numbers.missing.length > 0 &&
  numbers.evidence.length === numbers.missing.length &&
  numbers.evidence.every((entry) => entry.basis === 'altura_de_plataforma_contradictoria_excluida') &&
  meaning?.blocking === 0 && meaning.unreproduced === 0 &&
  meaning.unverifiedModelPublications === 0 &&
  technical?.excluded === 1 && technical.blocking === 0 && technical.unsupported === 0 &&
  technical.modelOnly === 0 &&
  technical.signals.length > 1 &&
  technical.signals.every((signal) =>
    ['publicado_con_mismo_concepto', 'conservado_en_spec_del_mismo_concepto',
      'contradiccion_excluida'].includes(signal.result));
