import assert from 'node:assert/strict';
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import { accreditEditorialHistoryConsumption, buildEditorialHistoryInventory, inspectEditorialHistoryPreparedUnit, loadEditorialHistoryInventory } from '../editorial-history-inventory.mjs';
import { preservesArchivedFallbackUnitFacts, preservesArchivedFallbackModuleFacts } from '../editorial-history-fallback-equivalence.mjs';
import { inspectArchivedFallbackMeaning } from '../editorial-history-meaning.mjs';
import { inspectArchivedFallbackTechnical, justifiesDiscardedFallback } from '../editorial-history-technical.mjs';
import { assessEditorialHistoryPublications, loadActiveEditorialPublications } from '../editorial-history-publications.mjs';
import { inspectEditorialTextDifference } from '../editorial-history-text-differences.mjs';

const root = resolve(fileURLToPath(new URL('../../..', import.meta.url)));
const read = (path) => JSON.parse(readFileSync(join(root, path), 'utf8'));
const dir = 'data/editorial/evidence/legacy';
const collect = (path) => readdirSync(join(root, path), { withFileTypes: true }).flatMap((item) => {
  const file = `${path}/${item.name}`;
  if (item.isDirectory()) return collect(file);
  return item.isFile() && item.name.endsWith('.json') ? [file] : [];
});
const inputs = () => ({
  archives: collect(dir).sort().map((file) => ({ file, payload: read(file) })),
  indexed: read('data/editorial/knowledge/verified-units.json'),
  migration: read('data/editorial/knowledge/migration-report.json'),
  extraction: read('data/editorial/legacy-evidence-extraction.json'),
  originals: ['gam', 'gomariz', 'mercaeleva'].flatMap((provider) =>
    read(`catalogs/providers/${provider}/original/scrape-${provider}-catalog.json`).products),
  references: {
    consensus: read('data/editorial/knowledge/model-consensus.json'),
    technical: read('data/editorial/knowledge/model-technical-references.json'),
    manufacturer: read('data/editorial/knowledge/manufacturer-models.json'),
    family: read('data/editorial/knowledge/family-guidance.json')
  }
});

test('reconcilia la extracción histórica real con cada entrada indexada y descartada', () => {
  const inventory = loadEditorialHistoryInventory(root);
  const report = read('data/editorial/knowledge/migration-report.json');
  assert.equal(inventory.totals.sources, report.evidenceFiles);
  assert.equal(inventory.totals.historicalExports, report.verifiedEntries + report.skippedEntries);
  assert.equal(inventory.totals.acceptedEntries, report.verifiedEntries);
  assert.equal(inventory.totals.rejectedEntries, report.skippedEntries);
  assert.equal(inventory.totals.discovered, inventory.entries.length);
  assert.equal(new Set(inventory.entries.map((item) => item.id)).size, inventory.totals.discovered);
  assert.equal(Object.values(inventory.totals.states).reduce((sum, n) => sum + n, 0), inventory.totals.discovered);
  assert.equal(inventory.exhaustiveSemanticEquivalence, false);
  assert.ok(inventory.totals.alternativeExpressionSlots > 0);
  assert.equal(inventory.totals.alternativeExpressionSlots, inventory.alternativeExpressions.length);
  assert.equal(inventory.sourceCoverage.length, inventory.totals.sources);
  assert.ok(inventory.alternativeExpressions.every((slot) => slot.items.length > 1 &&
    slot.items.every((id) => inventory.entries.some((entry) => entry.id === id &&
      entry.subject === slot.subject && entry.field === slot.field))));
  assert.ok(inventory.entries.every((item) => item.id.startsWith('K_') && item.sources.length > 0));
});

test('no acredita por la mera existencia del archivo ni devuelve un descarte como conocimiento válido', () => {
  const inventory = loadEditorialHistoryInventory(root);
  const excluded = inventory.entries.filter((item) => item.nature === 'excluded_unit');
  const signed = inventory.entries.filter((item) => item.nature === 'signed_unit');
  assert.equal(excluded.length, inventory.totals.rejectedEntries);
  assert.ok(excluded.every((item) => item.status === 'NO_APLICABLE_JUSTIFICADO' && !item.consumer &&
    item.exclusionBasis === 'unidad_ausente_en_originales_actuales'));
  assert.ok(signed.every((item) => item.status === 'PENDIENTE_EQUIVALENCIA' && item.value &&
    item.sourceDigest && item.sourceUrl && existsSync(join(root, item.owner)) && existsSync(join(root, item.consumer))));
  for (const item of inventory.entries) {
    if (item.nature === 'unconverted_symbol') continue;
    assert.ok(item.sources.every(({ file }) => existsSync(join(root, file))));
  }
});

test('mantiene trazabilidad del símbolo antiguo no convertible sin atribuirle consumidor', () => {
  const inventory = loadEditorialHistoryInventory(root);
  const source = inventory.entries.filter((item) => item.nature === 'unconverted_symbol');
  assert.equal(source.length, 1);
  assert.equal(source[0]?.field, 'priorityPlatformManufacturerSources');
  assert.equal(source[0]?.status, 'BLOQUEADO_EVIDENCIA');
  assert.equal(source[0]?.consumer, null);
});

test('conserva referencias históricas de fabricante por exportación sin convertirlas en prestaciones', () => {
  const inventory = loadEditorialHistoryInventory(root);
  assert.deepEqual(inventory.totals.manufacturerSources, {
    archived: 22, indexed: 19, excluded: 3, distinctUrls: 17,
    priorityPlatform: 5, currentVerification: false
  });
  assert.equal(inventory.totals.discovered, 689);
  const signed = inventory.entries.filter((entry) => entry.nature === 'signed_unit');
  const sources = signed.flatMap((entry) => entry.sources.filter((source) =>
    source.archivedManufacturerSource !== null).map((source) => ({ entry, source })));
  assert.ok(sources.length >= inventory.totals.manufacturerSources.indexed);
  for (const { entry, source } of sources) {
    const archive = read(source.file);
    const archived = archive.exports[source.exportName]?.[source.key];
    assert.equal(source.archivedManufacturerSource, archived?.manufacturerSource);
    assert.equal(entry.scope, 'unit');
    assert.equal(entry.subject, `${entry.subject.split(':')[0]}:${source.key}`);
    assert.equal(new URL(source.archivedManufacturerSource).protocol, 'https:');
  }
  const discarded = inventory.entries.filter((entry) => entry.nature === 'excluded_unit' &&
    entry.sources.some((source) => source.archivedManufacturerSource !== null));
  assert.equal(discarded.length, 3);
  assert.ok(discarded.every((entry) => entry.status === 'NO_APLICABLE_JUSTIFICADO' &&
    entry.consumer === null));
  assert.equal(inventory.entries.find((entry) => entry.nature === 'unconverted_symbol')?.status,
    'BLOQUEADO_EVIDENCIA');
});

test('la referencia archivada de fabricante nunca se atribuye a otra unidad ni a una exportación distinta', () => {
  const inventory = loadEditorialHistoryInventory(root);
  const selected = inventory.entries.filter((entry) => entry.nature === 'signed_unit' &&
    entry.sources.some((source) => source.archivedManufacturerSource !== null));
  for (const entry of selected) {
    for (const source of entry.sources.filter((item) => item.archivedManufacturerSource !== null)) {
      const record = inputs().indexed.entries.find((item) => item.evidenceSource === source.file &&
        item.exportName === source.exportName && item.key === entry.subject);
      assert.ok(record);
      assert.equal(read(source.file).exports[source.exportName][source.key].manufacturerSource,
        source.archivedManufacturerSource);
    }
  }
  const archived = inventory.entries.filter((entry) => entry.nature === 'signed_unit' &&
    entry.sources.some((source) => source.file.endsWith('/priority-platform-generals.json') &&
      source.archivedManufacturerSource !== null));
  assert.equal(new Set(archived.map((entry) => entry.subject)).size, 5);
  assert.ok(archived.every((entry) => entry.status === 'PENDIENTE_EQUIVALENCIA'));
});

test('rechaza referencias históricas de fabricante inseguras o inválidas', () => {
  const rejected = ['http://fabricante.example/modelo', 'javascript:alert(1)',
    'https://usuario:secreto@fabricante.example/modelo', 'https://fabricante.example/modelo ',
    '', null];
  for (const url of rejected) {
    const input = inputs();
    const archive = input.archives.find((entry) =>
      entry.file.endsWith('/priority-platform-generals.json'));
    assert.ok(archive);
    const unit = Object.values(archive.payload.exports.verifiedPriorityPlatformGeneral)[0];
    unit.manufacturerSource = url;
    assert.throws(() => buildEditorialHistoryInventory(input), /Referencia histórica de fabricante inválida/u);
  }
});

test('mantiene identificadores y procedencias deterministas frente al orden de los índices', () => {
  const input = inputs();
  const baseline = buildEditorialHistoryInventory(input);
  input.archives.reverse();
  input.indexed.entries.reverse();
  const reordered = buildEditorialHistoryInventory(input);
  assert.deepEqual(reordered.entries, baseline.entries);
  assert.deepEqual(reordered.totals, baseline.totals);
});

test('rechaza cualquier texto firmado que no proceda de su exportación histórica', () => {
  const input = inputs();
  const entry = input.indexed.entries.find((item) => item.short);
  assert.ok(entry);
  entry.short = 'Afirmación sin evidencia original';
  assert.throws(() => buildEditorialHistoryInventory(input), /Afirmación firmada sin correspondencia histórica/u);
});

test('rechaza la desaparición de una entrada histórica y de un descarte registrado', () => {
  const input = inputs();
  input.indexed.entries.pop();
  assert.throws(() => buildEditorialHistoryInventory(input), /Las entradas aceptadas no coinciden/u);
  const input2 = inputs();
  input2.migration.skipped.pop();
  assert.throws(() => buildEditorialHistoryInventory(input2), /Los descartes no coinciden/u);
});

test('rechaza exportaciones históricas y fuentes sin correspondencia', () => {
  const input = inputs();
  input.extraction.sources[0].converted.push('exportacionInexistente');
  assert.throws(() => buildEditorialHistoryInventory(input), /Exportación convertida sin archivo/u);
  const input2 = inputs();
  input2.archives.pop();
  assert.throws(() => buildEditorialHistoryInventory(input2), /Número de fuentes históricas inconsistente/u);
});

test('reconcilia todas las firmas por campo y precedencia sin proclamar equivalencia editorial', () => {
  const inventory = loadEditorialHistoryInventory(root);
  const signed = inventory.entries.filter((item) => item.nature === 'signed_unit');
  const byId = new Map(signed.map((item) => [item.id, item]));
  const origins = signed.flatMap((item) => item.sources.map((source) => ({ item, source })));
  const precedence = inventory.totals.precedence;
  assert.equal(precedence.selected + precedence.equivalent + precedence.displaced, origins.length);
  assert.equal(origins.length, 677);
  assert.equal(precedence.selected, 638);
  assert.equal(precedence.equivalent, 0);
  assert.equal(precedence.displaced, 39);
  assert.ok(signed.every((item) => item.status === 'PENDIENTE_EQUIVALENCIA'));
  for (const { item, source } of origins) {
    assert.ok(['selected', 'equivalent', 'displaced'].includes(source.selection));
    assert.equal(source.role, item.field === 'general' && source.usage === 'fallback' ? 'fallbackGeneral' : item.field);
    if (source.selection === 'displaced') {
      const winner = byId.get(source.selectedInstead);
      assert.ok(winner, `${item.subject}/${source.role}`);
      assert.equal(winner.subject, item.subject);
      assert.equal(winner.field, item.field);
      assert.notEqual(winner.value, item.value);
      assert.ok(winner.sources.some((origin) => origin.role === source.role && origin.selection === 'selected'));
    } else {
      assert.equal(source.selectedInstead, null);
    }
  }
  assert.equal(inventory.totals.alternativeExpressionSlots, 41);
  const independent = inventory.alternativeExpressions.filter((slot) =>
    !signed.some((item) => item.subject === slot.subject && item.field === slot.field &&
      item.sources.some((source) => source.selection === 'displaced')));
  assert.equal(independent.length, 2);
  assert.ok(independent.every((slot) => new Set(slot.items.flatMap((id) =>
    byId.get(id).sources.map((source) => source.role))).size === 2));
});

test('una firma desplazada puede cambiar de precedencia sin alterar su identidad histórica ni sus fuentes', () => {
  const input = inputs();
  const before = buildEditorialHistoryInventory(input);
  const displaced = before.entries.find((item) => item.nature === 'signed_unit' &&
    item.sources.some((source) => source.selection === 'displaced' && source.role === 'short'));
  assert.ok(displaced);
  const origin = displaced.sources.find((source) => source.selection === 'displaced');
  const indexed = input.indexed.entries.find((entry) => entry.key === displaced.subject &&
    entry.evidenceSource === origin.file && entry.exportName === origin.exportName);
  assert.ok(indexed);
  indexed.priority = 1000;
  const after = buildEditorialHistoryInventory(input);
  const same = after.entries.find((item) => item.id === displaced.id);
  assert.ok(same);
  assert.equal(same.sources.find((source) => source.file === origin.file).selection, 'selected');
  assert.equal(same.status, 'PENDIENTE_EQUIVALENCIA');
  assert.equal(after.totals.discovered, before.totals.discovered);
  assert.deepEqual(after.entries.map((item) => item.id), before.entries.map((item) => item.id));
});

test('clasifica los 11 descartes de 8 unidades según el censo original, sin reincorporar evidencia', () => {
  const input = inputs();
  const baseline = buildEditorialHistoryInventory(input);
  const excluded = baseline.entries.filter((item) => item.nature === 'excluded_unit');
  assert.equal(excluded.length, 11);
  assert.equal(new Set(excluded.map((item) => item.subject)).size, 8);
  assert.equal(baseline.totals.excludedAbsentFromOriginals, 11);
  assert.equal(baseline.totals.states.NO_APLICABLE_JUSTIFICADO, 11);
  assert.equal(baseline.totals.states.BLOQUEADO_EVIDENCIA, 1);
  const discarded = excluded.find((item) => item.subject.startsWith('gomariz:'));
  assert.ok(discarded);
  const candidate = input.originals.find((record) => record.providerId === 'gomariz' &&
    !input.indexed.entries.some((entry) => entry.key === `gomariz:${record.reference}`));
  assert.ok(candidate);
  candidate.reference = discarded.subject.slice('gomariz:'.length);
  const observed = buildEditorialHistoryInventory(input);
  assert.ok(observed.entries.filter((item) => item.nature === 'excluded_unit' &&
    item.subject === discarded.subject).every((item) => item.status === 'BLOQUEADO_EVIDENCIA' &&
    item.exclusionBasis === 'unidad_actual_sin_procedencia_firmada'));
  assert.equal(observed.totals.excludedAbsentFromOriginals,
    11 - excluded.filter((item) => item.subject === discarded.subject).length);
  assert.equal(observed.totals.acceptedEntries, baseline.totals.acceptedEntries);
});

test('detecta desalineación de identidad, duplicados y recuento del censo original', () => {
  const removed = inputs();
  removed.originals.pop();
  assert.throws(() => buildEditorialHistoryInventory(removed), /Censo de originales inconsistente/u);
  const duplicates = inputs();
  duplicates.originals[1] = { ...duplicates.originals[0] };
  assert.throws(() => buildEditorialHistoryInventory(duplicates), /Identidad original repetida/u);
  const identity = inputs();
  const entry = identity.indexed.entries.find((item) => item.key === 'gam:6689');
  assert.ok(entry);
  const original = identity.originals.find((item) => `${item.providerId}:${item.reference}` === entry.key);
  assert.ok(original);
  original.url += '?procedencia=distinta';
  assert.throws(() => buildEditorialHistoryInventory(identity), /Firma sin identidad en originales actuales/u);
});

const fallbackStatus = (item) => item.consumption.discardedWithEvidence ?
  'NO_APLICABLE_JUSTIFICADO' : item.consumption.factsPreserved ?
    'ACREDITADO_ESPECIFICO' : 'PENDIENTE_EQUIVALENCIA';
const originals = () => inputs().originals;
const loadProduction = async () => {
  const [{ editorialSourceDigest }, { resolveKnowledgeEditorial }, { prepareSourceProduct }, { resolveEditorialFacts }] = await Promise.all([
    import('../../../dist/infrastructure/filesystem/editorial/knowledge.js'),
    import('../../../dist/preparation/shared/editorial/mapping/knowledge-editorial.js'),
    import('../../../dist/preparation/prepare-product.js'),
    import('../../../dist/preparation/shared/editorial/domain/editorial-facts.js')
  ]);
  return { digestUnit: editorialSourceDigest, resolveUnit: resolveKnowledgeEditorial,
    prepareUnit: prepareSourceProduct, resolveFacts: resolveEditorialFacts };
};

let accreditedCache;
const accredited = async () => {
  if (!accreditedCache) accreditedCache = accreditEditorialHistoryConsumption(
    loadEditorialHistoryInventory(root), originals(), await loadProduction());
  return accreditedCache;
};

test('acredita únicamente firmas consumidas por el motor compartido y presentes en la ficha final', async () => {
  const inventory = loadEditorialHistoryInventory(root);
  const result = await accredited();
  assert.equal(result.totals.discovered, inventory.totals.discovered);
  assert.deepEqual(result.entries.map((item) => item.id), inventory.entries.map((item) => item.id));
  assert.deepEqual(result.totals.runtime.catalog, { originals: 1751, ready: 1684, review: 67 });
  assert.deepEqual(result.totals.runtime.catalogDetails, {
    gam: { originals: 983, ready: 940, review: 43, issues: 86,
      reviewWithoutShort: 2, reviewWithoutGeneral: 1 },
    gomariz: { originals: 547, ready: 527, review: 20, issues: 24,
      reviewWithoutShort: 8, reviewWithoutGeneral: 0 },
    mercaeleva: { originals: 221, ready: 217, review: 4, issues: 4,
      reviewWithoutShort: 0, reviewWithoutGeneral: 1 }
  });
  assert.equal(result.totals.runtime.signedSubjects, 428);
  assert.equal(result.totals.runtime.verifiedSelections, 638);
  assert.equal(result.totals.runtime.finalExact, 598);
  assert.equal(result.totals.runtime.finalUnitNormalized, 5);
  assert.equal(result.totals.runtime.composedInsteadOfFallback, 35);
  assert.equal(result.totals.runtime.displacedBySignedPriority, 39);
  assert.equal(result.totals.runtime.supersededWithVerifiedWinner, 39);
  assert.equal(result.totals.runtime.supersededPending, 0);
  assert.equal(result.totals.runtime.fallbackWithUnmatchedNumericMarkers, 15);
  assert.equal(result.totals.runtime.unresolved, 0);
  assert.deepEqual(result.totals.states, {
    ACREDITADO_COMPARTIDO: 0,
    ACREDITADO_ESPECIFICO: 635,
    PENDIENTE_TRASLADO: 0,
    PENDIENTE_EQUIVALENCIA: 0,
    BLOQUEADO_EVIDENCIA: 1,
    NO_APLICABLE_JUSTIFICADO: 53
  });
  assert.ok(result.entries.filter((item) => item.status === 'ACREDITADO_ESPECIFICO')
    .every((item) => item.nature === 'signed_unit' &&
      (['final_exact', 'final_unit_normalized'].includes(item.consumption.result) ||
        (item.consumption.result === 'composed_instead_of_fallback' && item.consumption.factsPreserved))));
  assert.equal(inventory.totals.states.ACREDITADO_ESPECIFICO, 0);
});

test('las firmas de unidades quedan acreditadas como específicas y no como reglas reutilizables', async () => {
  const inventory = await accredited();
  const signed = inventory.entries.filter((item) => item.nature === 'signed_unit');
  const accreditedItems = signed.filter((item) => item.status === 'ACREDITADO_ESPECIFICO');
  assert.equal(accreditedItems.length, 635);
  assert.equal(inventory.totals.states.ACREDITADO_COMPARTIDO, 0);
  assert.ok(accreditedItems.every((item) => item.scope === 'unit' &&
    item.sourceDigest && item.sourceUrl && item.subject.includes(':') &&
    item.owner && item.consumer && item.sources.some((source) => source.selection === 'selected') &&
    (['final_exact', 'final_unit_normalized'].includes(item.consumption.result) ||
        (item.consumption.result === 'composed_instead_of_fallback' && item.consumption.factsPreserved))));
  assert.equal(signed.length, inventory.totals.signedKnowledge);
  assert.ok(signed.every((item) => item.status !== 'ACREDITADO_COMPARTIDO'));
  assert.equal(inventory.entries.filter((item) => item.nature === 'unconverted_symbol' &&
    item.status === 'BLOQUEADO_EVIDENCIA').length, 1);
});

test('una firma sin alcance de unidad no obtiene acreditación específica', async () => {
  const history = loadEditorialHistoryInventory(root);
  const entry = history.entries.find((item) => item.nature === 'signed_unit');
  assert.ok(entry);
  entry.scope = 'model';
  const production = await loadProduction();
  assert.throws(() => accreditEditorialHistoryConsumption(history, originals(), production),
    /Firma sin alcance específico de unidad/u);
});

test('justifica las alternativas desplazadas por la prioridad publicada sin acreditar su publicación literal', async () => {
  const inventory = await accredited();
  const displaced = inventory.entries.filter((item) => item.consumption?.result === 'displaced_by_signed_priority');
  const fallback = inventory.entries.filter((item) => item.consumption?.result === 'composed_instead_of_fallback');
  assert.equal(displaced.length, 39);
  assert.equal(fallback.length, 35);
  const byId = new Map(inventory.entries.map((item) => [item.id, item]));
  assert.ok(displaced.every((item) => item.status === 'NO_APLICABLE_JUSTIFICADO' &&
    item.consumption.verifiedPublishedReplacement === true &&
    item.consumption.unmatchedNumericMarkers.length === 0 &&
    item.sources.every((source) => source.selection === 'displaced' && source.selectedInstead) &&
    byId.get(item.consumption.replacedBy)?.status === 'ACREDITADO_ESPECIFICO'));
  assert.ok(fallback.every((item) => item.status === fallbackStatus(item) &&
    item.sources.some((source) => source.role === 'fallbackGeneral' && source.selection === 'selected')));
  assert.equal(fallback.filter((item) => item.consumption.unmatchedNumericMarkers.length > 0).length, 15);
  assert.equal(inventory.entries.filter((item) => item.consumption?.result === 'unresolved').length, 0);
});

test('si una alternativa conserva una cifra que su sustituta no contiene, no se justifica su descarte', async () => {
  const inventory = loadEditorialHistoryInventory(root);
  const original = inventory.entries.find((item) => item.nature === 'signed_unit' &&
    item.consumption === undefined && item.sources.every((source) => source.selection === 'displaced'));
  assert.ok(original);
  original.value = `${original.value} 987654321`;
  const result = accreditEditorialHistoryConsumption(inventory, originals(), await loadProduction());
  const item = result.entries.find((entry) => entry.id === original.id);
  assert.equal(item?.status, 'PENDIENTE_EQUIVALENCIA');
  assert.equal(item?.consumption.verifiedPublishedReplacement, false);
  assert.deepEqual(item?.consumption.unmatchedNumericMarkers, ['987654321']);
  assert.equal(result.totals.runtime.supersededWithVerifiedWinner, 38);
  assert.equal(result.totals.runtime.supersededPending, 1);
});

test('si deja de publicarse el texto ganador, su alternativa tampoco se da por descartada', async () => {
  const inventory = loadEditorialHistoryInventory(root);
  const loser = inventory.entries.find((item) => item.nature === 'signed_unit' &&
    item.sources.every((source) => source.selection === 'displaced') &&
    item.sources.some((source) => source.role === 'short'));
  assert.ok(loser);
  const winner = inventory.entries.find((item) => item.id === loser.sources[0].selectedInstead);
  assert.ok(winner);
  const production = await loadProduction();
  const result = accreditEditorialHistoryConsumption(inventory, originals(), {
    ...production,
    prepareUnit: (record) => {
      const prepared = production.prepareUnit(record);
      return `${record.providerId}:${record.reference}` === winner.subject ?
        { ...prepared, product: { ...prepared.product, description: 'Texto de prueba distinto' } } : prepared;
    }
  });
  const affected = result.entries.find((item) => item.id === loser.id);
  assert.equal(affected?.status, 'PENDIENTE_EQUIVALENCIA');
  assert.equal(affected?.consumption.verifiedPublishedReplacement, false);
  assert.equal(result.entries.find((item) => item.id === winner.id)?.consumption.result, 'unresolved');
  assert.equal(result.totals.runtime.unresolved, 1);
});

test('no convierte la conservación de marcadores numéricos de respaldos en una equivalencia semántica', async () => {
  const result = await accredited();
  const fallback = result.entries.filter((item) => item.consumption?.result === 'composed_instead_of_fallback');
  assert.equal(fallback.length, 35);
  assert.equal(fallback.filter((item) => item.consumption.unmatchedNumericMarkers.length === 0).length, 20);
  assert.ok(fallback.every((item) => item.status === fallbackStatus(item)));
  const contradictory = fallback.filter((item) => item.consumption.unmatchedNumericMarkers.includes('14,30'));
  assert.equal(contradictory.length, 3);
  assert.ok(contradictory.every((item) => item.subject.startsWith('gomariz:')));
});

test('las cinco conversiones KG a kg mantienen texto y magnitud original sin atribuirlas a otras unidades', async () => {
  const original = originals();
  const production = await loadProduction();
  const inventory = await accredited();
  const affected = inventory.entries.filter((item) => item.consumption?.result === 'final_unit_normalized');
  assert.equal(affected.length, 5);
  assert.ok(affected.every((item) => item.field === 'general' && item.subject.startsWith('gam:') &&
    item.status === 'ACREDITADO_ESPECIFICO' && item.value.includes('KG')));
  for (const item of affected) {
    const record = original.find((entry) => `${entry.providerId}:${entry.reference}` === item.subject);
    assert.ok(record);
    const output = production.prepareUnit(record).product.description_general;
    assert.equal(output.replace(/\s+/gu, ' ').trim(), item.value.replace(/(\d) KG\b/gu, '$1 kg'));
    assert.ok(!output.includes(' KG'));
  }
});

test('las firmas de 428 unidades no se transfieren al cambiar identidad, procedencia ni evidencia técnica', async () => {
  const input = originals();
  const production = await loadProduction();
  const byKey = new Map(input.map((record) => [`${record.providerId}:${record.reference}`, record]));
  const inventory = loadEditorialHistoryInventory(root);
  const subjects = new Set(inventory.entries.filter((item) => item.nature === 'signed_unit').map((item) => item.subject));
  assert.equal(subjects.size, 428);
  const empty = { short: null, general: null, fallbackGeneral: null, title: null };
  for (const subject of subjects) {
    const original = byKey.get(subject);
    assert.ok(original);
    for (const changed of [
      { ...original, providerId: `${original.providerId}-otro` },
      { ...original, reference: `${original.reference}-otra` },
      { ...original, url: `${original.url}?unidad=otra` },
      { ...original, model: `${original.model}-VARIANTE` },
      { ...original, specs: { ...original.specs, 'Medida incompatible': 'sin acreditar' } }
    ]) {
      const resolved = production.resolveUnit(changed, changed);
      assert.deepEqual({ short: resolved.short, general: resolved.general,
        fallbackGeneral: resolved.fallbackGeneral, title: resolved.title }, empty, subject);
    }
    const compatible = { ...original, reference: `${original.reference}-NUEVA`,
      url: `${original.url}?unidad=nueva` };
    const result = production.resolveUnit(compatible, compatible);
    assert.deepEqual({ short: result.short, general: result.general,
      fallbackGeneral: result.fallbackGeneral, title: result.title }, empty, subject);
  }
});

test('rechaza una huella alterada aunque permanezcan los mismos archivos y textos históricos', async () => {
  const data = originals();
  const selected = data.find((entry) => entry.providerId === 'gam' && entry.reference === '6689');
  assert.ok(selected);
  selected.title = `${selected.title} cambiado`;
  const production = await loadProduction();
  assert.throws(() => accreditEditorialHistoryConsumption(loadEditorialHistoryInventory(root), data, production),
    /Firma sin huella productiva válida/u);
});

test('una deriva productiva no acredita la firma aunque se mantenga íntegra en el índice', async () => {
  const input = originals();
  const inventory = loadEditorialHistoryInventory(root);
  const production = await loadProduction();
  const target = inventory.entries.find((item) => item.nature === 'signed_unit' &&
    item.subject === 'gam:6689' && item.field === 'short' &&
    item.sources.some((source) => source.selection === 'selected'));
  assert.ok(target);
  const altered = accreditEditorialHistoryConsumption(inventory, input, {
    ...production,
    prepareUnit: (record) => {
      const result = production.prepareUnit(record);
      return `${record.providerId}:${record.reference}` === target.subject ?
        { ...result, product: { ...result.product, description: `${result.product.description} cambiado` } } : result;
    }
  });
  const affected = altered.entries.find((item) => item.id === target.id);
  assert.equal(affected?.status, 'PENDIENTE_EQUIVALENCIA');
  assert.equal(affected?.consumption.result, 'unresolved');
  assert.equal(altered.totals.runtime.unresolved, 1);
  assert.equal(altered.totals.states.ACREDITADO_ESPECIFICO, 634);
});

test('una selección productiva inconsistente detiene la acreditación antes de clasificar diferencias', async () => {
  const production = await loadProduction();
  const input = originals();
  assert.throws(() => accreditEditorialHistoryConsumption(loadEditorialHistoryInventory(root), input, {
    ...production,
    resolveUnit: (record, source) => {
      const output = production.resolveUnit(record, source);
      return record.providerId === 'gam' && record.reference === '6689' ?
        { ...output, short: null } : output;
    }
  }), /Selección productiva distinta de la precedencia firmada/u);
});

test('excluye solo respaldos con contradicción acreditada sin perder hechos válidos de unidad', async () => {
  const result = await accredited();
  const fallback = result.entries.filter((item) => item.consumption?.result === 'composed_instead_of_fallback');
  const excluded = fallback.filter((item) => item.consumption.discardedWithEvidence);
  assert.deepEqual(excluded.map((item) => item.subject).sort(),
    ['gomariz:TE1621', 'gomariz:TE1622', 'gomariz:TE1858']);
  assert.equal(result.totals.runtime.fallbackDiscardedWithEvidence, 3);
  assert.equal(result.totals.states.PENDIENTE_EQUIVALENCIA, 0);
  assert.equal(result.totals.states.NO_APLICABLE_JUSTIFICADO, 53);
  for (const item of excluded) {
    const { numericReconciliation, meaningReconciliation, technicalReconciliation } = item.consumption;
    assert.equal(item.status, 'NO_APLICABLE_JUSTIFICADO');
    assert.equal(justifiesDiscardedFallback(numericReconciliation, meaningReconciliation,
      technicalReconciliation), true);
    assert.equal(justifiesDiscardedFallback(numericReconciliation, meaningReconciliation,
      { ...technicalReconciliation, signals: technicalReconciliation.signals.map((signal) =>
        signal.result === 'publicado_con_mismo_concepto' ? { ...signal, result: 'perdido_del_producto' } : signal) }), false);
    assert.equal(justifiesDiscardedFallback(numericReconciliation, meaningReconciliation,
      { ...technicalReconciliation, excluded: 0 }), false);
    assert.equal(justifiesDiscardedFallback(numericReconciliation,
      { ...meaningReconciliation, unreproduced: 1 }, technicalReconciliation), false);
    assert.equal(justifiesDiscardedFallback({ ...numericReconciliation, missing: [] },
      meaningReconciliation, technicalReconciliation), false);
  }
  assert.equal(fallback.filter((item) => item.status === 'PENDIENTE_EQUIVALENCIA').length, 0);
  assert.ok(fallback.every((item) => item.status === fallbackStatus(item)));
});

test('la exclusión vuelve a pendiente si desaparece una prestación histórica válida', async () => {
  const production = await loadProduction();
  const history = accreditEditorialHistoryConsumption(loadEditorialHistoryInventory(root), originals(), {
    ...production,
    prepareUnit: (record) => {
      const prepared = production.prepareUnit(record);
      if (record.providerId !== 'gomariz' || record.reference !== 'TE1858') return prepared;
      const spec = { ...prepared.product.spec };
      delete spec.Capacidad;
      return { ...prepared, product: { ...prepared.product,
        spec, description_general: prepared.product.description_general.replace('capacidad de 230 kg, ', '') } };
    }
  });
  const affected = history.entries.find((item) => item.subject === 'gomariz:TE1858' &&
    item.consumption?.result === 'composed_instead_of_fallback');
  assert.equal(affected?.status, 'PENDIENTE_EQUIVALENCIA');
  assert.equal(affected.consumption.discardedWithEvidence, false);
  assert.equal(affected.consumption.technicalReconciliation.blocking, 1);
  assert.equal(history.totals.runtime.fallbackDiscardedWithEvidence, 2);
  assert.equal(history.totals.states.PENDIENTE_EQUIVALENCIA, 1);
});

test('clasifica los 35 respaldos con evidencia numérica sin elevar una diferencia de formato a equivalencia editorial', async () => {
  const result = await accredited();
  assert.deepEqual(result.totals.runtime.fallbackNumeric, {
    sin_diferencias_numericas: 20,
    solo_formato_numerico: 5,
    referencia_conservada_en_producto: 4,
    magnitud_en_spec_no_publicada_en_general: 3,
    altura_de_plataforma_contradictoria_excluida: 3,
    sin_conciliacion: 0
  });
  const fallback = result.entries.filter((item) => item.consumption?.result === 'composed_instead_of_fallback');
  assert.equal(fallback.length, 35);
  assert.ok(fallback.every((item) => item.status === fallbackStatus(item) &&
    item.consumption.numericReconciliation &&
    Array.isArray(item.consumption.numericReconciliation.rawUnmatched)));
  for (const item of fallback) {
    const { category, rawUnmatched, formatting, missing, evidence } = item.consumption.numericReconciliation;
    assert.deepEqual(rawUnmatched, item.consumption.unmatchedNumericMarkers);
    assert.equal(formatting.length + missing.length, rawUnmatched.length);
    assert.equal(evidence.length, missing.length);
    if (category === 'sin_diferencias_numericas') assert.equal(rawUnmatched.length, 0);
    if (category === 'solo_formato_numerico') {
      assert.ok(formatting.length > 0);
      assert.deepEqual(missing, []);
    }
  }
  assert.equal(result.totals.states.PENDIENTE_EQUIVALENCIA, 0);
  assert.equal(result.exhaustiveSemanticEquivalence, false);
});

test('las referencias de unidad, las tres alturas de carretilla y las tres contradicciones tienen destinos diferenciados', async () => {
  const production = await loadProduction();
  const sources = originals();
  const result = await accredited();
  const fallback = result.entries.filter((item) => item.consumption?.result === 'composed_instead_of_fallback');
  const refs = fallback.filter((item) => item.consumption.numericReconciliation.category ===
    'referencia_conservada_en_producto');
  const carretillas = fallback.filter((item) => item.consumption.numericReconciliation.category ===
    'magnitud_en_spec_no_publicada_en_general');
  const contrasts = fallback.filter((item) => item.consumption.numericReconciliation.category ===
    'altura_de_plataforma_contradictoria_excluida');
  assert.deepEqual(refs.map((item) => item.subject).sort(),
    ['gomariz:BA1522', 'gomariz:BA1575', 'gomariz:MT1661', 'gomariz:TE1814']);
  assert.deepEqual(carretillas.map((item) => item.subject).sort(),
    ['gomariz:CA1041', 'gomariz:CA1436', 'gomariz:CAE1525']);
  assert.deepEqual(contrasts.map((item) => item.subject).sort(),
    ['gomariz:TE1621', 'gomariz:TE1622', 'gomariz:TE1858']);
  for (const item of refs) {
    const original = sources.find((source) => `${source.providerId}:${source.reference}` === item.subject);
    assert.equal(production.prepareUnit(original).product.reference, original.reference);
  }
  for (const item of carretillas) {
    const original = sources.find((source) => `${source.providerId}:${source.reference}` === item.subject);
    const facts = production.resolveFacts(original);
    assert.equal(facts?.family, 'carretilla-elevadora');
    assert.equal(facts.workingHeightM, null);
    assert.equal(facts.liftingHeightM, null);
    assert.equal(production.prepareUnit(original).product.spec['Altura de trabajo'], original.specs['Altura de trabajo']);
  }
  for (const item of contrasts) {
    const original = sources.find((source) => `${source.providerId}:${source.reference}` === item.subject);
    const prepared = production.prepareUnit(original).product;
    assert.equal(original.specs['Altura plataforma'], '14.30 m');
    assert.equal(prepared.spec['Altura plataforma'], '4,3 m');
    assert.doesNotMatch(prepared.description_general, /14[.,]30|14[.,]3\s*m/iu);
  }
});

test('una altura contradictoria vuelve a bloquear la auditoría aunque se publique con formato diferente', async () => {
  const production = await loadProduction();
  const originalsInput = originals();
  assert.throws(() => accreditEditorialHistoryConsumption(loadEditorialHistoryInventory(root), originalsInput, {
    ...production,
    prepareUnit: (record) => {
      const result = production.prepareUnit(record);
      return record.providerId === 'gomariz' && record.reference === 'TE1621' ?
        { ...result, product: { ...result.product,
          description_general: `${result.product.description_general} Altura de plataforma 14,3 m.` } } : result;
    }
  }), /Altura de plataforma contradictoria reintroducida: gomariz:TE1621/u);
});

test('la pérdida de una magnitud técnica que antes se publicaba nunca se atribuye a una omisión justificada', async () => {
  const production = await loadProduction();
  const result = accreditEditorialHistoryConsumption(loadEditorialHistoryInventory(root), originals(), {
    ...production,
    prepareUnit: (record) => {
      const prepared = production.prepareUnit(record);
      return record.providerId === 'gomariz' && record.reference === 'BA1358' ?
        { ...prepared, product: { ...prepared.product,
          description_general: prepared.product.description_general.replace('altura de trabajo de 12,33 m', 'altura no determinada') } } : prepared;
    }
  });
  const target = result.entries.find((item) => item.subject === 'gomariz:BA1358' &&
    item.consumption?.result === 'composed_instead_of_fallback');
  assert.equal(target?.status, 'PENDIENTE_EQUIVALENCIA');
  assert.equal(target?.consumption.numericReconciliation.category, 'sin_conciliacion');
  assert.deepEqual(target?.consumption.numericReconciliation.missing, ['12,33']);
  assert.equal(result.totals.runtime.fallbackNumeric.sin_conciliacion, 1);
});

test('si desaparece el valor estructurado, una altura omitida no queda justificada por conservar el origen', async () => {
  const production = await loadProduction();
  const result = accreditEditorialHistoryConsumption(loadEditorialHistoryInventory(root), originals(), {
    ...production,
    prepareUnit: (record) => {
      const prepared = production.prepareUnit(record);
      return record.providerId === 'gomariz' && record.reference === 'CA1041' ?
        { ...prepared, product: { ...prepared.product,
          spec: { ...prepared.product.spec, 'Altura de trabajo': null } } } : prepared;
    }
  });
  const target = result.entries.find((item) => item.subject === 'gomariz:CA1041' &&
    item.consumption?.result === 'composed_instead_of_fallback');
  assert.equal(target?.consumption.numericReconciliation.category, 'sin_conciliacion');
  assert.deepEqual(target?.consumption.numericReconciliation.missing, ['3,50']);
  assert.equal(target.status, 'PENDIENTE_EQUIVALENCIA');
});

test('contrasta afirmaciones y cautelas semánticas de los 35 respaldos sin acreditar su equivalencia completa', async () => {
  const result = await accredited();
  const meaning = result.totals.runtime.fallbackMeaning;
  assert.equal(meaning.reproduced, 53);
  assert.equal(meaning.unreproduced, 0);
  assert.equal(meaning.blocking, 0);
  assert.equal(meaning.supportedModelClaims, 5);
  assert.equal(meaning.unsupportedModelClaims, 0);
  assert.equal(meaning.unverifiedModelPublications, 0);
  assert.deepEqual(meaning.signals, {
    ano_de_unidad: { reproduced: 28, unreproduced: 0 },
    horas_de_unidad: { reproduced: 11, unreproduced: 0 },
    motorizacion_no_individualizada: { reproduced: 4, unreproduced: 0 },
    certificacion_ce_no_verificada: { reproduced: 1, unreproduced: 0 },
    horas_sin_horometro: { reproduced: 1, unreproduced: 0 },
    pintura_no_equivale_a_revision: { reproduced: 1, unreproduced: 0 },
    variante_no_acreditada: { reproduced: 1, unreproduced: 0 },
    bateria_opcional_no_atribuida: { reproduced: 1, unreproduced: 0 },
    plumin_del_texto_historico: { reproduced: 4, unreproduced: 0 },
    ausencia_voladizo_trasero_de_modelo: { reproduced: 1, unreproduced: 0 }
  });
  const fallback = result.entries.filter((item) => item.consumption?.result === 'composed_instead_of_fallback');
  assert.equal(fallback.length, 35);
  assert.ok(fallback.every((item) => item.status === fallbackStatus(item) &&
    item.consumption.meaningReconciliation.signals.every((signal) =>
      ['bloqueante', 'pendiente_fuente_modelo'].includes(signal.severity))));
  assert.deepEqual(fallback.filter((item) => item.consumption.meaningReconciliation.unreproduced > 0)
    .map((item) => item.subject).sort(), []);
  assert.equal(result.totals.states.ACREDITADO_ESPECIFICO, 635);
  assert.equal(result.totals.states.PENDIENTE_EQUIVALENCIA, 0);
  assert.equal(result.exhaustiveSemanticEquivalence, false);
});

test('detecta desviaciones de año y horómetro de la unidad aunque sobrevivan otras cifras', async () => {
  const production = await loadProduction();
  const data = originals();
  const changes = new Map([
    ['gomariz:BA1358', (general) => general.replace('año de fabricación 2012', 'año de fabricación 2020')],
    ['mercaeleva:M178-6194', (general) => general.replace('3.233 horas registradas', 'horas sin determinar')]
  ]);
  const result = accreditEditorialHistoryConsumption(loadEditorialHistoryInventory(root), data, {
    ...production,
    prepareUnit: (record) => {
      const prepared = production.prepareUnit(record);
      const change = changes.get(`${record.providerId}:${record.reference}`);
      return change ? { ...prepared, product: { ...prepared.product,
        description_general: change(prepared.product.description_general) } } : prepared;
    }
  });
  assert.equal(result.totals.runtime.fallbackMeaning.blocking, 2);
  const missing = result.entries.filter((item) => item.consumption?.meaningReconciliation?.blocking > 0);
  assert.deepEqual(missing.map((item) => item.subject).sort(), [...changes.keys()].sort());
  assert.deepEqual(missing.flatMap((item) => item.consumption.meaningReconciliation.signals.filter((signal) =>
    !signal.reproduced).map((signal) => signal.name)).sort(), ['ano_de_unidad', 'horas_de_unidad']);
  assert.ok(missing.every((item) => item.status === 'PENDIENTE_EQUIVALENCIA'));
});

test('no atribuye motorización individual donde el respaldo declara que no consta', async () => {
  const production = await loadProduction();
  const result = accreditEditorialHistoryConsumption(loadEditorialHistoryInventory(root), originals(), {
    ...production,
    prepareUnit: (record) => {
      const prepared = production.prepareUnit(record);
      return record.providerId === 'gomariz' && record.reference === 'BA1358' ?
        { ...prepared, product: { ...prepared.product, title: `${prepared.product.title} diésel` } } : prepared;
    }
  });
  const item = result.entries.find((entry) => entry.subject === 'gomariz:BA1358' &&
    entry.consumption?.result === 'composed_instead_of_fallback');
  assert.equal(item?.consumption.meaningReconciliation.blocking, 1);
  assert.equal(item?.consumption.meaningReconciliation.signals.find((signal) =>
    signal.name === 'motorizacion_no_individualizada')?.reproduced, false);
  assert.equal(item.status, 'PENDIENTE_EQUIVALENCIA');
});

test('la declaración CE vuelve a ser sospechosa si desaparece la advertencia de falta de verificación', async () => {
  const production = await loadProduction();
  const result = accreditEditorialHistoryConsumption(loadEditorialHistoryInventory(root), originals(), {
    ...production,
    prepareUnit: (record) => {
      const prepared = production.prepareUnit(record);
      return record.providerId === 'mercaeleva' && record.reference === 'M318-0509' ?
        { ...prepared, product: { ...prepared.product,
          description_general: prepared.product.description_general.replace('no se ha verificado documentalmente',
            'se ha verificado documentalmente') } } : prepared;
    }
  });
  const item = result.entries.find((entry) => entry.subject === 'mercaeleva:M318-0509' &&
    entry.consumption?.result === 'composed_instead_of_fallback');
  assert.equal(item?.consumption.meaningReconciliation.blocking, 1);
  assert.equal(item?.consumption.meaningReconciliation.signals.find((signal) =>
    signal.name === 'certificacion_ce_no_verificada')?.reproduced, false);
});

test('detecta atribuciones indebidas de batería opcional y pérdida de advertencias del horómetro', async () => {
  const production = await loadProduction();
  const data = originals();
  const result = accreditEditorialHistoryConsumption(loadEditorialHistoryInventory(root), data, {
    ...production,
    prepareUnit: (record) => {
      const prepared = production.prepareUnit(record);
      const key = `${record.providerId}:${record.reference}`;
      if (key === 'mercaeleva:M005-4474') return { ...prepared, product: { ...prepared.product,
        description_general: `${prepared.product.description_general} Incluye una batería opcional.` } };
      if (key === 'mercaeleva:M159-0669') return { ...prepared, product: { ...prepared.product,
        description_general: prepared.product.description_general.replace('sin una lectura de horómetro estructurada',
          'con lectura certificada del horómetro') } };
      return prepared;
    }
  });
  const affected = result.entries.filter((item) => item.consumption?.meaningReconciliation?.blocking > 0);
  assert.deepEqual(affected.map((item) => item.subject).sort(),
    ['mercaeleva:M005-4474', 'mercaeleva:M159-0669']);
  assert.equal(result.totals.runtime.fallbackMeaning.blocking, 2);
});

test('los detalles documentados del fabricante conservan su cautela de modelo sin atribución a la unidad', async () => {
  const result = await accredited();
  const publicationGaps = result.entries.filter((item) => item.consumption?.meaningReconciliation?.unreproduced > 0);
  assert.equal(publicationGaps.length, 0);
  assert.equal(result.totals.runtime.fallbackMeaning.blocking, 0);
  for (const subject of ['mercaeleva:M030-7485', 'mercaeleva:M095-5362']) {
    const entry = result.entries.find((item) => item.subject === subject &&
      item.consumption?.result === 'composed_instead_of_fallback');
    assert.equal(entry?.status, 'ACREDITADO_ESPECIFICO');
    assert.ok(entry.consumption.meaningReconciliation.signals.filter((signal) =>
      signal.severity === 'pendiente_fuente_modelo').every((signal) =>
      signal.reproduced && signal.evidence === 'referencia_tecnica_compartida'));
  }
});

test('cada afirmación de fabricante exige respaldo de referencia técnica, no una mera coincidencia de palabras', () => {
  const source = 'La ficha del fabricante describe plumín y evita el voladizo trasero.';
  const published = 'El modelo cuenta con plumín y evita el voladizo trasero.';
  const record = { year: null, horometer: null, specs: {} };
  const prepared = { product: { title: '', spec: {} } };
  const alone = inspectArchivedFallbackMeaning(source, published, record, prepared, null, null);
  assert.equal(alone.supportedModelClaims, 0);
  assert.equal(alone.unsupportedModelClaims, 2);
  assert.equal(alone.unverifiedModelPublications, 2);
  assert.equal(alone.reproduced, 0);
  const grounded = inspectArchivedFallbackMeaning(source, published, record, prepared, null,
    '3 m de alcance horizontal con plumín en la documentación del fabricante');
  assert.equal(grounded.supportedModelClaims, 1);
  assert.equal(grounded.unsupportedModelClaims, 1);
  assert.equal(grounded.unverifiedModelPublications, 1);
  assert.deepEqual(grounded.signals.map((signal) => [signal.name, signal.evidence, signal.reproduced]), [
    ['plumin_del_texto_historico', 'referencia_tecnica_compartida', true],
    ['ausencia_voladizo_trasero_de_modelo', 'solo_texto_historico', false]
  ]);
});

test('las referencias compartidas acreditan las afirmaciones de modelo sin atribuirlas a unidades concretas', async () => {
  const result = await accredited();
  for (const subject of ['mercaeleva:M030-7485', 'mercaeleva:M095-5362']) {
    const item = result.entries.find((entry) => entry.subject === subject &&
      entry.consumption?.result === 'composed_instead_of_fallback');
    assert.equal(item?.status, 'ACREDITADO_ESPECIFICO');
    assert.equal(item.consumption.meaningReconciliation.unsupportedModelClaims, 0);
    assert.ok(item.consumption.meaningReconciliation.signals.filter((signal) =>
      signal.severity === 'pendiente_fuente_modelo').every((signal) => signal.reproduced &&
        signal.evidence === 'referencia_tecnica_compartida' && !signal.publicationWithoutEvidence));
  }
  const documented = result.entries.filter((item) =>
    item.consumption?.meaningReconciliation?.signals.some((signal) =>
      signal.name === 'plumin_del_texto_historico' && signal.evidence === 'referencia_tecnica_compartida'));
  assert.deepEqual(documented.map((item) => item.subject).sort(), [
    'mercaeleva:M030-7485', 'mercaeleva:M095-5362', 'mercaeleva:M144-5512', 'mercaeleva:M171-6370'
  ]);
});

test('un nuevo registro del mismo modelo reutiliza solo la referencia compatible, no la descripción firmada de otra unidad', async () => {
  const production = await loadProduction();
  const source = originals().find((record) => record.providerId === 'mercaeleva' &&
    record.reference === 'M095-5362');
  assert.ok(source);
  const incoming = { ...source, reference: 'UNIDAD-NUEVA-INTERNA',
    url: 'https://sales.mercaeleva.com/es/for-sale/machine/Haulotte-STAR-10-UNIDAD-NUEVA-INTERNA',
    horometer: '283', specs: { ...source.specs, 'Artículo No.': 'UNIDAD-NUEVA-INTERNA', 'Horas laborales': '283 h' } };
  const matching = production.resolveUnit(incoming, incoming);
  assert.equal(matching.fallbackGeneral, null);
  assert.equal(matching.general, null);
  assert.match(matching.modelReference, /3 m de alcance horizontal con plumín/u);
  assert.match(matching.modelReference, /sin voladizo trasero/u);
  assert.match(matching.modelReference, /no acreditan la configuración ni las prestaciones de esta unidad/u);
  const wrongModel = production.resolveUnit({ ...incoming, model: 'OTRO-MODELO', specs: {
    ...incoming.specs, Modelo: 'OTRO-MODELO' } });
  assert.ok(!wrongModel.modelReference?.includes('plumín'));
  const wrongHeight = production.resolveUnit({ ...incoming, specs: {
    ...incoming.specs, 'Altura de trabajo': '9 m' } });
  assert.ok(!wrongHeight.modelReference?.includes('plumín'));
});

test('una afirmación de equipamiento individual no se justifica por una referencia de modelo publicada', async () => {
  const production = await loadProduction();
  const result = accreditEditorialHistoryConsumption(loadEditorialHistoryInventory(root), originals(), {
    ...production,
    prepareUnit: (record) => {
      const prepared = production.prepareUnit(record);
      if (record.providerId !== 'mercaeleva' || !['M030-7485', 'M095-5362'].includes(record.reference)) {
        return prepared;
      }
      const claim = record.reference === 'M030-7485' ? 'Incluye plumín.' : 'Evita el voladizo trasero.';
      return { ...prepared, product: { ...prepared.product,
        description_general: `${prepared.product.description_general} ${claim}` } };
    }
  });
  assert.equal(result.totals.runtime.fallbackMeaning.unverifiedModelPublications, 0);
  assert.equal(result.totals.runtime.fallbackMeaning.unsupportedModelClaims, 0);
  assert.equal(result.totals.states.PENDIENTE_EQUIVALENCIA, 2);
  assert.deepEqual(result.entries.filter((item) => item.status === 'PENDIENTE_EQUIVALENCIA')
    .map((item) => item.subject).sort(), [
    'mercaeleva:M030-7485', 'mercaeleva:M095-5362'
  ]);
});

test('concilia magnitudes con su concepto y fuente sin confundir anchura total con anchura de limpieza', async () => {
  const result = await accredited();
  const evidence = result.totals.runtime.fallbackTechnical;
  assert.deepEqual({ published: evidence.published, structured: evidence.structured,
    excluded: evidence.excluded, modelOnly: evidence.modelOnly,
    unsupported: evidence.unsupported, blocking: evidence.blocking },
  { published: 120, structured: 3, excluded: 3, modelOnly: 1, unsupported: 0, blocking: 0 });
  const all = result.entries.filter((item) => item.consumption?.result === 'composed_instead_of_fallback');
  assert.equal(all.length, 35);
  const claims = all.flatMap((item) => item.consumption.technicalReconciliation.signals);
  assert.equal(claims.length, evidence.published + evidence.structured + evidence.excluded +
    evidence.modelOnly + evidence.unsupported + evidence.blocking);
  const scrubber = all.find((item) => item.subject === 'gomariz:FR1077');
  assert.ok(scrubber);
  assert.deepEqual(scrubber.consumption.technicalReconciliation.signals
    .filter((signal) => signal.concept.startsWith('anchura')).map((signal) => [signal.concept, signal.value, signal.result]), [
    ['anchura_limpieza', '0.81 m', 'publicado_con_mismo_concepto'],
    ['anchura', '0.88 m', 'publicado_con_mismo_concepto']
  ]);
  assert.ok(all.every((item) => item.status === fallbackStatus(item)));
});

test('conserva tres alturas descartadas y separa la referencia del modelo de la prestación de unidad', async () => {
  const result = await accredited();
  const fallbacks = result.entries.filter((item) => item.consumption?.result === 'composed_instead_of_fallback');
  assert.deepEqual(fallbacks.filter((item) => item.consumption.technicalReconciliation.excluded > 0)
    .map((item) => item.subject).sort(), ['gomariz:TE1621', 'gomariz:TE1622', 'gomariz:TE1858']);
  for (const item of fallbacks.filter((entry) => entry.consumption.technicalReconciliation.excluded > 0)) {
    assert.ok(item.consumption.technicalReconciliation.signals.some((signal) =>
      signal.concept === 'altura_plataforma' && signal.value === '14.3 m' &&
      signal.result === 'contradiccion_excluida' && signal.currentSpecValue === '4.3 m'));
  }
  const model = fallbacks.find((item) => item.subject === 'mercaeleva:M144-5512');
  assert.ok(model?.consumption.technicalReconciliation.signals.some((signal) =>
    signal.concept === 'alcance_lateral' && signal.value === '3 m' &&
    signal.result === 'referencia_de_modelo_no_acredita_unidad'));
  assert.deepEqual(fallbacks.filter((item) => item.consumption.technicalReconciliation.unsupported > 0)
    .map((item) => item.subject).sort(), []);
  for (const subject of ['mercaeleva:M200-9533', 'mercaeleva:M476-1722']) {
    assert.ok(fallbacks.find((item) => item.subject === subject)?.consumption.technicalReconciliation.signals
      .some((signal) => signal.concept === 'capacidad' && signal.sourceField === 'Capacidad máxima de elevación' &&
        signal.result === 'publicado_con_mismo_concepto'));
  }
});

test('una cifra conservada bajo el concepto incorrecto no equivale al dato histórico', async () => {
  const production = await loadProduction();
  const record = originals().find((item) => item.providerId === 'gomariz' && item.reference === 'TE1814');
  const history = (await accredited()).entries.find((item) => item.subject === 'gomariz:TE1814' &&
    item.consumption?.result === 'composed_instead_of_fallback');
  assert.ok(record && history);
  const prepared = production.prepareUnit(record);
  const incorrect = prepared.product.description_general
    .replace('capacidad de 230 kg', 'capacidad de 1.620 kg')
    .replace('peso declarado de 1.620 kg', 'peso declarado de 230 kg');
  assert.notEqual(incorrect, prepared.product.description_general);
  const result = inspectArchivedFallbackTechnical(history.value, incorrect, record, prepared,
    production.resolveUnit(record, record).modelReference);
  assert.equal(result.blocking, 2);
  assert.deepEqual(result.signals.filter((signal) =>
    signal.result === 'publicacion_conceptualmente_incompatible').map((signal) => signal.concept).sort(),
  ['capacidad', 'peso']);
});

test('el borrado de la magnitud en ficha y specs bloquea, aunque el mismo número subsista en otro campo', async () => {
  const production = await loadProduction();
  const record = originals().find((item) => item.providerId === 'gomariz' && item.reference === 'TE1814');
  const history = (await accredited()).entries.find((item) => item.subject === 'gomariz:TE1814' &&
    item.consumption?.result === 'composed_instead_of_fallback');
  assert.ok(record && history);
  const prepared = production.prepareUnit(record);
  const altered = { ...prepared, product: { ...prepared.product,
    spec: { ...prepared.product.spec, Capacidad: '999 kg' } } };
  const published = altered.product.description_general.replace('capacidad de 230 kg', 'capacidad sin confirmar');
  const failure = inspectArchivedFallbackTechnical(history.value, published, record, altered,
    production.resolveUnit(record, record).modelReference);
  assert.equal(failure.blocking, 1);
  assert.ok(failure.signals.some((signal) => signal.concept === 'capacidad' &&
    signal.result === 'publicacion_conceptualmente_incompatible' && signal.currentSpecValue === '999 kg'));
});

test('la acreditación del censo detecta una cifra publicada bajo concepto incorrecto', async () => {
  const production = await loadProduction();
  const result = accreditEditorialHistoryConsumption(loadEditorialHistoryInventory(root), originals(), {
    ...production,
    prepareUnit: (record) => {
      const prepared = production.prepareUnit(record);
      if (record.providerId !== 'gomariz' || record.reference !== 'TE1814') return prepared;
      return { ...prepared, product: { ...prepared.product,
        description_general: prepared.product.description_general
          .replace('capacidad de 230 kg', 'capacidad de 1.620 kg')
          .replace('peso declarado de 1.620 kg', 'peso declarado de 230 kg') } };
    }
  });
  assert.equal(result.totals.runtime.fallbackTechnical.blocking, 2);
  const target = result.entries.find((item) => item.subject === 'gomariz:TE1814' &&
    item.consumption?.result === 'composed_instead_of_fallback');
  assert.equal(target?.status, 'PENDIENTE_EQUIVALENCIA');
  assert.equal(target.consumption.technicalReconciliation.blocking, 2);
});


test('contrasta las copias comerciales firmadas sin confundir la preparación con la publicación aprobada', async () => {
  const inventory = await accredited();
  const observed = assessEditorialHistoryPublications(inventory, originals(), loadActiveEditorialPublications(root));
  assert.equal(observed.version, 1);
  assert.equal(observed.totals.activeUnits, 1344);
  assert.equal(observed.totals.alignedToOriginals, 1333);
  assert.equal(observed.totals.withoutCurrentOriginal, 11);
  assert.equal(observed.totals.sourceMismatch, 0);
  assert.equal(observed.totals.originalsWithoutActive, 418);
  assert.deepEqual(observed.totals.signedDirect, {
    literal: 524, normalizedKg: 0, different: 79, withoutActive: 0, sourceMismatch: 0
  });
  assert.deepEqual(observed.totals.historicalFallback, {
    literal: 24, normalizedKg: 0, composed: 11, withoutActive: 0, sourceMismatch: 0
  });
  assert.deepEqual(observed.totals.displaced, {
    winnerLiteral: 35, winnerNormalizedKg: 0, otherText: 4, withoutActive: 0, sourceMismatch: 0
  });
  assert.equal(observed.signed.length, 677);
  assert.deepEqual(observed.signed.map((item) => item.id).sort(), inventory.entries
    .filter((item) => item.nature === 'signed_unit').map((item) => item.id).sort());
  assert.ok(observed.signed.every((item) => item.activeTextSha256 &&
    /^[\da-f]{64}$/u.test(item.activeTextSha256)));
  assert.equal(inventory.totals.states.ACREDITADO_ESPECIFICO, 635);
  assert.equal(inventory.totals.states.PENDIENTE_EQUIVALENCIA, 0);
});

test('un texto firmado presente en preparación pero cambiado en la publicación no se acredita como publicado', async () => {
  const inventory = await accredited();
  const groups = loadActiveEditorialPublications(root);
  const baseline = assessEditorialHistoryPublications(inventory, originals(), groups);
  const selected = baseline.signed.find((item) => item.observation === 'literal' && item.role !== 'fallbackGeneral');
  assert.ok(selected);
  const group = groups.find((value) => value.providerId === selected.subject.split(':')[0]);
  const product = group.products.find((value) => value.reference === selected.subject.split(':')[1]);
  const field = selected.role === 'short' ? 'description' : selected.role === 'title' ? 'title' : 'description_general';
  product[field] = 'Texto sin acreditación de origen';
  const changed = assessEditorialHistoryPublications(inventory, originals(), groups);
  assert.equal(changed.totals.signedDirect.literal, baseline.totals.signedDirect.literal - 1);
  assert.equal(changed.totals.signedDirect.different, baseline.totals.signedDirect.different + 1);
  assert.equal(changed.signed.find((item) => item.id === selected.id)?.observation, 'different');
  assert.equal(inventory.entries.find((item) => item.id === selected.id)?.status, 'ACREDITADO_ESPECIFICO');
});

test('una copia aprobada modificada no altera la acreditación específica de la preparación', async () => {
  const inventory = await accredited();
  const groups = loadActiveEditorialPublications(root);
  const baseline = assessEditorialHistoryPublications(inventory, originals(), groups);
  const target = baseline.signed.find((item) => item.subject === 'mercaeleva:M005-4474' &&
    item.role === 'fallbackGeneral');
  assert.ok(target);
  const group = groups.find((value) => value.providerId === 'mercaeleva');
  const product = group.products.find((value) => value.reference === 'M005-4474');
  assert.ok(product);
  product.description_general = 'Redacción comercial modificada tras la aprobación';
  const changed = assessEditorialHistoryPublications(inventory, originals(), groups);
  const observation = changed.signed.find((item) => item.id === target.id);
  assert.ok(observation);
  assert.notEqual(observation.activeTextSha256, target.activeTextSha256);
  assert.equal(inventory.entries.find((entry) => entry.id === target.id)?.status, 'ACREDITADO_ESPECIFICO');
});

test('una firma desplazada no se justifica en la publicación si allí falta la ganadora', async () => {
  const inventory = await accredited();
  const groups = loadActiveEditorialPublications(root);
  const baseline = assessEditorialHistoryPublications(inventory, originals(), groups);
  const target = baseline.signed.find((item) => item.observation === 'winnerLiteral');
  assert.ok(target);
  const old = inventory.entries.find((item) => item.id === target.id);
  assert.equal(old.status, 'NO_APLICABLE_JUSTIFICADO');
  const group = groups.find((value) => value.providerId === target.subject.split(':')[0]);
  const product = group.products.find((value) => value.reference === target.subject.split(':')[1]);
  const field = target.role === 'short' ? 'description' : target.role === 'title' ? 'title' : 'description_general';
  product[field] = old.value;
  const changed = assessEditorialHistoryPublications(inventory, originals(), groups);
  assert.equal(changed.totals.displaced.winnerLiteral, baseline.totals.displaced.winnerLiteral - 1);
  assert.equal(changed.totals.displaced.otherText, baseline.totals.displaced.otherText + 1);
  assert.equal(changed.signed.find((item) => item.id === old.id)?.observation, 'otherText');
});

test('una ficha sin publicación activa no se presenta como una firma comercial publicada', async () => {
  const inventory = await accredited();
  const groups = loadActiveEditorialPublications(root);
  const baseline = assessEditorialHistoryPublications(inventory, originals(), groups);
  const item = baseline.signed.find((entry) => entry.observation === 'literal' && entry.role !== 'fallbackGeneral');
  assert.ok(item);
  const provider = groups.find((value) => value.providerId === item.subject.split(':')[0]);
  const affectedDirect = baseline.signed.filter((value) => value.subject === item.subject &&
    inventory.entries.find((entry) => entry.id === value.id)?.status === 'ACREDITADO_ESPECIFICO').length;
  provider.products = provider.products.filter((value) => value.reference !== item.subject.split(':')[1]);
  const changed = assessEditorialHistoryPublications(inventory, originals(), groups);
  assert.equal(changed.totals.signedDirect.withoutActive,
    baseline.totals.signedDirect.withoutActive + affectedDirect);
  assert.equal(changed.signed.find((value) => value.id === item.id)?.observation, 'withoutActive');
  assert.equal(changed.totals.activeUnits, baseline.totals.activeUnits - 1);
  assert.equal(changed.totals.originalsWithoutActive, baseline.totals.originalsWithoutActive + 1);
});

test('no acepta publicación de otra procedencia ni identidades repetidas como acreditación literal', async () => {
  const inventory = await accredited();
  const groups = loadActiveEditorialPublications(root);
  const baseline = assessEditorialHistoryPublications(inventory, originals(), groups);
  const selected = baseline.signed.find((item) => item.observation === 'literal' && item.role !== 'fallbackGeneral');
  assert.ok(selected);
  const group = groups.find((value) => value.providerId === selected.subject.split(':')[0]);
  const product = group.products.find((value) => value.reference === selected.subject.split(':')[1]);
  const originalUrl = product.sourceUrl;
  product.sourceUrl = `${originalUrl}?origen=distinto`;
  const altered = assessEditorialHistoryPublications(inventory, originals(), groups);
  assert.equal(altered.signed.find((item) => item.id === selected.id)?.observation, 'sourceMismatch');
  assert.equal(altered.totals.sourceMismatch, baseline.totals.sourceMismatch + 1);
  product.sourceUrl = originalUrl;
  group.products.push(product);
  assert.throws(() => assessEditorialHistoryPublications(inventory, originals(), groups),
    /Publicación activa duplicada/u);
  group.products.pop();
  product.providerId = 'otro-proveedor';
  assert.throws(() => assessEditorialHistoryPublications(inventory, originals(), groups),
    /Identidad de publicación activa inválida/u);
});


test('separa la conservación íntegra de firmas, ampliaciones y sustituciones en publicaciones aprobadas', async () => {
  const inventory = await accredited();
  const observed = assessEditorialHistoryPublications(inventory, originals(), loadActiveEditorialPublications(root));
  assert.deepEqual(observed.totals.textContinuity, {
    signedDirect: {
      literal: 524, unit_normalized: 0, full_text_retained_with_suffix: 62,
      different_text: 17, without_active: 0, source_mismatch: 0
    },
    historicalFallback: {
      literal: 24, unit_normalized: 0, full_text_retained_with_suffix: 3,
      different_text: 8, without_active: 0, source_mismatch: 0
    },
    displaced: {
      literal: 35, unit_normalized: 0, full_text_retained_with_suffix: 0,
      different_text: 4, without_active: 0, source_mismatch: 0
    }
  });
  const signedById = new Map(inventory.entries.map((item) => [item.id, item]));
  assert.equal(observed.signed.length, 677);
  assert.ok(observed.signed.every((item) => item.continuity &&
    ['literal', 'unit_normalized', 'full_text_retained_with_suffix', 'different_text',
      'without_active', 'source_mismatch'].includes(item.continuity.kind)));
  assert.ok(observed.signed.filter((item) => item.continuity.kind === 'full_text_retained_with_suffix')
    .every((item) => item.continuity.suffixLength > 0 &&
      /^[a-f\d]{64}$/u.test(item.continuity.suffixSha256)));
  assert.equal(inventory.totals.states.ACREDITADO_ESPECIFICO, 635);
  assert.equal(inventory.totals.states.PENDIENTE_EQUIVALENCIA, 0);
  assert.ok(observed.signed.filter((item) => item.continuity.kind === 'different_text')
    .every((item) => signedById.has(item.id)));
});

test('una ampliación conserva el texto histórico pero no acredita automáticamente la frase añadida', async () => {
  const inventory = await accredited();
  const groups = loadActiveEditorialPublications(root);
  const baseline = assessEditorialHistoryPublications(inventory, originals(), groups);
  const item = baseline.signed.find((entry) => entry.subject === 'gam:6113' &&
    entry.continuity.kind === 'full_text_retained_with_suffix');
  assert.ok(item);
  assert.equal(item.observation, 'different');
  assert.equal(item.baseline, 'ACREDITADO_ESPECIFICO');
  const product = groups.find((group) => group.providerId === 'gam').products
    .find((entry) => entry.reference === '6113');
  const signed = inventory.entries.find((entry) => entry.id === item.id);
  assert.ok(product.description_general.startsWith(`${signed.value} `));
  product.description_general = signed.value;
  const literal = assessEditorialHistoryPublications(inventory, originals(), groups);
  assert.equal(literal.signed.find((entry) => entry.id === item.id)?.continuity.kind, 'literal');
  assert.equal(literal.totals.textContinuity.signedDirect.full_text_retained_with_suffix,
    baseline.totals.textContinuity.signedDirect.full_text_retained_with_suffix - 1);
  assert.equal(literal.totals.textContinuity.signedDirect.literal,
    baseline.totals.textContinuity.signedDirect.literal + 1);
});

test('no clasifica como conservación íntegra una ampliación que altera el texto firmado', async () => {
  const inventory = await accredited();
  const groups = loadActiveEditorialPublications(root);
  const baseline = assessEditorialHistoryPublications(inventory, originals(), groups);
  const item = baseline.signed.find((entry) => entry.subject === 'gam:6113' &&
    entry.continuity.kind === 'full_text_retained_with_suffix');
  assert.ok(item);
  const product = groups.find((group) => group.providerId === 'gam').products
    .find((entry) => entry.reference === '6113');
  const before = product.description_general;
  product.description_general = before.replace('tres ruedas', 'cuatro ruedas');
  const changed = assessEditorialHistoryPublications(inventory, originals(), groups);
  const observed = changed.signed.find((entry) => entry.id === item.id);
  assert.equal(observed.continuity.kind, 'different_text');
  assert.notEqual(observed.activeTextSha256, item.activeTextSha256);
  assert.equal(changed.totals.textContinuity.signedDirect.different_text,
    baseline.totals.textContinuity.signedDirect.different_text + 1);
  const signed = inventory.entries.find((entry) => entry.id === item.id);
  product.description_general = `${signed.value}${before.slice(signed.value.length).trimStart()}`;
  const joined = assessEditorialHistoryPublications(inventory, originals(), groups);
  assert.equal(joined.signed.find((entry) => entry.id === item.id)?.continuity.kind, 'different_text');
});

test('distingue la publicación de los respaldos de su acreditación en el compositor actual', async () => {
  const inventory = await accredited();
  const observed = assessEditorialHistoryPublications(inventory, originals(), loadActiveEditorialPublications(root));
  const item = observed.signed.find((entry) => entry.subject === 'gomariz:TE1858' &&
    entry.continuity.kind === 'full_text_retained_with_suffix');
  assert.ok(item);
  assert.equal(item.observation, 'composed');
  assert.equal(item.baseline, 'NO_APLICABLE_JUSTIFICADO');
  assert.equal(inventory.entries.find((entry) => entry.id === item.id)?.consumption.result,
    'composed_instead_of_fallback');
  const changed = observed.signed.find((entry) => entry.subject === 'gam:2328' &&
    entry.continuity.kind === 'different_text');
  assert.ok(changed);
  assert.equal(changed.baseline, 'ACREDITADO_ESPECIFICO');
});

test('no atribuye continuidad a publicaciones ausentes o de otra procedencia', async () => {
  const inventory = await accredited();
  const groups = loadActiveEditorialPublications(root);
  const baseline = assessEditorialHistoryPublications(inventory, originals(), groups);
  const item = baseline.signed.find((entry) => entry.continuity.kind === 'full_text_retained_with_suffix');
  assert.ok(item);
  const group = groups.find((entry) => entry.providerId === item.subject.split(':')[0]);
  const product = group.products.find((entry) => entry.reference === item.subject.split(':')[1]);
  product.sourceUrl += '?distinta';
  const mismatch = assessEditorialHistoryPublications(inventory, originals(), groups);
  assert.equal(mismatch.signed.find((entry) => entry.id === item.id)?.continuity.kind, 'source_mismatch');
  product.sourceUrl = product.sourceUrl.replace('?distinta', '');
  group.products = group.products.filter((entry) => entry !== product);
  const removed = assessEditorialHistoryPublications(inventory, originals(), groups);
  assert.equal(removed.signed.find((entry) => entry.id === item.id)?.continuity.kind, 'without_active');
  assert.equal(inventory.entries.find((entry) => entry.id === item.id)?.status, 'ACREDITADO_ESPECIFICO');
});


test('delimita las sustituciones de publicación sin convertir divergencias en equivalencias históricas', async () => {
  const inventory = await accredited();
  const publication = assessEditorialHistoryPublications(inventory, originals(), loadActiveEditorialPublications(root));
  assert.deepEqual(publication.totals.textDifferences, {
    signedDirect: { differentText: 17, changedNumbers: 15, removedCautions: 4,
      addedCautions: 4, suffixWithNewNumbers: 12 },
    historicalFallback: { differentText: 8, changedNumbers: 7, removedCautions: 0,
      addedCautions: 1, suffixWithNewNumbers: 3 },
    displaced: { differentText: 4, changedNumbers: 2, removedCautions: 0,
      addedCautions: 0, suffixWithNewNumbers: 0 }
  });
  assert.equal(publication.totals.changedUnitFields, 25);
  assert.ok(publication.signed.filter((item) => item.continuity.kind === 'different_text')
    .every((item) => item.difference && item.difference.semanticEquivalenceAccredited === false));
  assert.ok(publication.signed.filter((item) => item.continuity.kind === 'literal')
    .every((item) => item.difference === null));
  assert.equal(inventory.totals.states.ACREDITADO_ESPECIFICO, 635);
  assert.equal(inventory.totals.states.PENDIENTE_EQUIVALENCIA, 0);
});

test('recupera evidencias cuantificables sin reabrir las correcciones aprobadas de identidad', async () => {
  const inventory = await accredited();
  const published = assessEditorialHistoryPublications(inventory, originals(), loadActiveEditorialPublications(root));
  const changed = (subject, role) => published.signed.find((item) => item.subject === subject &&
    item.role === role && item.continuity.kind === 'different_text' &&
    item.baseline === 'ACREDITADO_ESPECIFICO');
  assert.deepEqual(changed('gam:4802', 'general')?.difference.removedNumbers, ['1418']);
  assert.deepEqual(changed('gam:4802', 'general')?.difference.removedCautions, ['debe verificarse']);
  assert.ok(changed('gam:2328', 'general')?.difference.removedNumbers.includes('9.000'));
  assert.ok(changed('gam:2328', 'general')?.difference.removedCautions.includes('sin acreditar'));
  assert.deepEqual(changed('mercaeleva:M547-2372', 'short')?.difference.removedNumbers, ['14.696', '2000']);
  assert.ok(changed('mercaeleva:M547-2372', 'short')?.difference.addedNumbers.includes('6.500'));
  assert.deepEqual(changed('gomariz:CC1666', 'general')?.difference.removedNumbers, []);
  assert.deepEqual(changed('gomariz:CC1666', 'general')?.difference.addedNumbers, []);
  assert.ok(published.signed.some((item) => item.subject === 'gomariz:CC1666' &&
    item.continuity.kind === 'different_text' && item.baseline === 'NO_APLICABLE_JUSTIFICADO'));
});

test('conserva magnitudes equivalentes por formato sin afirmar equivalencia de conceptos técnicos', () => {
  const compared = inspectEditorialTextDifference(
    'Carga 1.350 kg, autonomía 7.282 h, volumen 2,50 m3.',
    'Carga 1350 kg, autonomía 7282 h, volumen 2.5 m3. Se revisará la carga.', 'different_text');
  assert.deepEqual(compared.removedNumbers, []);
  assert.deepEqual(compared.addedNumbers, []);
  assert.equal(compared.semanticEquivalenceAccredited, false);
  assert.deepEqual(inspectEditorialTextDifference('Capacidad 230 kg y peso 1.620 kg.',
    'Capacidad 1.620 kg y peso 230 kg.', 'different_text').removedNumbers, []);
});

test('una pérdida de magnitud y cautela aparece aunque el nuevo texto parezca más completo', () => {
  const inspected = inspectEditorialTextDifference(
    'Capacidad 1.600 kg. Variante pendiente de confirmar. No debe asumirse una batería de 48 V.',
    'Capacidad 1.800 kg, batería de 48 V y 300 Ah. Equipamiento confirmado.', 'different_text');
  assert.deepEqual(inspected.removedNumbers, ['1.600']);
  assert.deepEqual(inspected.addedNumbers, ['1.800', '300']);
  assert.deepEqual(inspected.removedCautions, ['no debe', 'pendiente de confirmar']);
  assert.equal(inspected.semanticEquivalenceAccredited, false);
});

test('las ampliaciones numéricas quedan identificadas aunque se conserve entero el texto antiguo', async () => {
  const inventory = await accredited();
  const groups = loadActiveEditorialPublications(root);
  const before = assessEditorialHistoryPublications(inventory, originals(), groups);
  const selected = before.signed.find((item) => item.continuity.kind === 'literal' &&
    item.baseline === 'ACREDITADO_ESPECIFICO' && item.role === 'short');
  assert.ok(selected);
  const product = groups.find((group) => group.providerId === selected.subject.split(':')[0])?.products
    .find((entry) => entry.reference === selected.subject.split(':')[1]);
  assert.ok(product);
  product.description += ' Capacidad adicional 999999 kg por acreditar.';
  const after = assessEditorialHistoryPublications(inventory, originals(), groups);
  const target = after.signed.find((item) => item.id === selected.id);
  assert.equal(target?.continuity.kind, 'full_text_retained_with_suffix');
  assert.ok(target?.difference.addedNumbers.includes('999999'));
  assert.equal(target?.difference.semanticEquivalenceAccredited, false);
  assert.equal(after.totals.textDifferences.signedDirect.suffixWithNewNumbers,
    before.totals.textDifferences.signedDirect.suffixWithNewNumbers + 1);
});

test('una identidad de publicación diferente no permite atribuir señales ni texto a la firma', async () => {
  const inventory = await accredited();
  const groups = loadActiveEditorialPublications(root);
  const before = assessEditorialHistoryPublications(inventory, originals(), groups);
  const selected = before.signed.find((item) => item.continuity.kind === 'different_text' &&
    item.baseline === 'ACREDITADO_ESPECIFICO');
  assert.ok(selected);
  const product = groups.find((group) => group.providerId === selected.subject.split(':')[0])?.products
    .find((entry) => entry.reference === selected.subject.split(':')[1]);
  assert.ok(product);
  product.sourceUrl += '?procedencia-externa=1';
  const after = assessEditorialHistoryPublications(inventory, originals(), groups);
  assert.equal(after.signed.find((item) => item.id === selected.id)?.observation, 'sourceMismatch');
  assert.equal(after.signed.find((item) => item.id === selected.id)?.difference, null);
  assert.equal(after.totals.sourceMismatch, before.totals.sourceMismatch + 1);
});

test('ningún análisis de cifras o frases obtiene por sí mismo una acreditación semántica', () => {
  assert.equal(inspectEditorialTextDifference('Altura 12 m.', 'Altura 12 m. Pesa 900 kg.',
    'full_text_retained_with_suffix').semanticEquivalenceAccredited, false);
  assert.equal(inspectEditorialTextDifference('Altura de trabajo 12 m.', 'Altura de plataforma 12 m.',
    'different_text').semanticEquivalenceAccredited, false);
  assert.equal(inspectEditorialTextDifference('Texto idéntico', 'Texto idéntico', 'literal'), null);
  assert.throws(() => inspectEditorialTextDifference('Datos y 12 m.', 'Datos y 15 m.',
    'full_text_retained_with_suffix'), /ampliación literal no puede eliminar/u);
});

test('exige continuidad de identidad estructurada y cautelas de horas en las redacciones aprobadas sustituidas', async () => {
  const inventory = await accredited();
  const originalsCurrent = originals();
  const groups = loadActiveEditorialPublications(root);
  const current = assessEditorialHistoryPublications(inventory, originalsCurrent, groups);
  assert.deepEqual(current.totals.unitEvidence, {
    changedDirect: 17, sameField: 31, otherField: 2, structured: 0, missing: 0,
    hourDiscordances: 3, discordancesRetained: 3, discordancesAtRisk: 0
  });
  const displaced = current.signed.find((item) => item.subject === 'mercaeleva:M547-2372' &&
    item.role === 'short' && item.continuity.kind === 'different_text');
  assert.deepEqual(displaced?.unitEvidence?.claims.map((item) => item.location), ['other_field', 'other_field']);
  const group = groups.find((value) => value.providerId === 'mercaeleva');
  const product = group.products.find((value) => value.reference === 'M018-7013');
  const originalText = product.description_general;
  product.description_general = originalText
    .replace('Hay una discrepancia que debe verificarse:', 'Se han indicado ambos datos:')
    .replace('no se consideran lecturas equivalentes', 'se muestran en el anuncio');
  const invalid = assessEditorialHistoryPublications(inventory, originalsCurrent, groups);
  assert.equal(invalid.totals.unitEvidence.discordancesAtRisk, 1);
  assert.equal(invalid.totals.unitEvidence.discordancesRetained, 2);
  assert.equal(invalid.totals.unitEvidence.changedDirect, 17);
  assert.equal(invalid.totals.unitEvidence.missing, 0);
});

test('la conciliación productiva revoca una sustitución si el dato histórico cambia de concepto', async () => {
  const input = loadEditorialHistoryInventory(root);
  const previous = input.entries.find((item) => item.subject === 'mercaeleva:M346-8712' &&
    item.field === 'general' && item.sources.some((source) => source.selection === 'displaced'));
  assert.ok(previous);
  assert.ok(previous.value.includes('24 V'));
  previous.value = previous.value.replaceAll('24 V', '24 kg');
  const production = await loadProduction();
  const result = accreditEditorialHistoryConsumption(input, originals(), production);
  const item = result.entries.find((entry) => entry.id === previous.id);
  assert.equal(item?.status, 'PENDIENTE_EQUIVALENCIA');
  assert.equal(item?.consumption.verifiedPublishedReplacement, false);
  assert.deepEqual(item?.consumption.unmatchedNumericMarkers, []);
  assert.equal(result.totals.runtime.supersededWithVerifiedWinner, 38);
  assert.equal(result.totals.runtime.supersededPending, 1);
  assert.equal(result.totals.states.PENDIENTE_EQUIVALENCIA, 1);
  assert.equal(result.totals.states.PENDIENTE_EQUIVALENCIA,
    result.entries.filter((entry) => entry.status === 'PENDIENTE_EQUIVALENCIA').length);
});


test('el censo de acreditación exige identidad, textos ready e incidencias review sin ocultar vacíos legítimos', async () => {
  const production = await loadProduction();
  const records = originals();
  const original = records.find((record) => record.providerId === 'gomariz' && record.reference === 'TE1858');
  const review = records.find((record) => record.providerId === 'gam' && record.reference === '2364');
  assert.ok(original && review);
  const readyResult = production.prepareUnit(original);
  const reviewResult = production.prepareUnit(review);
  assert.equal(readyResult.status, 'ready');
  assert.equal(reviewResult.status, 'review');
  assert.deepEqual(inspectEditorialHistoryPreparedUnit(original, readyResult), {
    status: 'ready', issues: 0, reviewWithoutShort: false, reviewWithoutGeneral: false
  });
  assert.equal(inspectEditorialHistoryPreparedUnit(review, reviewResult).reviewWithoutGeneral, true);
  const invalid = [
    [{ ...readyResult, product: { ...readyResult.product, reference: 'OTRA' } }, /identidad de otra unidad/u],
    [{ ...readyResult, product: { ...readyResult.product, providerId: 'gam' } }, /identidad de otra unidad/u],
    [{ ...readyResult, product: { ...readyResult.product, title: '' } }, /ready sin textos comerciales/u],
    [{ ...readyResult, product: { ...readyResult.product, description: ' ' } }, /ready sin textos comerciales/u],
    [{ ...readyResult, product: { ...readyResult.product, description_general: null } }, /ready sin textos comerciales/u],
    [{ ...readyResult, product: { ...readyResult.product, description_general: 150 } }, /ready sin textos comerciales/u],
    [{ ...readyResult, issues: ['Error incorporado indebidamente'] }, /ready con incidencias/u],
    [{ ...readyResult, issues: [null] }, /Incidencias editoriales inválidas/u],
    [{ ...readyResult, status: 'unknown' }, /sin resultado válido/u],
    [{ ...readyResult, product: null }, /sin resultado válido/u]
  ];
  for (const [result, error] of invalid) {
    assert.throws(() => inspectEditorialHistoryPreparedUnit(original, result), error);
  }
  assert.throws(() => inspectEditorialHistoryPreparedUnit(review, { ...reviewResult, issues: [] }),
    /review sin incidencia acreditable/u);
  assert.throws(() => inspectEditorialHistoryPreparedUnit(review, { ...reviewResult, issues: [' '] }),
    /Incidencias editoriales inválidas/u);
});


test('acredita por hechos y procedencia los respaldos con magnitudes corroboradas', async () => {
  const result = await accredited();
  const credited = result.entries.filter((item) => item.consumption?.factsPreserved);
  assert.deepEqual(credited.map((item) => item.subject).sort(), [
    'gomariz:BA1358', 'gomariz:BA1522', 'gomariz:BA1575',
    'gomariz:CA1041', 'gomariz:CA1436', 'gomariz:CAE1207',
    'gomariz:CAE1525', 'gomariz:DU473', 'gomariz:FR1077',
    'gomariz:MT1314', 'gomariz:MT1659', 'gomariz:MT1661',
    'gomariz:TE1772', 'gomariz:TE1814', 'gomariz:TO1241',
    'mercaeleva:M005-4474', 'mercaeleva:M030-7485', 'mercaeleva:M095-5362',
    'mercaeleva:M131-5855', 'mercaeleva:M144-5512', 'mercaeleva:M159-0669',
    'mercaeleva:M171-6370', 'mercaeleva:M178-6194', 'mercaeleva:M200-9533', 'mercaeleva:M205-2951', 'mercaeleva:M294-4678', 'mercaeleva:M310-8756', 'mercaeleva:M315-5925', 'mercaeleva:M318-0509',
    'mercaeleva:M476-1722', 'mercaeleva:M572-8190', 'mercaeleva:M805-9451'
  ]);
  assert.equal(result.totals.runtime.fallbackUnitFactsAccredited, 32);
  assert.equal(result.totals.states.ACREDITADO_ESPECIFICO, 635);
  assert.equal(result.totals.states.PENDIENTE_EQUIVALENCIA, 0);
  assert.ok(credited.every((item) => item.status === 'ACREDITADO_ESPECIFICO' &&
    item.scope === 'unit' && item.consumption.result === 'composed_instead_of_fallback' &&
    item.consumption.discardedWithEvidence === false &&
    (item.consumption.technicalReconciliation.signals.length >= 1 || item.subject === 'mercaeleva:M294-4678')));
  assert.equal(result.totals.runtime.fallbackDiscardedWithEvidence, 3);
  assert.equal(result.totals.runtime.finalExact + result.totals.runtime.finalUnitNormalized, 603);
  assert.equal(credited.filter((item) => item.consumption.technicalReconciliation.signals.length >= 4).length, 14);
  assert.equal(credited.filter((item) => item.consumption.technicalReconciliation.signals.length < 4).length, 18);
});

test('revoca hechos de respaldo ante identidad, procedencia, medida o cautela degradadas', async () => {
  const result = await accredited();
  const production = await loadProduction();
  const records = new Map(originals().map((record) => [`${record.providerId}:${record.reference}`, record]));
  const credited = result.entries.filter((item) => item.consumption?.factsPreserved);
  for (const item of credited) {
    const record = records.get(item.subject);
    assert.ok(record);
    const prepared = production.prepareUnit(record);
    const { numericReconciliation: numbers, meaningReconciliation: meaning,
      technicalReconciliation: technical } = item.consumption;
    const modelReference = production.resolveUnit(record, record).modelReference ?? null;
    const verify = (source = item.value, original = record, current = prepared,
      numberEvidence = numbers, semanticEvidence = meaning, technicalEvidence = technical) =>
      preservesArchivedFallbackUnitFacts(source, original, current, numberEvidence,
        semanticEvidence, technicalEvidence, item, modelReference) ||
      preservesArchivedFallbackModuleFacts(source, original, current, numberEvidence,
        semanticEvidence, technicalEvidence, item);
    assert.equal(verify(), true, item.subject);
    const compatible = { ...record, reference: `${record.reference}-nueva`,
      url: `${record.url}?unidad=nueva` };
    if (/\breferencia\s+[a-z][a-z\d-]+/iu.test(item.value)) {
      assert.equal(verify(item.value, compatible, production.prepareUnit(compatible)), false);
    }
    assert.equal(production.resolveUnit(compatible, compatible).fallbackGeneral, null);
    assert.equal(verify(item.value, record, { ...prepared, product: { ...prepared.product,
      reference: `${prepared.product.reference}-otro` } }), false);
    assert.equal(verify(item.value, record, { ...prepared, product: { ...prepared.product,
      sourceUrl: `${prepared.product.sourceUrl}?distinta` } }), false);
    assert.equal(verify(item.value, record, { ...prepared, product: { ...prepared.product,
      title: 'Máquina de otro fabricante' } }), false);
    if (/\b(?:ocasion|segunda mano|usad[ao])\b/iu.test(item.value)) {
      assert.equal(verify(item.value, record, { ...prepared, product: { ...prepared.product,
        condition: 'Nueva' } }), false);
    }
    assert.equal(verify(`${item.value} Batería opcional instalada.`), false);
    assert.equal(verify(`${item.value} Potencia de 125 W.`), false);
    assert.equal(verify(`${item.value} Capacidad adicional de 230 m.`), false);
    assert.equal(verify(item.value, record, prepared, numbers,
      { ...meaning, unreproduced: meaning.unreproduced + 1 }), false);
    if (technical.signals.length > 0) {
      assert.equal(verify(item.value, record, prepared, numbers, meaning,
        { ...technical, signals: technical.signals.map((signal, index) => index === 0 ?
          { ...signal, result: 'perdido_del_producto' } : signal) }), false);
    }
  }
});

test('los respaldos conservan hechos acreditados o exclusiones justificadas, sin equivalencias abiertas', async () => {
  const result = await accredited();
  const pending = result.entries.filter((item) => item.consumption?.result === 'composed_instead_of_fallback' &&
    item.status === 'PENDIENTE_EQUIVALENCIA');
  assert.deepEqual(pending, []);
  const last = result.entries.find((item) => item.subject === 'mercaeleva:M005-4474' &&
    item.consumption?.result === 'composed_instead_of_fallback');
  assert.equal(last?.status, 'ACREDITADO_ESPECIFICO');
  assert.equal(last?.consumption.factsPreserved, true);
});

test('los respaldos compactos exigen hechos de unidad y fuentes para las afirmaciones de modelo', async () => {
  const result = await accredited();
  const compact = result.entries.filter((item) => item.consumption?.factsPreserved &&
    item.consumption.technicalReconciliation.signals.length > 0 &&
    item.consumption.technicalReconciliation.signals.length < 4);
  assert.equal(compact.length, 17);
  const pending = result.entries.filter((item) => item.consumption?.result === 'composed_instead_of_fallback' &&
    item.status === 'PENDIENTE_EQUIVALENCIA');
  assert.deepEqual(pending, []);
  assert.equal(result.totals.discovered, 689);
  assert.equal(result.totals.runtime.fallbackDiscardedWithEvidence, 3);
});

test('la procedencia comercial queda vinculada al artículo del vendedor y no al texto comercial', async () => {
  const production = await loadProduction();
  const records = new Map(originals().map((item) => [`${item.providerId}:${item.reference}`, item]));
  const result = await accredited();
  for (const subject of ['mercaeleva:M131-5855', 'mercaeleva:M315-5925',
    'mercaeleva:M159-0669', 'mercaeleva:M805-9451']) {
    const record = records.get(subject);
    const prepared = production.prepareUnit(record);
    const item = result.entries.find((entry) => entry.subject === subject &&
      entry.consumption?.factsPreserved);
    assert.ok(item, subject);
    const { numericReconciliation: numbers, meaningReconciliation: meaning,
      technicalReconciliation: technical } = item.consumption;
    const evaluate = (source, old = record, current = prepared) =>
      preservesArchivedFallbackUnitFacts(source, old, current, numbers, meaning, technical, item);
    assert.equal(evaluate(item.value), true, subject);
    assert.equal(evaluate(item.value, record, { ...prepared, product: { ...prepared.product,
      spec: { ...prepared.product.spec, 'Artículo No.': 'OTRA-UNIDAD' } } }), false, subject);
    assert.equal(evaluate(item.value, { ...record,
      specs: { ...record.specs, 'Artículo No.': 'OTRA-UNIDAD' } }), false, subject);
    assert.equal(evaluate(`${item.value} El fabricante acredita un alcance adicional.`), false, subject);
    assert.equal(preservesArchivedFallbackUnitFacts(item.value, record, prepared,
      numbers, meaning, technical, { ...item, subject: 'otro-proveedor:otra-referencia' }), false);
    assert.equal(preservesArchivedFallbackUnitFacts(item.value, record, prepared,
      numbers, meaning, technical, { ...item, sourceUrl: `${item.sourceUrl}?otra-unidad` }), false);
    assert.equal(preservesArchivedFallbackUnitFacts(item.value, record, prepared,
      numbers, meaning, technical, { ...item, value: `${item.value} Afirmación añadida.` }), false);
  }
});

test('la cautela CE y la pintura no acreditan prestaciones o revisiones que no constan', async () => {
  const production = await loadProduction();
  const records = new Map(originals().map((item) => [`${item.providerId}:${item.reference}`, item]));
  const result = await accredited();
  for (const [subject, signal] of [
    ['mercaeleva:M310-8756', 'pintura_no_equivale_a_revision'],
    ['mercaeleva:M318-0509', 'certificacion_ce_no_verificada']
  ]) {
    const item = result.entries.find((entry) => entry.subject === subject &&
      entry.consumption?.factsPreserved);
    assert.ok(item, subject);
    const record = records.get(subject);
    const prepared = production.prepareUnit(record);
    const { numericReconciliation: numbers, meaningReconciliation: meaning,
      technicalReconciliation: technical } = item.consumption;
    const changedMeaning = { ...meaning,
      signals: meaning.signals.map((entry) => entry.name === signal ?
        { ...entry, reproduced: false } : entry) };
    assert.equal(preservesArchivedFallbackUnitFacts(item.value, record, prepared,
      numbers, changedMeaning, technical, item), false);
    const withoutCaution = subject.endsWith('8756') ?
      prepared.product.description_general.replace('no acredita una revisión mecánica',
        'acredita una revisión mecánica') :
      prepared.product.description_general.replace('no se ha verificado documentalmente',
        'ha sido verificada documentalmente');
    const changed = { ...prepared, product: { ...prepared.product,
      description_general: withoutCaution } };
    const checked = inspectArchivedFallbackMeaning(item.value, withoutCaution, record, changed,
      production.resolveFacts(record), production.resolveUnit(record, record).modelReference ?? null);
    assert.equal(checked.blocking, 1);
    assert.equal(preservesArchivedFallbackUnitFacts(item.value,
      record, changed, numbers, checked, technical, item), false);
  }
});

test('un respaldo compacto vuelve a pendiente si se pierde la magnitud o la cautela preparada', async () => {
  const result = await accredited();
  const production = await loadProduction();
  const record = originals().find((entry) => entry.providerId === 'mercaeleva' &&
    entry.reference === 'M159-0669');
  const item = result.entries.find((entry) => entry.subject === 'mercaeleva:M159-0669' &&
    entry.consumption?.factsPreserved);
  assert.ok(record && item);
  const prepared = production.prepareUnit(record);
  const archived = item.value;
  const modifiedGeneral = prepared.product.description_general.replace('sin una lectura de horómetro estructurada',
    'con lectura certificada del horómetro');
  const changedMeaning = inspectArchivedFallbackMeaning(archived, modifiedGeneral, record,
    { ...prepared, product: { ...prepared.product, description_general: modifiedGeneral } },
    production.resolveFacts(record), production.resolveUnit(record, record).modelReference ?? null);
  assert.equal(changedMeaning.blocking, 1);
  assert.equal(preservesArchivedFallbackUnitFacts(archived, record, prepared,
    item.consumption.numericReconciliation, changedMeaning,
    item.consumption.technicalReconciliation, item), false);
  const invalidTech = { ...item.consumption.technicalReconciliation,
    signals: item.consumption.technicalReconciliation.signals.map((signal) =>
      ({ ...signal, result: 'perdido_del_producto' })) };
  assert.equal(preservesArchivedFallbackUnitFacts(archived, record, prepared,
    item.consumption.numericReconciliation, item.consumption.meaningReconciliation, invalidTech, item), false);
  assert.equal(preservesArchivedFallbackUnitFacts(archived, { ...record, condition: 'Segunda mano' },
    prepared, item.consumption.numericReconciliation, item.consumption.meaningReconciliation,
    item.consumption.technicalReconciliation, item), false);
});
