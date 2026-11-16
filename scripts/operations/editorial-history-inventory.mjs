import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { inspectArchivedFallbackMeaning } from './editorial-history-meaning.mjs';
import { inspectArchivedFallbackTechnical, justifiesDiscardedFallback } from './editorial-history-technical.mjs';
import { preservesEditorialSupersession } from './editorial-history-supersession.mjs';
import { preservesArchivedFallbackUnitFacts, preservesArchivedFallbackModuleFacts } from './editorial-history-fallback-equivalence.mjs';

const canonicalText = (value) => String(value).normalize('NFC').replace(/\s+/gu, ' ').trim();
const archivedManufacturerSource = (raw, locator) => {
  if (!Object.hasOwn(raw, 'manufacturerSource')) return null;
  const source = raw.manufacturerSource;
  if (typeof source !== 'string' || source.trim() !== source || source.length === 0) {
    throw new Error(`Referencia histórica de fabricante inválida: ${locator}`);
  }
  let url;
  try { url = new URL(source); } catch {
    throw new Error(`Referencia histórica de fabricante inválida: ${locator}`);
  }
  if (url.protocol !== 'https:' || !url.hostname || url.username || url.password ||
    url.port || url.href !== source) {
    throw new Error(`Referencia histórica de fabricante inválida: ${locator}`);
  }
  return source;
};
const digest = (value) => createHash('sha256').update(value).digest('hex');
const numericMarkers = (value) => [...new Set(value.match(/\d+(?:[.,]\d+)*/gu) ?? [])].sort();
const unmatchedNumericMarkers = (source, destination) => {
  const current = new Set(numericMarkers(destination));
  return numericMarkers(source).filter((marker) => !current.has(marker));
};
const canonicalNumber = (value) => {
  let number = value.replace(/,/gu, '.');
  if (/^\d{1,3}(?:\.\d{3})+(?:\.\d+)?$/u.test(number)) {
    number = number.replace(/\.(?=\d{3}(?:\.|$))/gu, '');
  }
  const [integer, fractional] = number.split('.');
  const whole = integer.replace(/^0+(?=\d)/u, '');
  const decimal = fractional?.replace(/0+$/u, '') ?? '';
  return decimal ? `${whole}.${decimal}` : whole;
};
const normalizedMarkers = (value) => new Set(numericMarkers(value).map(canonicalNumber));
const hasNumericValue = (text, marker) => normalizedMarkers(text).has(canonicalNumber(marker));
const numericContent = (value) => typeof value === 'string' ? value : '';
export const inspectEditorialHistoryPreparedUnit = (record, result) => {
  const key = `${record.providerId}:${record.reference}`;
  if (!result?.product || !['ready', 'review'].includes(result.status)) {
    throw new Error(`Preparación editorial sin resultado válido: ${key}`);
  }
  const product = result.product;
  if (product.providerId !== record.providerId || product.reference !== record.reference) {
    throw new Error(`Preparación editorial con identidad de otra unidad: ${key}`);
  }
  if (!Array.isArray(result.issues) || !result.issues.every((issue) =>
    typeof issue === 'string' && issue.trim().length > 0)) {
    throw new Error(`Incidencias editoriales inválidas: ${key}`);
  }
  const hasContent = (value) => typeof value === 'string' && value.trim().length > 0;
  if (result.status === 'ready' && (!hasContent(product.title) || !hasContent(product.description) ||
    !hasContent(product.description_general))) {
    throw new Error(`Ficha ready sin textos comerciales completos: ${key}`);
  }
  if (result.status === 'ready' && result.issues.length !== 0) {
    throw new Error(`Ficha ready con incidencias editoriales: ${key}`);
  }
  if (result.status === 'review' && result.issues.length === 0) {
    throw new Error(`Ficha review sin incidencia acreditable: ${key}`);
  }
  return { status: result.status, issues: result.issues.length,
    reviewWithoutShort: result.status === 'review' && !hasContent(product.description),
    reviewWithoutGeneral: result.status === 'review' && !hasContent(product.description_general) };
};

const reconcileFallbackNumbers = (archived, published, record, prepared, facts) => {
  const originalMissing = unmatchedNumericMarkers(archived, published);
  const missing = originalMissing.filter((marker) => !hasNumericValue(published, marker));
  const formatting = originalMissing.filter((marker) => !missing.includes(marker));
  const technical = prepared.product.spec ?? {};
  const sellerReference = record.reference ?? '';
  const referenceNumber = numericMarkers(sellerReference);
  const sourceHeight = numericContent(record.specs?.['Altura de trabajo']);
  const publishedHeight = numericContent(technical['Altura de trabajo']);
  const sourcePlatform = numericContent(record.specs?.['Altura plataforma']);
  const publishedPlatform = numericContent(technical['Altura plataforma']);
  const archivedConflict = /(?:contradic|incompatib)/iu.test(archived) &&
    /altura de plataforma/iu.test(archived);
  const containsContradictoryHeight = archivedConflict && sourcePlatform &&
    numericMarkers(sourcePlatform).some((marker) => hasNumericValue(archived, marker));
  if (containsContradictoryHeight && numericMarkers(sourcePlatform).some((marker) =>
    hasNumericValue(published, marker) || hasNumericValue(publishedPlatform, marker))) {
    throw new Error(`Altura de plataforma contradictoria reintroducida: ${record.providerId}:${record.reference}`);
  }
  const evidence = missing.map((marker) => {
    if (sellerReference && archived.includes(sellerReference) &&
      referenceNumber.some((number) => canonicalNumber(number) === canonicalNumber(marker)) &&
      prepared.product.reference === sellerReference) {
      return { marker, basis: 'referencia_conservada_en_producto' };
    }
    if (containsContradictoryHeight && numericMarkers(sourcePlatform).some((number) =>
      canonicalNumber(number) === canonicalNumber(marker)) &&
      !hasNumericValue(publishedPlatform, marker)) {
      return { marker, basis: 'altura_de_plataforma_contradictoria_excluida' };
    }
    if (/altura (?:de trabajo|[^.]{0,70}campo de trabajo)/iu.test(archived) &&
      facts?.family === 'carretilla-elevadora' && facts.workingHeightM === null &&
      facts.liftingHeightM === null && sourceHeight && publishedHeight &&
      numericMarkers(sourceHeight).some((number) => canonicalNumber(number) === canonicalNumber(marker)) &&
      hasNumericValue(publishedHeight, marker)) {
      return { marker, basis: 'magnitud_en_spec_no_publicada_en_general' };
    }
    return { marker, basis: 'sin_conciliacion' };
  });
  const bases = [...new Set(evidence.map((item) => item.basis))];
  const category = originalMissing.length === 0 ? 'sin_diferencias_numericas' :
    missing.length === 0 ? 'solo_formato_numerico' :
    bases.length !== 1 ? 'sin_conciliacion' : bases[0];
  return { category, rawUnmatched: originalMissing, formatting, missing, evidence };
};
const keyFor = (...parts) => `K_${digest(JSON.stringify(parts)).slice(0, 24)}`;
const fields = ['short', 'general', 'title'];
const providers = ['gam', 'gomariz', 'mercaeleva'];
const stateNames = [
  'ACREDITADO_COMPARTIDO', 'ACREDITADO_ESPECIFICO', 'PENDIENTE_TRASLADO',
  'PENDIENTE_EQUIVALENCIA', 'BLOQUEADO_EVIDENCIA', 'NO_APLICABLE_JUSTIFICADO'
];

const entryKey = (file, rawKey) => rawKey.includes(':') ? rawKey : `${file.split('/').at(-2)}:${rawKey}`;

const archivedText = (raw, field) => {
  if (field === 'short') return [raw.revisedShort, raw.short, raw.description];
  return [raw[field]];
};

const makeItem = (kind, subject, field, text, other) => ({
  id: keyFor(kind, subject, field, text),
  nature: kind,
  subject,
  field,
  status: kind === 'signed_unit' ? 'PENDIENTE_EQUIVALENCIA' : 'BLOQUEADO_EVIDENCIA',
  ...other
});

export const buildEditorialHistoryInventory = ({ archives, indexed, migration, extraction, references, originals }) => {
  if (indexed.version !== 1 || migration.version !== 1 || extraction.version !== 1 ||
    !Array.isArray(indexed.entries) || !Array.isArray(migration.skipped) ||
    !Array.isArray(migration.sourceCoverage) || !Array.isArray(extraction.sources)) {
    throw new Error('Contratos históricos de conocimiento incompletos');
  }
  if (!Array.isArray(originals) || originals.length !== migration.originalRecords) {
    throw new Error('Censo de originales inconsistente con el informe de migración');
  }
  const originalKeys = new Map();
  for (const record of originals) {
    if (!providers.includes(record.providerId) || typeof record.reference !== 'string' || !record.reference.trim() ||
      typeof record.url !== 'string' || !record.url.trim()) {
      throw new Error('Identidad de unidad original inválida');
    }
    const key = `${record.providerId}:${record.reference}`;
    if (originalKeys.has(key)) throw new Error(`Identidad original repetida: ${key}`);
    originalKeys.set(key, record);
  }
  const sources = new Map();
  const archivedEntries = new Map();
  for (const { file, payload } of archives) {
    if (sources.has(file) || payload.version !== 1 || typeof payload.source !== 'string' ||
      !payload.exports || typeof payload.exports !== 'object' || Array.isArray(payload.exports)) {
      throw new Error(`Fuente histórica inválida o repetida: ${file}`);
    }
    sources.set(file, payload);
    for (const [exportName, collection] of Object.entries(payload.exports)) {
      if (!collection || typeof collection !== 'object' || Array.isArray(collection)) {
        throw new Error(`Exportación histórica inválida: ${file}#${exportName}`);
      }
      for (const [rawKey, raw] of Object.entries(collection)) {
        if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
          throw new Error(`Entrada histórica inválida: ${file}#${exportName}/${rawKey}`);
        }
        const locator = JSON.stringify([file, exportName, entryKey(file, rawKey)]);
        if (archivedEntries.has(locator)) throw new Error(`Localizador histórico duplicado: ${locator}`);
        archivedEntries.set(locator, { raw, rawKey, file, exportName, manufacturerSource: archivedManufacturerSource(raw, locator) });
      }
    }
  }
  if (sources.size !== migration.evidenceFiles || migration.sourceCoverage.length !== sources.size) {
    throw new Error('Número de fuentes históricas inconsistente con el informe de migración');
  }
  for (const source of migration.sourceCoverage) {
    if (!sources.has(source.file)) throw new Error(`Fuente del informe ausente: ${source.file}`);
  }
  const items = new Map();
  const acceptedCounts = new Map();
  const skippedCounts = new Map();
  const acceptedLocators = new Set();
  const skippedLocators = new Set();
  for (const entry of indexed.entries) {
    const locator = JSON.stringify([entry.evidenceSource, entry.exportName, entry.key]);
    const original = archivedEntries.get(locator);
    if (!original) throw new Error(`Conocimiento firmado sin origen archivado: ${locator}`);
    if (acceptedLocators.has(locator)) throw new Error(`Conocimiento firmado duplicado: ${locator}`);
    const record = originalKeys.get(entry.key);
    if (!record || record.url !== entry.sourceUrl || (record.brand ?? '') !== entry.brand || (record.model ?? '') !== entry.model) {
      throw new Error(`Firma sin identidad en originales actuales: ${entry.key}`);
    }
    acceptedLocators.add(locator);
    acceptedCounts.set(entry.evidenceSource, (acceptedCounts.get(entry.evidenceSource) ?? 0) + 1);
    for (const field of fields) {
      const value = entry[field];
      if (value === null || value === undefined) continue;
      if (typeof value !== 'string' || !value.trim() || !archivedText(original.raw, field).some((candidate) =>
        typeof candidate === 'string' && canonicalText(candidate) === canonicalText(value))) {
        throw new Error(`Afirmación firmada sin correspondencia histórica: ${locator}/${field}`);
      }
      const normalized = canonicalText(value);
      const item = makeItem('signed_unit', entry.key, field, normalized, {
        value: normalized, scope: 'unit',
        owner: 'src/preparation/shared/editorial/domain/editorial-knowledge.ts',
        consumer: 'src/preparation/shared/editorial/mapping/knowledge-editorial.ts',
        sourceUrl: entry.sourceUrl,
        sourceDigest: entry.sourceDigest,
        conditions: { brand: entry.brand, model: entry.model },
        reason: 'consumo_productivo_y_exclusiones_todavia_por_acreditar',
        sources: []
      });
      const previous = items.get(item.id);
      if (previous && (previous.nature !== item.nature || previous.subject !== item.subject ||
        previous.field !== item.field || previous.sourceDigest !== item.sourceDigest ||
        previous.sourceUrl !== item.sourceUrl)) {
        throw new Error(`Colisión de identidad histórica: ${item.id}`);
      }
      const target = previous ?? item;
      target.sources.push({ file: entry.evidenceSource, exportName: entry.exportName, key: original.rawKey,
        priority: entry.priority, usage: entry.usage ?? 'primary', identityOverride: entry.identityOverride === true,
        selection: null, role: field === 'general' && entry.usage === 'fallback' ? 'fallbackGeneral' : field,
        selectedInstead: null, archivedManufacturerSource: original.manufacturerSource });
      items.set(item.id, target);
    }
  }
  if (acceptedLocators.size !== migration.verifiedEntries ||
    new Set(indexed.entries.map((entry) => entry.key)).size !== migration.verifiedUnits ||
    indexed.entries.filter((entry) => entry.short || entry.general).length !== migration.verifiedTextEntries ||
    indexed.entries.filter((entry) => entry.title).length !== migration.verifiedTitles) {
    throw new Error('Las entradas aceptadas no coinciden con el informe de migración');
  }
  for (const discarded of migration.skipped) {
    const alternatives = [...archivedEntries.entries()].filter(([, item]) =>
      item.file === discarded.source && entryKey(item.file, item.rawKey) === discarded.key);
    if (alternatives.length === 0) throw new Error(`Descarte sin fuente histórica: ${discarded.source}/${discarded.key}`);
    const matching = alternatives.filter(([locator]) => !acceptedLocators.has(locator) && !skippedLocators.has(locator));
    if (matching.length !== 1) throw new Error(`Descarte ambiguo o duplicado: ${discarded.source}/${discarded.key}`);
    const [locator, original] = matching[0];
    skippedLocators.add(locator);
    skippedCounts.set(discarded.source, (skippedCounts.get(discarded.source) ?? 0) + 1);
    const currentlyPresent = originalKeys.has(discarded.key);
    const item = makeItem('excluded_unit', discarded.key, original.exportName, locator, {
      status: currentlyPresent ? 'BLOQUEADO_EVIDENCIA' : 'NO_APLICABLE_JUSTIFICADO',
      reason: discarded.reason,
      exclusionBasis: currentlyPresent ? 'unidad_actual_sin_procedencia_firmada' : 'unidad_ausente_en_originales_actuales',
      owner: null, consumer: null,
      sources: [{ file: original.file, exportName: original.exportName, key: original.rawKey,
        archivedManufacturerSource: original.manufacturerSource }]
    });
    items.set(item.id, item);
  }
  if (skippedLocators.size !== migration.skippedEntries) {
    throw new Error('Los descartes no coinciden con el informe de migración');
  }
  for (const source of migration.sourceCoverage) {
    if ((acceptedCounts.get(source.file) ?? 0) !== source.matched ||
      (skippedCounts.get(source.file) ?? 0) !== source.skipped) {
      throw new Error(`Cobertura histórica desincronizada: ${source.file}`);
    }
  }
  if (acceptedLocators.size + skippedLocators.size !== archivedEntries.size) {
    throw new Error('Hay entradas históricas sin clasificar');
  }
  const extractionSources = new Map(extraction.sources.map((source) => [source.source, source]));
  if (extractionSources.size !== extraction.sources.length) throw new Error('Orígenes de extracción duplicados');
  const unconverted = [];
  for (const source of extraction.sources) {
    const related = archives.filter(({ payload }) => payload.source === source.source);
    for (const symbol of source.converted) {
      if (!related.some(({ payload }) => Object.hasOwn(payload.exports, symbol))) {
        throw new Error(`Exportación convertida sin archivo: ${source.source}#${symbol}`);
      }
    }
    for (const rejected of source.rejected) {
      const item = makeItem('unconverted_symbol', source.source, rejected.symbol, '', {
        reason: rejected.reason, owner: null, consumer: null,
        sources: [{ file: source.source, exportName: rejected.symbol }]
      });
      items.set(item.id, item);
      unconverted.push(item.id);
    }
  }
  const indexedByKey = new Map();
  for (const entry of indexed.entries) {
    const group = indexedByKey.get(entry.key) ?? [];
    group.push(entry);
    indexedByKey.set(entry.key, group);
  }
  const precedence = { selected: 0, equivalent: 0, displaced: 0 };
  for (const group of indexedByKey.values()) {
    group.sort((a, b) => b.priority - a.priority || a.evidenceSource.localeCompare(b.evidenceSource));
    for (const entry of group) {
      for (const field of fields) {
        if (typeof entry[field] !== 'string' || !entry[field].trim()) continue;
        const role = field === 'general' && entry.usage === 'fallback' ? 'fallbackGeneral' : field;
        const winner = group.find((candidate) =>
          (field !== 'general' || (candidate.usage === 'fallback') === (role === 'fallbackGeneral')) &&
          typeof candidate[field] === 'string' && candidate[field].trim());
        if (!winner) throw new Error(`Campo firmado sin precedencia: ${entry.key}/${role}`);
        const id = keyFor('signed_unit', entry.key, field, canonicalText(entry[field]));
        const item = items.get(id);
        const origin = item?.sources.find((source) => source.file === entry.evidenceSource &&
          source.exportName === entry.exportName && source.role === role);
        if (!origin || origin.selection !== null) throw new Error(`Procedencia sin conciliación: ${entry.key}/${role}`);
        origin.selection = entry === winner ? 'selected' :
          canonicalText(entry[field]) === canonicalText(winner[field]) ? 'equivalent' : 'displaced';
        if (origin.selection === 'displaced') {
          origin.selectedInstead = keyFor('signed_unit', entry.key, field, canonicalText(winner[field]));
        }
        precedence[origin.selection]++;
      }
    }
  }
  if (precedence.selected + precedence.equivalent + precedence.displaced !==
    indexed.entries.reduce((sum, entry) => sum + fields.filter((field) => entry[field]).length, 0)) {
    throw new Error('Conciliación de precedencias incompleta');
  }
  const supplementalSources = [...sources.entries()]
    .filter(([, payload]) => !extractionSources.has(payload.source))
    .map(([file]) => file).sort();
  for (const item of items.values()) item.sources.sort((a, b) =>
    [a.file, a.exportName, a.key].join('|').localeCompare([b.file, b.exportName, b.key].join('|')));
  const entries = [...items.values()].sort((a, b) => a.id.localeCompare(b.id));
  const states = Object.fromEntries(stateNames.map((name) => [name, entries.filter((entry) => entry.status === name).length]));
  const slots = new Map();
  for (const item of entries.filter((entry) => entry.nature === 'signed_unit')) {
    const slot = JSON.stringify([item.subject, item.field]);
    const group = slots.get(slot) ?? [];
    group.push(item.id);
    slots.set(slot, group);
  }
  const alternativeExpressions = [...slots.entries()].filter(([, ids]) => ids.length > 1)
    .map(([slot, ids]) => ({ subject: JSON.parse(slot)[0], field: JSON.parse(slot)[1], items: ids }))
    .sort((a, b) => `${a.subject}|${a.field}`.localeCompare(`${b.subject}|${b.field}`));
  const citations = [...archivedEntries.entries()].filter(([, entry]) => entry.manufacturerSource !== null);
  const manufacturerSources = {
    archived: citations.length,
    indexed: citations.filter(([locator]) => acceptedLocators.has(locator)).length,
    excluded: citations.filter(([locator]) => skippedLocators.has(locator)).length,
    distinctUrls: new Set(citations.map(([, entry]) => entry.manufacturerSource)).size,
    priorityPlatform: citations.filter(([, entry]) =>
      entry.file === 'data/editorial/evidence/legacy/mercaeleva/priority-platform-generals.json').length,
    currentVerification: false
  };
  if (manufacturerSources.indexed + manufacturerSources.excluded !== manufacturerSources.archived) {
    throw new Error('Referencias históricas de fabricante sin correspondencia de extracción');
  }
  const sourceCoverage = migration.sourceCoverage.map((source) => ({
    file: source.file, acceptedEntries: source.matched, rejectedEntries: source.skipped,
    distinctSignedItems: entries.filter((item) => item.nature === 'signed_unit' &&
      item.sources.some((origin) => origin.file === source.file)).length
  })).sort((a, b) => a.file.localeCompare(b.file));
  const totals = {
    sources: archives.length, originalRecords: originals.length, supplementalSources: supplementalSources.length, historicalExports: archivedEntries.size,
    acceptedEntries: acceptedLocators.size, rejectedEntries: skippedLocators.size,
    unconvertedSymbols: unconverted.length, discovered: entries.length,
    signedKnowledge: entries.filter((item) => item.nature === 'signed_unit').length,
    signedUnitFields: slots.size, alternativeExpressionSlots: alternativeExpressions.length,
    excludedAbsentFromOriginals: entries.filter((item) => item.nature === 'excluded_unit' &&
      item.status === 'NO_APLICABLE_JUSTIFICADO').length,
    precedence, states, manufacturerSources
  };
  const indexCoverage = {
    consensusModels: references.consensus.entries.length,
    consensusMetrics: references.consensus.entries.reduce((sum, item) => sum + Object.keys(item.stable).length, 0),
    technicalModelReferences: references.technical.entries.length,
    manufacturerModels: references.manufacturer.entries.length,
    familyGuidance: Object.keys(references.family.entries).length
  };
  return { version: 1, universe: 'fuentes_legacy_conservadas_y_extraccion_registrada',
    exhaustiveSemanticEquivalence: false, deduplication: 'misma_unidad_campo_y_texto_normalizado',
    totals, sourceCoverage, supplementalSources, alternativeExpressions, indexCoverage, entries };
};

export const loadEditorialHistoryInventory = (root) => {
  const read = (path) => JSON.parse(readFileSync(join(root, path), 'utf8'));
  const folder = 'data/editorial/evidence/legacy';
  const files = [];
  const collect = (directory) => {
    for (const entry of readdirSync(join(root, directory), { withFileTypes: true })) {
      const file = `${directory}/${entry.name}`;
      if (entry.isDirectory()) collect(file);
      else if (entry.isFile() && entry.name.endsWith('.json')) files.push(file);
    }
  };
  collect(folder);
  files.sort();
  const archives = files.map((file) => ({ file, payload: read(file) }));
  for (const { file, payload } of archives) {
    if (existsSync(join(root, payload.source))) {
      const sourceDigest = digest(readFileSync(join(root, payload.source)));
      if (sourceDigest !== payload.sourceSha256) throw new Error(`Origen histórico modificado: ${file}`);
    }
    if (payload.archivedExportsSha256 && digest(JSON.stringify(payload.exports)) !== payload.archivedExportsSha256) {
      throw new Error(`Archivo de exportaciones modificado: ${file}`);
    }
  }
  return buildEditorialHistoryInventory({
    archives,
    indexed: read('data/editorial/knowledge/verified-units.json'),
    migration: read('data/editorial/knowledge/migration-report.json'),
    extraction: read('data/editorial/legacy-evidence-extraction.json'),
    originals: providers.flatMap((provider) => read(`catalogs/providers/${provider}/original/scrape-${provider}-catalog.json`).products),
    references: {
      consensus: read('data/editorial/knowledge/model-consensus.json'),
      technical: read('data/editorial/knowledge/model-technical-references.json'),
      manufacturer: read('data/editorial/knowledge/manufacturer-models.json'),
      family: read('data/editorial/knowledge/family-guidance.json')
    }
  });
};

export const accreditEditorialHistoryConsumption = (inventory, originals, { digestUnit, resolveUnit, prepareUnit, resolveFacts }) => {
  if (typeof resolveFacts !== 'function') throw new Error('Resolver semántico compartido ausente');
  if (!Array.isArray(originals) || originals.length !== inventory.totals.originalRecords || !Array.isArray(inventory.entries) ||
    inventory.totals.discovered !== inventory.entries.length) {
    throw new Error('Censo productivo o inventario histórico incompleto');
  }
  const byKey = new Map();
  for (const record of originals) {
    const key = `${record.providerId}:${record.reference}`;
    if (byKey.has(key)) throw new Error(`Unidad repetida en acreditación: ${key}`);
    byKey.set(key, record);
  }
  const signed = inventory.entries.filter((item) => item.nature === 'signed_unit');
  const signedById = new Map(signed.map((item) => [item.id, item]));
  const mapped = new Map();
  for (const item of signed) {
    if (item.scope !== 'unit') throw new Error(`Firma sin alcance específico de unidad: ${item.subject}/${item.field}`);
    const record = byKey.get(item.subject);
    if (!record || record.url !== item.sourceUrl || digestUnit(record) !== item.sourceDigest) {
      throw new Error(`Firma sin huella productiva válida: ${item.subject}/${item.field}`);
    }
    if (!mapped.has(item.subject)) mapped.set(item.subject, resolveUnit(record, record));
    const selected = mapped.get(item.subject);
    for (const source of item.sources) {
      const winner = source.selection === 'displaced' ? signedById.get(source.selectedInstead) : item;
      if (!winner || canonicalText(selected[source.role] ?? '') !== winner.value) {
        throw new Error(`Selección productiva distinta de la precedencia firmada: ${item.subject}/${source.role}`);
      }
    }
  }
  const prepared = new Map();
  const catalog = { originals: 0, ready: 0, review: 0 };
  const catalogDetails = Object.fromEntries(providers.map((provider) => [provider, {
    originals: 0, ready: 0, review: 0, issues: 0, reviewWithoutShort: 0, reviewWithoutGeneral: 0
  }]));
  for (const record of originals) {
    const key = `${record.providerId}:${record.reference}`;
    const result = prepareUnit(record);
    const finding = inspectEditorialHistoryPreparedUnit(record, result);
    const provider = catalogDetails[record.providerId];
    if (!provider) throw new Error(`Proveedor ajeno al censo histórico: ${key}`);
    prepared.set(key, result);
    catalog.originals++;
    catalog[finding.status]++;
    provider.originals++;
    provider[finding.status]++;
    provider.issues += finding.issues;
    if (finding.reviewWithoutShort) provider.reviewWithoutShort++;
    if (finding.reviewWithoutGeneral) provider.reviewWithoutGeneral++;
  }
  const fallbackCategories = [
    'sin_diferencias_numericas', 'solo_formato_numerico', 'referencia_conservada_en_producto',
    'magnitud_en_spec_no_publicada_en_general', 'altura_de_plataforma_contradictoria_excluida',
    'sin_conciliacion'
  ];
  const outcomes = { finalExact: 0, finalUnitNormalized: 0, composedInsteadOfFallback: 0,
    displacedBySignedPriority: 0, supersededWithVerifiedWinner: 0, supersededPending: 0,
    fallbackWithUnmatchedNumericMarkers: 0, fallbackDiscardedWithEvidence: 0, fallbackUnitFactsAccredited: 0, fallbackNumeric: Object.fromEntries(fallbackCategories.map((name) => [name, 0])),
    fallbackMeaning: { reproduced: 0, unreproduced: 0, blocking: 0, supportedModelClaims: 0,
      unsupportedModelClaims: 0, unverifiedModelPublications: 0, signals: {} },
    fallbackTechnical: { published: 0, structured: 0, excluded: 0, modelOnly: 0, unsupported: 0, blocking: 0, concepts: {} },
    unresolved: 0, verifiedSelections: 0, signedSubjects: 0 };
  const subjects = new Set();
  const entries = inventory.entries.map((item) => {
    if (item.nature !== 'signed_unit') return { ...item };
    subjects.add(item.subject);
    const sources = item.sources.filter((source) => source.selection === 'selected');
    if (sources.length === 0) {
      outcomes.displacedBySignedPriority++;
      return { ...item, status: 'PENDIENTE_EQUIVALENCIA', reason: 'alternativa_conservada_desplazada_por_precedencia',
        consumption: { result: 'displaced_by_signed_priority', selectedRoles: [] } };
    }
    if (sources.length !== 1) throw new Error(`Selecciones múltiples sin resolver: ${item.subject}/${item.field}`);
    const role = sources[0].role;
    outcomes.verifiedSelections++;
    const result = prepared.get(item.subject);
    const rawFinal = role === 'short' ? result.product.description : role === 'title' ? result.product.title :
      result.product.description_general;
    const final = canonicalText(rawFinal ?? '');
    if (final === item.value) {
      outcomes.finalExact++;
      return { ...item, status: 'ACREDITADO_ESPECIFICO', reason: 'firma_de_unidad_y_preparacion_literal_acreditadas',
        consumption: { result: 'final_exact', selectedRoles: [role] } };
    }
    if (final === item.value.replace(/(\d) KG\b/gu, '$1 kg')) {
      outcomes.finalUnitNormalized++;
      return { ...item, status: 'ACREDITADO_ESPECIFICO', reason: 'firma_de_unidad_y_preparacion_con_kg_normalizado',
        consumption: { result: 'final_unit_normalized', selectedRoles: [role] } };
    }
    if (role === 'fallbackGeneral' && final) {
      outcomes.composedInsteadOfFallback++;
      const record = byKey.get(item.subject);
      const facts = resolveFacts(record);
      const numbers = reconcileFallbackNumbers(item.value, final, record, result, facts);
      const meaning = inspectArchivedFallbackMeaning(item.value, final, record, result, facts,
        mapped.get(item.subject)?.modelReference ?? null);
      outcomes.fallbackMeaning.reproduced += meaning.reproduced;
      outcomes.fallbackMeaning.unreproduced += meaning.unreproduced;
      outcomes.fallbackMeaning.blocking += meaning.blocking;
      outcomes.fallbackMeaning.supportedModelClaims += meaning.supportedModelClaims;
      outcomes.fallbackMeaning.unsupportedModelClaims += meaning.unsupportedModelClaims;
      outcomes.fallbackMeaning.unverifiedModelPublications += meaning.unverifiedModelPublications;
      for (const signal of meaning.signals) {
        const summary = outcomes.fallbackMeaning.signals[signal.name] ?? { reproduced: 0, unreproduced: 0 };
        summary[signal.reproduced ? 'reproduced' : 'unreproduced']++;
        outcomes.fallbackMeaning.signals[signal.name] = summary;
      }
      const technical = inspectArchivedFallbackTechnical(item.value, final, record, result,
        mapped.get(item.subject)?.modelReference ?? null);
      for (const counter of ['published', 'structured', 'excluded', 'modelOnly', 'unsupported', 'blocking']) {
        outcomes.fallbackTechnical[counter] += technical[counter];
      }
      for (const signal of technical.signals) {
        const counts = outcomes.fallbackTechnical.concepts[signal.concept] ?? {};
        counts[signal.result] = (counts[signal.result] ?? 0) + 1;
        outcomes.fallbackTechnical.concepts[signal.concept] = counts;
      }
      outcomes.fallbackNumeric[numbers.category]++;
      if (numbers.rawUnmatched.length > 0) outcomes.fallbackWithUnmatchedNumericMarkers++;
      const discardedWithEvidence = justifiesDiscardedFallback(numbers, meaning, technical);
      if (discardedWithEvidence) outcomes.fallbackDiscardedWithEvidence++;
      const factsPreserved = !discardedWithEvidence && (preservesArchivedFallbackUnitFacts(item.value,
        record, result, numbers, meaning, technical, item, mapped.get(item.subject)?.modelReference ?? null) || preservesArchivedFallbackModuleFacts(item.value,
        record, result, numbers, meaning, technical, item));
      if (factsPreserved) outcomes.fallbackUnitFactsAccredited++;
      return { ...item, status: discardedWithEvidence ? 'NO_APLICABLE_JUSTIFICADO' :
        factsPreserved ? 'ACREDITADO_ESPECIFICO' : 'PENDIENTE_EQUIVALENCIA',
        reason: discardedWithEvidence ? 'respaldo_obsoleto_con_altura_contradictoria_excluida_y_resto_de_magnitudes_conservadas' :
          factsPreserved ? 'hechos_de_unidad_conservados_con_concepto_y_cautelas_acreditados' :
            'general_de_respaldo_sustituida_por_composicion',
        consumption: { result: 'composed_instead_of_fallback', selectedRoles: [role],
          discardedWithEvidence, factsPreserved, unmatchedNumericMarkers: numbers.rawUnmatched, numericReconciliation: numbers,
          meaningReconciliation: meaning, technicalReconciliation: technical } };
    }
    outcomes.unresolved++;
    return { ...item, status: 'PENDIENTE_EQUIVALENCIA', reason: 'diferencia_entre_texto_firmado_y_salida_productiva',
      consumption: { result: 'unresolved', selectedRoles: [role] } };
  });
  const credited = new Map(entries.filter((item) => item.nature === 'signed_unit').map((item) => [item.id, item]));
  const reconciled = entries.map((item) => {
    if (item.consumption?.result !== 'displaced_by_signed_priority') return item;
    const winners = [...new Set(item.sources.map((source) => source.selectedInstead))];
    const winner = winners.length === 1 ? credited.get(winners[0]) : null;
    const unmatched = winner ? unmatchedNumericMarkers(item.value, winner.value) : numericMarkers(item.value);
    const justified = Boolean(winner && winner.subject === item.subject && winner.field === item.field &&
      winner.status === 'ACREDITADO_ESPECIFICO' && winner.sources.some((source) =>
        source.selection === 'selected' && item.sources.every((origin) => origin.role === source.role)) &&
      unmatched.length === 0 && preservesEditorialSupersession(item.value, winner.value,
        byKey.get(item.subject), prepared.get(item.subject)));
    if (justified) outcomes.supersededWithVerifiedWinner++;
    else outcomes.supersededPending++;
    return { ...item, status: justified ? 'NO_APLICABLE_JUSTIFICADO' : 'PENDIENTE_EQUIVALENCIA',
      reason: justified ? 'alternativa_conservada_desplazada_por_firma_preparada_sin_marcadores_numericos_exclusivos' :
        'precedencia_sin_justificacion_suficiente',
      consumption: { ...item.consumption, replacedBy: winner?.id ?? null,
        verifiedPublishedReplacement: justified, unmatchedNumericMarkers: unmatched } };
  });
  outcomes.signedSubjects = subjects.size;
  if (outcomes.verifiedSelections !== inventory.totals.precedence.selected ||
    outcomes.displacedBySignedPriority !== inventory.totals.precedence.displaced ||
    outcomes.finalExact + outcomes.finalUnitNormalized + outcomes.composedInsteadOfFallback +
    outcomes.unresolved !== outcomes.verifiedSelections) {
    throw new Error('Acreditación de consumo sin reconciliación completa');
  }
  if (outcomes.supersededWithVerifiedWinner + outcomes.supersededPending !== outcomes.displacedBySignedPriority) {
    throw new Error('Sustituciones históricas sin conciliación');
  }
  if (Object.values(outcomes.fallbackNumeric).reduce((sum, count) => sum + count, 0) !==
    outcomes.composedInsteadOfFallback) {
    throw new Error('Diagnóstico numérico de respaldos incompleto');
  }
  const states = Object.fromEntries(stateNames.map((name) =>
    [name, reconciled.filter((entry) => entry.status === name).length]));
  return { ...inventory, entries: reconciled, totals: { ...inventory.totals, states,
    runtime: { ...outcomes, catalog, catalogDetails } } };
};
