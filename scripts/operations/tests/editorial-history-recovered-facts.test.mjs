import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import { accreditEditorialHistoryConsumption, loadEditorialHistoryInventory } from '../editorial-history-inventory.mjs';
import { inspectArchivedFallbackTechnical } from '../editorial-history-technical.mjs';
import { preservesArchivedFallbackUnitFacts, preservesArchivedFallbackModuleFacts } from '../editorial-history-fallback-equivalence.mjs';
import { inspectArchivedFallbackMeaning } from '../editorial-history-meaning.mjs';

const root = resolve(fileURLToPath(new URL('../../..', import.meta.url)));
const read = (file) => JSON.parse(readFileSync(join(root, file), 'utf8'));
const originals = ['gam', 'gomariz', 'mercaeleva'].flatMap((provider) =>
  read(`catalogs/providers/${provider}/original/scrape-${provider}-catalog.json`).products);
const bySubject = new Map(originals.map((record) => [`${record.providerId}:${record.reference}`, record]));
let production;
let census;
const loadProduction = async () => {
  if (!production) {
    const [{ editorialSourceDigest }, { resolveKnowledgeEditorial }, { prepareSourceProduct },
      { resolveEditorialFacts }] = await Promise.all([
      import('../../../dist/infrastructure/filesystem/editorial/knowledge.js'),
      import('../../../dist/preparation/shared/editorial/mapping/knowledge-editorial.js'),
      import('../../../dist/preparation/prepare-product.js'),
      import('../../../dist/preparation/shared/editorial/domain/editorial-facts.js')
    ]);
    production = { digestUnit: editorialSourceDigest, resolveUnit: resolveKnowledgeEditorial,
      prepareUnit: prepareSourceProduct, resolveFacts: resolveEditorialFacts };
  }
  return production;
};
const accredited = async () => {
  if (!census) census = accreditEditorialHistoryConsumption(loadEditorialHistoryInventory(root),
    originals, await loadProduction());
  return census;
};
const fact = async (subject) => {
  const item = (await accredited()).entries.find((entry) => entry.subject === subject &&
    entry.consumption?.result === 'composed_instead_of_fallback');
  const record = bySubject.get(subject);
  assert.ok(item && record);
  return { item, record, prepared: (await loadProduction()).prepareUnit(record) };
};
const technical = async (item, record, prepared) => inspectArchivedFallbackTechnical(item.value,
  prepared.product.description_general, record, prepared,
  (await loadProduction()).resolveUnit(record, record).modelReference ?? null);
const preserved = (item, record, prepared, inspected) => preservesArchivedFallbackUnitFacts(
  item.value, record, prepared, item.consumption.numericReconciliation,
  item.consumption.meaningReconciliation, inspected, item);

test('acredita ocho hechos de unidad adicionales sin confundirlos con expresión literal o conocimiento de modelo', async () => {
  const result = await accredited();
  assert.equal(result.totals.discovered, 689);
  assert.deepEqual(result.totals.states, {
    ACREDITADO_COMPARTIDO: 0, ACREDITADO_ESPECIFICO: 635,
    PENDIENTE_TRASLADO: 0, PENDIENTE_EQUIVALENCIA: 0,
    BLOQUEADO_EVIDENCIA: 1, NO_APLICABLE_JUSTIFICADO: 53
  });
  for (const subject of ['gomariz:CA1041', 'gomariz:CA1436', 'gomariz:MT1314',
    'gomariz:MT1659', 'gomariz:TO1241', 'gomariz:BA1358',
    'mercaeleva:M200-9533', 'mercaeleva:M476-1722']) {
    const { item, record, prepared } = await fact(subject);
    assert.equal(item.status, 'ACREDITADO_ESPECIFICO');
    assert.equal(item.consumption.factsPreserved, true);
    assert.equal(preserved(item, record, prepared, item.consumption.technicalReconciliation), true);
  }
  const last = await fact('mercaeleva:M005-4474');
  assert.equal(last.item.status, 'ACREDITADO_ESPECIFICO');
  assert.equal(last.item.consumption.factsPreserved, true);
});

test('revoca la capacidad si cambia su campo real o el contenido publicado', async () => {
  for (const subject of ['mercaeleva:M200-9533', 'mercaeleva:M476-1722']) {
    const { item, record, prepared } = await fact(subject);
    const altered = { ...prepared, product: { ...prepared.product,
      spec: { ...prepared.product.spec, 'Capacidad máxima de elevación': '900 kg' } } };
    const checked = await technical(item, record, altered);
    assert.equal(checked.blocking, 1);
    assert.equal(preserved(item, record, altered, checked), false);
    const withoutCapacity = { ...prepared, product: { ...prepared.product,
      description_general: prepared.product.description_general.replace(/(?:4\.000|1\.600) kg/gu, '900 kg') } };
    const changed = await technical(item, record, withoutCapacity);
    assert.equal(changed.blocking, 1);
    assert.equal(preserved(item, record, withoutCapacity, changed), false);
  }
});

test('una altura de carretilla solo queda conservada en su campo estructurado', async () => {
  for (const subject of ['gomariz:CA1041', 'gomariz:CA1436']) {
    const { item, record, prepared } = await fact(subject);
    const original = await technical(item, record, prepared);
    assert.equal(original.signals.some((signal) => signal.concept === 'altura_trabajo' &&
      signal.result === 'conservado_en_spec_del_mismo_concepto'), true);
    const altered = { ...prepared, product: { ...prepared.product,
      spec: { ...prepared.product.spec, 'Altura de trabajo': '9 m' } } };
    const checked = await technical(item, record, altered);
    assert.equal(checked.blocking, 1);
    assert.equal(preserved(item, record, altered, checked), false);
  }
});

test('una configuración de cuatro luminarias de 120 W no se confunde con otra cantidad o potencia', async () => {
  const { item, record, prepared } = await fact('gomariz:TO1241');
  const signal = (await technical(item, record, prepared)).signals.find((entry) =>
    entry.concept === 'potencia_luminarias');
  assert.equal(signal?.value, '120 w');
  assert.equal(signal?.result, 'publicado_con_mismo_concepto');
  const alteredText = { ...prepared, product: { ...prepared.product,
    description_general: prepared.product.description_general.replace('4 × 120 W', '3 × 120 W') } };
  const mismatchedText = await technical(item, record, alteredText);
  assert.equal(mismatchedText.blocking, 1);
  assert.equal(preserved(item, record, alteredText, mismatchedText), false);
  const alteredSpec = { ...prepared, product: { ...prepared.product,
    spec: { ...prepared.product.spec, Potencia: '4 x 100W' } } };
  const mismatchedSpec = await technical(item, record, alteredSpec);
  assert.equal(mismatchedSpec.blocking, 1);
  assert.equal(preserved(item, record, alteredSpec, mismatchedSpec), false);
});

test('mástil y batería individuales exigen configuración conservada, no equivalencia por nombre de modelo', async () => {
  const { item, record, prepared } = await fact('mercaeleva:M476-1722');
  for (const [field, value] of [['Tipo de mástil', 'Simple'], ['Tipo de Batería', 'Litio']]) {
    const altered = { ...prepared, product: { ...prepared.product,
      spec: { ...prepared.product.spec, [field]: value } } };
    assert.equal(preserved(item, record, altered, item.consumption.technicalReconciliation), false);
  }
  const alteredText = { ...prepared, product: { ...prepared.product,
    description_general: prepared.product.description_general.replace('mástil tríplex', 'mástil dúplex') } };
  assert.equal(preserved(item, record, alteredText, item.consumption.technicalReconciliation), false);
  assert.equal(preserved({ ...item, sourceUrl: `${item.sourceUrl}?otra` }, record,
    prepared, item.consumption.technicalReconciliation), false);
});

test('la referencia del vendedor no se deduce de expresiones comunes que siguen a referencia', async () => {
  const { item, record, prepared } = await fact('gomariz:MT1659');
  assert.equal(preserved(item, record, prepared, item.consumption.technicalReconciliation), true);
  const incorrect = `${item.value} Referencia 9999.`;
  assert.equal(preservesArchivedFallbackUnitFacts(incorrect, record, prepared,
    item.consumption.numericReconciliation, item.consumption.meaningReconciliation,
    item.consumption.technicalReconciliation, { ...item, value: incorrect }), false);
});

test('conserva los hechos de un módulo sin marca cuando coinciden origen, dimensiones, climatización y puerta', async () => {
  const { item, record, prepared } = await fact('mercaeleva:M294-4678');
  assert.equal(item.status, 'ACREDITADO_ESPECIFICO');
  assert.equal(item.consumption.factsPreserved, true);
  assert.equal(item.consumption.technicalReconciliation.signals.length, 0);
  const evidence = item.consumption;
  const accepts = (origin, output, signed = item) => preservesArchivedFallbackModuleFacts(
    item.value, origin, output, evidence.numericReconciliation,
    evidence.meaningReconciliation, evidence.technicalReconciliation, signed);
  assert.equal(accepts(record, prepared), true);
  assert.equal(accepts({ ...record, reference: 'M294-4679' }, prepared), false);
  assert.equal(accepts({ ...record, url: `${record.url}?extra=1` }, prepared), false);
  assert.equal(accepts({ ...record, brand: 'CBOX' }, prepared), false);
  assert.equal(accepts({ ...record, longDescription: record.longDescription.replace('2,35m', '2,45m') }, prepared), false);
  assert.equal(accepts({ ...record, longDescription: record.longDescription.replace('CON AIRE', 'SIN AIRE') }, prepared), false);
  assert.equal(accepts({ ...record, longDescription: record.longDescription.replace('LADO CORTO', 'LADO LARGO') }, prepared), false);
  assert.equal(accepts({ ...record, longDescription: record.longDescription.replace('CASETA6', 'CASETA7') }, prepared), false);
  assert.equal(accepts(record, { ...prepared, product: { ...prepared.product, sourceUrl: 'https://other.invalid' } }), false);
  assert.equal(accepts(record, { ...prepared, product: { ...prepared.product,
    description_general: prepared.product.description_general.replace('2,35 m de anchura', '2,45 m de anchura') } }), false);
  assert.equal(accepts(record, { ...prepared, product: { ...prepared.product,
    description_general: prepared.product.description_general.replace('CBOX-CASETA6', 'CBOX-CASETA7') } }), false);
  assert.equal(accepts(record, { ...prepared, product: { ...prepared.product,
    description_general: prepared.product.description_general.replace('aire acondicionado', 'climatización no acreditada') } }), false);
  assert.equal(accepts(record, { ...prepared, product: { ...prepared.product,
    description_general: prepared.product.description_general.replace('lados cortos', 'lados largos') } }), false);
  for (const [key, value] of [
    ['Longitud exterior anunciada', '7 m'],
    ['Anchura exterior anunciada', '2,45 m'],
    ['Climatización instalada según anuncio', 'No consta'],
    ['Ubicación de la puerta', 'Lado largo']
  ]) {
    assert.equal(accepts(record, { ...prepared, product: { ...prepared.product,
      spec: { ...prepared.product.spec, [key]: value } } }), false);
  }
  assert.equal(accepts(record, prepared, { ...item, value: 'Otra descripción' }), false);
});


test('conserva dos respaldos STAR-10 con plumín documentado solo a nivel de modelo', async () => {
  const result = await accredited();
  assert.equal(result.totals.states.ACREDITADO_ESPECIFICO, 635);
  assert.equal(result.totals.states.PENDIENTE_EQUIVALENCIA, 0);
  for (const subject of ['mercaeleva:M171-6370', 'mercaeleva:M144-5512']) {
    const { item, record, prepared } = await fact(subject);
    const production = await loadProduction();
    const modelReference = production.resolveUnit(record, record).modelReference;
    assert.equal(item.status, 'ACREDITADO_ESPECIFICO');
    assert.equal(item.consumption.factsPreserved, true);
    assert.equal(item.consumption.meaningReconciliation.supportedModelClaims, 1);
    assert.equal(item.consumption.meaningReconciliation.unsupportedModelClaims, 0);
    assert.match(modelReference, /3 m de alcance horizontal con plumín/u);
    assert.match(modelReference, /no acreditan la configuración ni las prestaciones de esta unidad/u);
    const check = (origin = record, output = prepared, reference = modelReference,
      archived = item.value, signed = { ...item, value: archived }) => {
      const meaning = inspectArchivedFallbackMeaning(archived, output.product.description_general, origin,
        output, production.resolveFacts(origin), reference);
      const technical = inspectArchivedFallbackTechnical(archived, output.product.description_general,
        origin, output, reference);
      return preservesArchivedFallbackUnitFacts(archived, origin, output,
        item.consumption.numericReconciliation, meaning, technical, signed, reference);
    };
    assert.equal(check(), true);
    assert.equal(check(record, prepared, null), false);
    assert.equal(check(record, prepared, modelReference.replace('con plumín', 'sin plumín')), false);
    assert.equal(check(record, prepared, production.resolveUnit({ ...record, model: 'OTRO-MODELO',
      specs: { ...record.specs, Modelo: 'OTRO-MODELO' } }).modelReference), false);
    assert.equal(check({ ...record, reference: `${record.reference}-extra` }), false);
    assert.equal(check({ ...record, url: `${record.url}?extra=1` }), false);
    const modified = (field, value) => ({ ...prepared, product: { ...prepared.product,
      [field]: value } });
    assert.equal(check(record, modified('description_general',
      prepared.product.description_general.replace('no acreditan la configuración ni las prestaciones de esta unidad',
        'son prestaciones de esta unidad'))), false);
    assert.equal(check(record, modified('description_general',
      prepared.product.description_general.replace('3 m de alcance horizontal', '4 m de alcance horizontal'))), false);
    assert.equal(check(record, modified('description_general',
      prepared.product.description_general.replace(/\d[\d.]* horas registradas/u, '999 horas registradas'))), false);
    assert.equal(check(record, modified('description_general',
      prepared.product.description_general.replace('año de fabricación 2013', 'año de fabricación 2020'))), false);
    for (const [key, value] of [['Año de fabricación', '2020'], ['Artículo No.', '999'],
      ['Altura de trabajo', '9 m'], ['Alcance horizontal', '4 m']]) {
      assert.equal(check(record, modified('spec', { ...prepared.product.spec, [key]: value })), false);
    }
    const seller = record.specs['Artículo No.'];
    assert.equal(check(record, prepared, modelReference,
      item.value.replace(new RegExp(String.raw`\b${seller}\b`, 'u'), '999')), false);
    assert.equal(check(record, prepared, modelReference, `${item.value} Esta unidad incluye un plumín opcional.`), false);
    assert.equal(check(record, prepared, modelReference, `${item.value} Batería opcional instalada.`), false);
  }
});

test('no confunde el cierre de los respaldos con la equivalencia textual ni el símbolo histórico bloqueado', async () => {
  const result = await accredited();
  assert.deepEqual(result.entries.filter((entry) => entry.status === 'PENDIENTE_EQUIVALENCIA'), []);
  assert.equal(result.entries.filter((entry) => entry.status === 'BLOQUEADO_EVIDENCIA').length, 1);
  assert.equal(result.totals.discovered, 689);
  assert.equal(result.exhaustiveSemanticEquivalence, false);
});

test('la acreditación de la caseta no habilita otras afirmaciones históricas de fabricante', async () => {
  const result = await accredited();
  assert.equal(result.totals.states.ACREDITADO_ESPECIFICO, 635);
  assert.equal(result.totals.states.PENDIENTE_EQUIVALENCIA, 0);
  const item = result.entries.find((entry) => entry.id === 'K_9ce416b29e28d194205d6395');
  assert.equal(item?.status, 'ACREDITADO_ESPECIFICO');
  for (const subject of ['mercaeleva:M095-5362', 'mercaeleva:M030-7485', 'mercaeleva:M005-4474']) {
    const entries = result.entries.filter((entry) => entry.subject === subject &&
      entry.consumption?.result === 'composed_instead_of_fallback');
    assert.equal(entries.length, 1);
    assert.equal(entries[0].status, 'ACREDITADO_ESPECIFICO');
  }
});


test('conserva las tres unidades 180ATJ y la referencia histórica de alcance sin extender prestaciones a la unidad', async () => {
  const result = await accredited();
  assert.equal(result.totals.discovered, 689);
  assert.equal(result.totals.states.ACREDITADO_ESPECIFICO, 635);
  assert.equal(result.totals.states.PENDIENTE_EQUIVALENCIA, 0);
  const production = await loadProduction();
  for (const subject of ['mercaeleva:M572-8190', 'mercaeleva:M205-2951', 'mercaeleva:M178-6194']) {
    const { item, record, prepared } = await fact(subject);
    const modelReference = production.resolveUnit(record, record).modelReference;
    assert.equal(item.status, 'ACREDITADO_ESPECIFICO');
    assert.equal(item.consumption.factsPreserved, true);
    assert.match(modelReference, /Manitou 180ATJ/u);
    assert.match(modelReference, /18,15 m/u);
    assert.match(modelReference, /10,62 m de alcance horizontal documentado por el fabricante/u);
    assert.match(modelReference, /no acreditan la configuración ni las prestaciones de esta unidad/u);
    assert.match(prepared.product.description_general, /Referencia comercial declarada por el vendedor/u);
    assert.match(prepared.product.description_general, /no acreditan la configuración ni las prestaciones de esta unidad/u);
    assert.equal(prepared.product.spec['Alcance horizontal'], '10,62 m');
    const check = (origin = record, output = prepared, reference = modelReference,
      archived = item.value, signed = { ...item, value: archived }) => {
      const meaning = inspectArchivedFallbackMeaning(archived, output.product.description_general,
        origin, output, production.resolveFacts(origin), reference);
      const technical = inspectArchivedFallbackTechnical(archived, output.product.description_general,
        origin, output, reference);
      return preservesArchivedFallbackUnitFacts(archived, origin, output,
        item.consumption.numericReconciliation, meaning, technical, signed, reference);
    };
    assert.equal(check(), true);
    assert.equal(check(record, prepared, null), false);
    assert.equal(check({ ...record, reference: `${record.reference}-otro` }), false);
    assert.equal(check({ ...record, url: `${record.url}?otro` }), false);
    assert.equal(check({ ...record, model: '200ATJ' }), false);
    assert.equal(check(record, { ...prepared, product: { ...prepared.product,
      description_general: prepared.product.description_general.replace(/\d[\d.]* horas registradas/u, '999 horas registradas') } }), false);
    assert.equal(check(record, { ...prepared, product: { ...prepared.product,
      description_general: prepared.product.description_general.replace('no acreditan la configuración ni las prestaciones de esta unidad',
        'acreditan las prestaciones de esta unidad') } }), false);
    assert.equal(check(record, { ...prepared, product: { ...prepared.product,
      description_general: prepared.product.description_general.replace('10,62 m de alcance horizontal',
        '99 m de alcance horizontal') } }), false);
    assert.equal(check(record, { ...prepared, product: { ...prepared.product,
      spec: { ...prepared.product.spec, 'Alcance horizontal': '99 m' } } }), false);
    assert.equal(check(record, prepared, modelReference.replace('10,62 m de alcance horizontal',
      '10,51 m de alcance horizontal')), false);
    assert.equal(check(record, prepared, modelReference, `${item.value} Incorpora plumín opcional.`), false);
    const seller = record.specs['Artículo No.'];
    assert.equal(check(record, prepared, modelReference,
      item.value.replace(new RegExp(String.raw`\b${seller}\b`, 'u'), '999')), false);
  }
});

test('la documentación de fabricante es compartida, pero las firmas individuales no se trasladan', async () => {
  const production = await loadProduction();
  const original = bySubject.get('mercaeleva:M572-8190');
  assert.ok(original);
  const compatible = { ...original, reference: 'M999-0000',
    url: original.url.replace('M572-8190', 'M999-0000'), year: null, horometer: null,
    longDescription: 'PLATAFORMA ARTICULADA DIESEL ALTURA DE TRABAJO 18 MT MANITOU 180ATJ',
    specs: { Marca: 'Manitou', Modelo: '180ATJ', 'Título adicional': 'PLATAFORMA ARTICULADA DIESEL 18 MT',
      'Tipo de motor': 'Diesel', 'Altura de trabajo': '18 m' } };
  const reference = production.resolveUnit(compatible, compatible);
  assert.equal(reference.fallbackGeneral, null);
  assert.match(reference.modelReference, /10,62 m de alcance horizontal/u);
  const prepared = production.prepareUnit(compatible);
  assert.match(prepared.product.description_general, /no acreditan la configuración ni las prestaciones de esta unidad/u);
  assert.doesNotMatch(prepared.product.description_general, /3018 horas|3\.018 horas|3\.355 horas|3\.233 horas|referencia comercial declarada por el vendedor: 774/u);
  assert.equal(prepared.product.spec['Alcance horizontal'], undefined);
  for (const changed of [
    { ...compatible, model: '200ATJ', specs: { ...compatible.specs, Modelo: '200ATJ' } },
    { ...compatible, specs: { ...compatible.specs, 'Altura de trabajo': '20 m' } },
    { ...compatible, specs: { ...compatible.specs, 'Tipo de motor': 'Eléctrico' } }
  ]) {
    assert.doesNotMatch(production.resolveUnit(changed, changed).modelReference ?? '',
      /10,62 m de alcance horizontal/u);
  }
});

test('acredita los dos respaldos de modelo documentados sin transferir plumín o voladizo a la unidad', async () => {
  const result = await accredited();
  assert.equal(result.totals.discovered, 689);
  assert.equal(result.totals.states.ACREDITADO_ESPECIFICO, 635);
  assert.equal(result.totals.states.PENDIENTE_EQUIVALENCIA, 0);
  assert.deepEqual(result.entries.filter((item) => item.status === 'PENDIENTE_EQUIVALENCIA')
    .map((item) => item.subject), []);
  const production = await loadProduction();
  for (const subject of ['mercaeleva:M095-5362', 'mercaeleva:M030-7485']) {
    const { item, record, prepared } = await fact(subject);
    const reference = production.resolveUnit(record, record).modelReference;
    assert.equal(item.status, 'ACREDITADO_ESPECIFICO');
    assert.equal(item.consumption.factsPreserved, true);
    assert.match(reference, /plumín/u);
    assert.match(reference, /no acreditan la configuración ni las prestaciones de esta unidad/u);
    assert.ok(item.consumption.meaningReconciliation.signals.filter((signal) =>
      signal.severity === 'pendiente_fuente_modelo').every((signal) =>
      signal.reproduced && signal.evidence === 'referencia_tecnica_compartida'));
    const verify = (origin = record, output = prepared, documented = reference, archived = item.value,
      signed = { ...item, value: archived }) => {
      const meaning = inspectArchivedFallbackMeaning(archived, output.product.description_general,
        origin, output, production.resolveFacts(origin), documented);
      const technical = inspectArchivedFallbackTechnical(archived, output.product.description_general,
        origin, output, documented);
      return preservesArchivedFallbackUnitFacts(archived, origin, output,
        item.consumption.numericReconciliation, meaning, technical, signed, documented);
    };
    assert.equal(verify(), true);
    assert.equal(verify({ ...record, reference: `${record.reference}-OTRA` }), false);
    assert.equal(verify({ ...record, url: `${record.url}?otra=1` }), false);
    assert.equal(verify({ ...record, model: `${record.model}-OTRO` }), false);
    assert.equal(verify(record, { ...prepared, product: { ...prepared.product,
      description_general: prepared.product.description_general.replace(reference, '') } }), false);
    const unsupportedClaim = subject === 'mercaeleva:M095-5362' ? 'Evita el voladizo trasero.' : 'Incluye plumín.';
    assert.equal(verify(record, { ...prepared, product: { ...prepared.product,
      description_general: `${prepared.product.description_general} ${unsupportedClaim}` } }), false);
    assert.equal(verify(record, prepared, reference.replace('plumín', 'brazo fijo')), false);
    assert.equal(verify(record, prepared, reference.replace('no acreditan la configuración ni las prestaciones de esta unidad',
      'acreditan las prestaciones de esta unidad')), false);
    assert.equal(verify(record, { ...prepared, product: { ...prepared.product,
      spec: { ...prepared.product.spec, 'Altura de trabajo': '99 m' } } }), false);
    const seller = record.specs['Artículo No.'];
    assert.equal(verify(record, prepared, reference,
      item.value.replace(new RegExp(String.raw`\b${seller}\b`, 'u'), '999')), false);
    if (subject === 'mercaeleva:M095-5362') {
      assert.match(reference, /sin voladizo trasero/u);
      assert.equal(verify(record, prepared, reference.replace('sin voladizo trasero', 'con voladizo trasero')), false);
      assert.equal(verify(record, prepared, reference.replace('3 m de alcance horizontal',
        '9 m de alcance horizontal')), false);
      assert.equal(verify(record, prepared, reference, item.value.replace('hasta 3 m', 'hasta 9 m')), false);
    } else {
      assert.match(reference, /plumín opcional/u);
      assert.equal(verify(record, prepared, reference.replace('plumín opcional', 'equipamiento confirmado')), false);
    }
  }
});

test('la referencia de JLG se reutiliza por modelo sin transferir las firmas de la unidad 2006', async () => {
  const production = await loadProduction();
  const record = bySubject.get('mercaeleva:M030-7485');
  const compatible = { ...record, reference: 'M999-7485',
    url: record.url.replace('M030-7485', 'M999-7485'), horometer: null,
    specs: { ...record.specs, 'Artículo No.': '999', 'Horas laborales': '' } };
  const original = production.resolveUnit(record, record);
  const next = production.resolveUnit(compatible, compatible);
  assert.equal(next.fallbackGeneral, null);
  assert.equal(next.short, null);
  assert.match(next.modelReference, /plumín opcional/u);
  assert.match(next.modelReference, /no acreditan la configuración ni las prestaciones de esta unidad/u);
  assert.equal(next.modelReference, original.modelReference);
  assert.ok(!production.resolveUnit({ ...compatible, model: 'OTRO-MODELO',
    specs: { ...compatible.specs, Modelo: 'OTRO-MODELO' } }).modelReference?.includes('plumín'));
});

test('la referencia LGMG conserva límites interiores y exteriores sin acreditar batería opcional de la unidad', async () => {
  const result = await accredited();
  assert.equal(result.totals.states.ACREDITADO_ESPECIFICO, 635);
  assert.equal(result.totals.states.PENDIENTE_EQUIVALENCIA, 0);
  const { item, record, prepared } = await fact('mercaeleva:M005-4474');
  const production = await loadProduction();
  const reference = production.resolveUnit(record, record).modelReference;
  assert.equal(item.status, 'ACREDITADO_ESPECIFICO');
  assert.equal(item.consumption.factsPreserved, true);
  assert.equal(item.consumption.technicalReconciliation.signals[0]?.concept, 'altura_trabajo');
  assert.match(reference, /modelo LGMG S0808EII/u);
  assert.match(reference, /9,8 m en interiores y 8 m en exteriores/u);
  assert.match(reference, /7,8 m en interiores y 6 m en exteriores/u);
  assert.match(reference, /batería de litio opcional para la gama/u);
  assert.match(reference, /no acreditan la configuración ni las prestaciones de esta unidad/u);
  assert.match(prepared.product.description_general, /El anuncio de origen declara «0 horas»/u);
  assert.equal(prepared.product.spec['Tipo de Batería'], undefined);
  const verify = (origin = record, output = prepared, documented = reference,
    archived = item.value, signed = { ...item, value: archived }) => {
    const meaning = inspectArchivedFallbackMeaning(archived, output.product.description_general,
      origin, output, production.resolveFacts(origin), documented);
    const technical = inspectArchivedFallbackTechnical(archived, output.product.description_general,
      origin, output, documented);
    return preservesArchivedFallbackUnitFacts(archived, origin, output,
      item.consumption.numericReconciliation, meaning, technical, signed, documented);
  };
  const changed = (field, value) => ({ ...prepared, product: { ...prepared.product, [field]: value } });
  assert.equal(verify(), true);
  assert.equal(verify(record, prepared, null), false);
  assert.equal(verify({ ...record, reference: 'M999-0000' }), false);
  assert.equal(verify({ ...record, url: `${record.url}?unit=another` }), false);
  assert.equal(verify({ ...record, model: 'S0812EII' }), false);
  assert.equal(verify({ ...record, year: '2025' }), false);
  assert.equal(verify({ ...record, specs: { ...record.specs, 'Artículo No.': 'OTRO' } }), false);
  assert.equal(verify({ ...record, specs: { ...record.specs, 'Tipo de motor': 'Diésel' } }), false);
  assert.equal(verify(record, changed('spec', { ...prepared.product.spec,
    'Tipo de Batería': 'Litio' })), false);
  assert.equal(verify(record, changed('spec', { ...prepared.product.spec,
    'Altura de trabajo': '11 m' })), false);
  assert.equal(verify(record, changed('description_general', `${prepared.product.description_general} Esta unidad incluye batería de litio.`)), false);
  assert.equal(verify(record, changed('description_general', prepared.product.description_general.replace(
    'altura de trabajo de 10 m', 'altura de trabajo de 11 m'))), false);
  assert.equal(verify(record, changed('description_general', prepared.product.description_general.replace(
    'no acreditan la configuración ni las prestaciones de esta unidad',
    'acreditan la configuración de esta unidad'))), false);
  assert.equal(verify(record, prepared, reference.replace('9,8 m en interiores', '99 m en interiores')), false);
  assert.equal(verify(record, prepared, reference.replace('batería de litio opcional', 'batería de litio instalada')), false);
  assert.equal(verify(record, prepared, reference.replace('modelo LGMG S0808EII', 'modelo LGMG S0812EII')), false);
  assert.equal(verify(record, prepared, reference, item.value.replace(
    'no se atribuye a la unidad una batería opcional', 'se atribuye a la unidad una batería opcional')), false);
  assert.equal(verify(record, prepared, reference, item.value.replace(
    '10 m', '11 m')), false);
  assert.equal(verify(record, prepared, reference, item.value,
    { ...item, subject: 'mercaeleva:M159-0669' }), false);
  const next = { ...record, reference: 'M999-0000', url: record.url.replace('M005-4474', 'M999-0000') };
  const selection = production.resolveUnit(next, next);
  assert.equal(selection.fallbackGeneral, null);
  assert.match(selection.modelReference, /uso previsto en interiores y exteriores/u);
  assert.match(production.prepareUnit(next).product.description_general,
    /no acreditan la configuración ni las prestaciones de esta unidad/u);
  assert.doesNotMatch(production.prepareUnit(next).product.description_general,
    /no se atribuye a la unidad una batería opcional/u);
  for (const incompatible of [
    { ...next, model: 'S0812EII', specs: { ...next.specs, Modelo: 'S0812EII' } },
    { ...next, specs: { ...next.specs, 'Altura de trabajo': '12 m' } },
    { ...next, specs: { ...next.specs, 'Tipo de motor': 'Diésel' } }
  ]) {
    assert.doesNotMatch(production.resolveUnit(incompatible, incompatible).modelReference ?? '',
      /modelo LGMG S0808EII/u);
  }
});
