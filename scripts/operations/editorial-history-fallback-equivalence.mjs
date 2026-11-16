import { canonicalTechnicalNumber } from './editorial-history-technical.mjs';

const fold = (value) => String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/gu, '').toLowerCase();
const number = String.raw`\d+(?:[.,]\d+)*`;
const quantities = (value) => [...fold(value).matchAll(new RegExp(
  String.raw`\b(${number})\s*(mm|kg|m|kw|w|v|ah)(?!\w)`, 'gu'))]
  .map((match) => `${canonicalTechnicalNumber(match[1])} ${match[2]}`);
const separateModelClaims = /\b(?:plumin|voladizo|opcional|aire acondicionado)\b|\b(?:el fabricante describe|documentacion del fabricante|documentacion de gama)\b/u;
const manufacturerScope = /\b(?:fabricante|documentacion (?:de gama|tecnica)|gama)\b/u;
const protectedClaims = [
  { pattern: /\bpintad[oa]\b/u, signal: 'pintura_no_equivale_a_revision' },
  { pattern: /\bcertificacion ce\b/u, signal: 'certificacion_ce_no_verificada' }
];
const acceptedConcepts = new Set(['publicado_con_mismo_concepto', 'conservado_en_spec_del_mismo_concepto']);
const acceptedNumerics = new Set(['sin_diferencias_numericas', 'solo_formato_numerico',
  'referencia_conservada_en_producto', 'magnitud_en_spec_no_publicada_en_general']);

const preservesDocumentedManufacturerReach = (archived, record, prepared, meaning, technical, modelReference) => {
  const source = fold(archived);
  const reference = fold(modelReference);
  const published = fold(prepared?.product?.description_general);
  const modelClaims = meaning?.signals?.filter((signal) => signal.severity === 'pendiente_fuente_modelo') ?? [];
  const reach = /\b(\d+(?:[.,]\d+)?)\s*m de alcance horizontal documentado por el fabricante\b/u.exec(reference)?.[1];
  return /\bcon un alcance de trabajo documentado por el fabricante para este modelo\b/u.test(source) &&
    /\bbrazo articulado\b/u.test(source) &&
    !/\b(?:plumin|voladizo|opcional|aire acondicionado)\b/u.test(source) &&
    modelClaims.length === 0 &&
    reference.includes(`${fold(record?.brand)} ${fold(record?.model)}`) &&
    reach && published.includes(reference) &&
    reference.includes('documentacion tecnica de referencia del modelo') &&
    /las magnitudes corresponden al modelo o version documentada y no acreditan la configuracion ni las prestaciones de esta unidad/u.test(reference) &&
    technical?.modelOnly === 0 && technical?.unsupported === 0 && technical?.blocking === 0 &&
    ['Alcance lateral', 'Alcance horizontal'].every((name) =>
      !prepared.product.spec?.[name] ||
      canonicalTechnicalNumber(fold(prepared.product.spec[name]).replace(/\s*m$/u, '')) ===
        canonicalTechnicalNumber(reach));
};

const preservesDocumentedModelUseWithoutOptionalEquipment = (archived, record, prepared, meaning, technical, modelReference) => {
  const source = fold(archived);
  const reference = fold(modelReference);
  const published = fold(prepared?.product?.description_general);
  const outsideReference = published.replace(reference, '');
  const specs = prepared?.product?.spec;
  const seller = fold(record?.specs?.['Artículo No.']);
  const workHeight = fold(record?.specs?.['Altura de trabajo']);
  return /\bdocumentacion del fabricante describe la version\b/u.test(source) &&
    source.includes(`version ${fold(record?.model)} con uso previsto en interiores y exteriores`) &&
    /\bsegun sus limites de operacion\b/u.test(source) &&
    /\bno se atribuye a la unidad una bateria opcional\b/u.test(source) &&
    reference.includes(`modelo ${fold(record?.brand)} ${fold(record?.model)}`) &&
    /\buso previsto en interiores y exteriores segun los limites de operacion\b/u.test(reference) &&
    /\bbateria de litio opcional para la gama\b/u.test(reference) &&
    /\baltura de referencia de 9[.,]8 m en interiores y 8 m en exteriores\b/u.test(reference) &&
    /\baltura de plataforma de 7[.,]8 m en interiores y 6 m en exteriores\b/u.test(reference) &&
    published.includes(reference) &&
    /las magnitudes corresponden al modelo o version documentada y no acreditan la configuracion ni las prestaciones de esta unidad/u.test(reference) &&
    !/\bbateria\b/u.test(outsideReference) &&
    !Object.keys(specs ?? {}).some((key) => /\bbateria\b/u.test(fold(key))) &&
    seller && seller === fold(specs?.['Artículo No.']) &&
    source.includes(`referencia de vendedor es ${seller}`) &&
    workHeight && workHeight === fold(specs?.['Altura de trabajo']) &&
    source.includes(`altura de trabajo comercial indicada de ${workHeight}`) &&
    outsideReference.includes(`altura de trabajo de ${workHeight}`) &&
    /\bplataforma de tijera electrica\b/u.test(source) &&
    fold(record?.specs?.['Tipo de motor']) === 'electrico' &&
    fold(specs?.['Tipo de motor']) === 'electrico' &&
    record?.year && specs?.['Año de fabricación'] === record.year &&
    source.includes(`fabricacion ${record.year}`) &&
    outsideReference.includes(`ano de fabricacion ${record.year}`) &&
    meaning?.signals.some((signal) => signal.name === 'bateria_opcional_no_atribuida' && signal.reproduced) &&
    technical?.modelOnly === 0 && technical.unsupported === 0 && technical.blocking === 0;
};

const preservesModelEvidence = (archived, record, prepared, meaning, technical, modelReference) => {
  const source = fold(archived);
  const current = fold(prepared?.product?.description_general);
  const reference = fold(modelReference);
  const spec = prepared?.product?.spec;
  const claims = meaning?.signals?.filter((signal) => signal.severity === 'pendiente_fuente_modelo') ?? [];
  const allowedClaims = new Set(['plumin_del_texto_historico', 'ausencia_voladizo_trasero_de_modelo']);
  const sellerReference = fold(record?.specs?.['Artículo No.']).trim();
  const sourceSeller = /\breferencia\s+(?:comercial|de vendedor)\s+(?:es\s+)?([a-z\d-]+)\b/u.exec(source)?.[1] ??
    /\breferencia\s+([a-z\d-]+)\s+del\s+vendedor\b/u.exec(source)?.[1] ?? null;
  const modelOnly = technical?.signals?.filter((signal) => signal.result === 'referencia_de_modelo_no_acredita_unidad') ?? [];
  const referenceReach = /\b(\d+(?:[.,]\d+)?)\s*m de alcance horizontal\b/u.exec(reference)?.[1] ?? null;
  const modelAssertionsOutsideReference = current.replace(reference, '');
  return claims.length > 0 && claims.every((signal) => allowedClaims.has(signal.name) &&
    signal.reproduced && signal.evidence === 'referencia_tecnica_compartida' &&
    !signal.publicationWithoutEvidence) &&
    claims.some((signal) => signal.name === 'plumin_del_texto_historico') &&
    (!claims.some((signal) => signal.name === 'ausencia_voladizo_trasero_de_modelo') ||
      /\bsin voladizo trasero\b/u.test(reference)) &&
    (/\b(?:el fabricante describe|la documentacion de gama senala)\b/u.test(source) ||
      source.includes(`${fold(record?.brand)} describe`)) &&
    !/\b(?:opcional|aire acondicionado)\b/u.test(source) &&
    reference.includes(fold(record?.brand)) && reference.includes(fold(record?.model)) &&
    /\bplumin\b/u.test(reference) && reference.includes('documentacion del fabricante') &&
    current.includes(reference) &&
    !/\b(?:incluye|incorpora|equipa|monta|dispone de|cuenta con)\s+(?:un\s+|el\s+)?plumin\b|\b(?:evita|sin)\s+(?:el\s+)?voladizo trasero\b/u.test(modelAssertionsOutsideReference) &&
    /las magnitudes corresponden al modelo o version documentada y no acreditan la configuracion ni las prestaciones de esta unidad/u.test(reference) &&
    record?.year && source.includes(record.year) && spec?.['Año de fabricación'] === record.year &&
    current.includes(`ano de fabricacion ${record.year}`) &&
    meaning.signals.some((signal) => signal.name === 'horas_de_unidad' && signal.reproduced) &&
    sellerReference && sourceSeller === sellerReference && fold(spec['Artículo No.']) === sellerReference &&
    current.includes(`referencia comercial declarada por el vendedor: ${sellerReference}`) &&
    referenceReach && (!spec['Alcance horizontal'] || fold(spec['Alcance horizontal']) === `${referenceReach} m`) &&
    fold(spec['Altura de trabajo']) === fold(record.specs?.['Altura de trabajo']) &&
    modelOnly.every((signal) => signal.concept === 'alcance_lateral' &&
      reference.includes(`${signal.value} de alcance horizontal`));
};

export const preservesArchivedFallbackUnitFacts = (archived, record, prepared, numbers, meaning, technical, signed, modelReference = null) => {
  if (!signed || signed.subject !== `${record?.providerId}:${record?.reference}` ||
    signed.sourceUrl !== record?.url || signed.value !== archived) return false;
  const source = fold(archived);
  const current = fold(prepared?.product?.title);
  const general = fold(prepared?.product?.description_general);
  const spec = prepared?.product?.spec;
  const modelEvidence = preservesModelEvidence(archived, record, prepared, meaning, technical, modelReference) ||
    preservesDocumentedManufacturerReach(archived, record, prepared, meaning, technical, modelReference) ||
    preservesDocumentedModelUseWithoutOptionalEquipment(archived, record, prepared, meaning, technical, modelReference);
  const historicalReference = /\breferencia(?: comercial)?(?: publicada por el vendedor| del vendedor)?(?: es)?\s+((?=[a-z\d-]*\d)[a-z\d-]+)\b/u.exec(source)?.[1] ?? null;
  const originalReferences = [record.reference, record.specs?.['Artículo No.']].map(fold);
  const publishedReferences = [prepared?.product?.reference, spec?.['Artículo No.']].map(fold);
  const unitEquipment = [
    { pattern: /\btriplex\b/u, key: 'Tipo de mástil', accepted: ['triple', 'triplex'], published: /\bmastil triplex\b/u },
    { pattern: /\bbateria de plomo-acido\b/u, key: 'Tipo de Batería', accepted: ['plomo-acido'], published: /\bbateria de plomo-acido\b/u }
  ];
  const equipmentPreserved = unitEquipment.every(({ pattern, key, accepted, published }) =>
    !pattern.test(source) || (accepted.includes(fold(record.specs?.[key])) &&
      fold(spec?.[key]) === fold(record.specs?.[key]) && published.test(general)));
  const documentedOptionalBatteryNotAssigned = modelEvidence &&
    /\bno se atribuye a la unidad una bateria opcional\b/u.test(source);
  const unsupportedEquipment = /\b(?:triplex|bateria)\b/u.test(source) &&
    (!equipmentPreserved || /\bbateria\b/u.test(source) &&
      !/\bbateria de plomo-acido\b/u.test(source) && !documentedOptionalBatteryNotAssigned);
  const powerPreserved = !/\bpotencia\b/u.test(source) ||
    technical?.signals.some((signal) => signal.concept === 'potencia_luminarias' &&
      acceptedConcepts.has(signal.result));
  if (!record?.brand || !record.model || !current || !general || !spec ||
    prepared.product.providerId !== record.providerId || prepared.product.reference !== record.reference ||
    prepared.product.sourceUrl !== record.url ||
    (historicalReference && (!originalReferences.includes(historicalReference) ||
      !publishedReferences.includes(historicalReference))) ||
    !source.includes(fold(record.brand)) || !source.includes(fold(record.model)) ||
    !current.includes(fold(record.brand)) || !current.includes(fold(record.model)) ||
    !acceptedNumerics.has(numbers?.category) ||
    numbers.evidence.some((entry) => !['referencia_conservada_en_producto',
      'magnitud_en_spec_no_publicada_en_general'].includes(entry.basis)) ||
    meaning?.blocking !== 0 || meaning.unreproduced !== 0 || meaning.unsupportedModelClaims !== 0 ||
    meaning.unverifiedModelPublications !== 0 || technical?.blocking !== 0 ||
    technical.unsupported !== 0 || (technical.modelOnly !== 0 && !modelEvidence) ||
    technical.signals.some((signal) => !acceptedConcepts.has(signal.result) &&
      !(modelEvidence && signal.result === 'referencia_de_modelo_no_acredita_unidad' &&
        signal.concept === 'alcance_lateral')) ||
    (separateModelClaims.test(source) && !modelEvidence) || unsupportedEquipment || !powerPreserved ||
    protectedClaims.some(({ pattern, signal }) => pattern.test(source) &&
      !meaning.signals.some((entry) => entry.name === signal && entry.reproduced))) return false;
  const archivedMeasures = quantities(archived);
  const coveredMeasures = new Set(technical.signals.map((signal) => signal.value));
  const archivedModelReach = /\balcance horizontal de (?:hasta )?(\d+(?:[.,]\d+)?)\s*m\b/u.exec(source)?.[1];
  const documentedModelReach = /\b(\d+(?:[.,]\d+)?)\s*m de alcance horizontal\b/u.exec(fold(modelReference))?.[1];
  if (modelEvidence && archivedModelReach && documentedModelReach &&
    canonicalTechnicalNumber(archivedModelReach) === canonicalTechnicalNumber(documentedModelReach)) {
    coveredMeasures.add(`${canonicalTechnicalNumber(archivedModelReach)} m`);
  }
  if (archivedMeasures.some((value) => !coveredMeasures.has(value))) return false;
  const detailedUnitFacts = archivedMeasures.length >= 4 && technical.signals.length >= 4;
  const compactUnitFacts = archivedMeasures.length >= 1 && technical.signals.length >= 1 &&
    meaning.signals.some((signal) => signal.severity === 'bloqueante' && signal.reproduced) &&
    (!manufacturerScope.test(source) || modelEvidence);
  if (!detailedUnitFacts && !compactUnitFacts) return false;
  if (/\b(?:ocasion|segunda mano|usad[ao])\b/u.test(source) &&
    prepared.product.condition !== 'Segunda_Mano') return false;
  if (/\b(?:nueva|nuevo|sin estrenar)\b/u.test(source) &&
    (record.condition !== 'Nuevo' || prepared.product.condition !== 'Nuevo')) return false;
  if (/\b(?:no (?:se )?especifica (?:el )?ano|sin ano indicado)\b/u.test(source) &&
    (record.year || spec['Año de fabricación'])) return false;
  const oldIndividualEnergy = !meaning.signals.some((signal) => signal.name === 'motorizacion_no_individualizada') &&
    (/\b(?:motorizacion|motor)\s+(?:electrica|electrico|diesel)\b/u.test(source) ||
      /\b(?:dispone de un motor|ficha le asigna un motor)\s+(?:electrico|diesel)\b/u.test(source));
  if (oldIndividualEnergy) {
    const energy = /\b(?:electrica|electrico)\b/u.test(source) ? /\b(?:electrica|electrico)\b/u : /\bdiesel\b/u;
    if (!energy.test(current) && !energy.test(fold(spec.Motor)) &&
      !energy.test(fold(spec['Tipo de motor']))) return false;
  }
  return true;
};

const moduleDimensions = (value) => {
  const match = /\b(\d+(?:[.,]\d+)?)\s*(?:m\s*)?[x×]\s*(\d+(?:[.,]\d+)?)\s*m\b/u.exec(fold(value));
  return match?.slice(1).map(canonicalTechnicalNumber) ?? null;
};
const moduleDesignation = (value) => {
  const match = /\b([a-z][a-z0-9]*)\s*-\s*([a-z][a-z0-9]*\d+[a-z0-9]*)\b/u.exec(fold(value));
  return match ? `${match[1]}-${match[2]}` : null;
};
const dimensionIn = (value, measure, concept) => [...fold(value).matchAll(
  /\b(\d+(?:[.,]\d+)?)\s*m\s+de\s+(longitud|anchura)\b/gu)]
  .some((match) => match[2] === concept && canonicalTechnicalNumber(match[1]) === measure);

export const preservesArchivedFallbackModuleFacts = (archived, record, prepared, numbers, meaning, technical, signed) => {
  const source = fold(archived);
  const original = fold(record?.longDescription);
  const general = fold(prepared?.product?.description_general);
  const spec = prepared?.product?.spec;
  const sourceDimensions = moduleDimensions(archived);
  const originalDimensions = moduleDimensions(record?.longDescription);
  const preparedDimensions = moduleDimensions(prepared?.product?.title);
  const designation = moduleDesignation(archived);
  const originalDesignation = moduleDesignation(record?.longDescription);
  if (!signed || signed.subject !== `${record?.providerId}:${record?.reference}` ||
    signed.sourceUrl !== record?.url || signed.value !== archived ||
    prepared?.product?.providerId !== record?.providerId ||
    prepared.product.reference !== record.reference || prepared.product.sourceUrl !== record.url ||
    record.brand || record.model || record.year || record.horometer || !spec ||
    !/\bmodulo\b/u.test(source) || !/\bcaseta\s+diafana\b/u.test(source) ||
    !/\bmodulo\b/u.test(original) || !/\bcaseta\s+diafana\b/u.test(original) ||
    !/\bcaseta\s+diafana\b/u.test(general) ||
    !sourceDimensions || !originalDimensions || !preparedDimensions ||
    sourceDimensions.some((measure, index) => measure !== originalDimensions[index]) ||
    !designation || designation !== originalDesignation ||
    !/\bmodulo\s+caseta\s+diafana\b/u.test(fold(prepared.product.title)) ||
    preparedDimensions.some((measure, index) => measure !== sourceDimensions[index]) ||
    !general.replace(/\s*-\s*/gu, '-').includes(designation) ||
    !/\baire\s+acondicionado\b/u.test(source) ||
    !/\bcon\s+aire\b/u.test(original) ||
    !/\baire\s+acondicionado\b/u.test(general) ||
    fold(spec['Climatización instalada según anuncio']) !== 'aire acondicionado' ||
    !/\bpuerta\b[^.]*\blateral\s+corto\b/u.test(source) ||
    !/\bpuerta\b[^.]*\blateral\b[^.]*\blado\s+corto\b/u.test(original) ||
    !/\bpuerta\b[^.]*\blados?\s+cortos?\b/u.test(general) ||
    fold(spec['Ubicación de la puerta']) !== 'lado corto' ||
    !acceptedNumerics.has(numbers?.category) || numbers.evidence?.length ||
    meaning?.blocking !== 0 || meaning?.unreproduced !== 0 ||
    meaning?.unsupportedModelClaims !== 0 || meaning?.unverifiedModelPublications !== 0 ||
    technical?.blocking !== 0 || technical?.unsupported !== 0 || technical?.modelOnly !== 0 ||
    technical?.signals?.length !== 0) return false;
  return dimensionIn(general, sourceDimensions[0], 'longitud') &&
    dimensionIn(general, sourceDimensions[1], 'anchura') &&
    canonicalTechnicalNumber(fold(spec['Longitud exterior anunciada']).replace(/\s*m$/u, '')) === sourceDimensions[0] &&
    canonicalTechnicalNumber(fold(spec['Anchura exterior anunciada']).replace(/\s*m$/u, '')) === sourceDimensions[1];
};
