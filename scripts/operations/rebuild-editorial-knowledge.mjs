import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

const root = resolve(fileURLToPath(new URL('../..', import.meta.url)));
const read = (path) => JSON.parse(readFileSync(join(root, path), 'utf8'));
const sha = (value) => createHash('sha256').update(value).digest('hex');
const fold = (value) => String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/gu, '').trim().toLowerCase();
const fields = [
  'url', 'title', 'brand', 'model', 'externalReference', 'condition', 'categoryKey',
  'year', 'horometer', 'shortDescription', 'longDescription', 'specs'
];
const sourceDigest = (record) => sha(JSON.stringify(Object.fromEntries(fields.filter((field) => record[field] !== undefined)
  .map((field) => [field, record[field]]))));
const providers = ['gam', 'gomariz', 'mercaeleva'];
const originals = providers.flatMap((provider) => read(`catalogs/providers/${provider}/original/scrape-${provider}-catalog.json`).products);
const byKey = new Map(originals.filter((item) => item.reference).map((item) => [`${item.providerId}:${item.reference}`, item]));
const files = [];
const collect = (dir) => {
  for (const name of readdirSync(join(root, dir), { withFileTypes: true })) {
    const path = `${dir}/${name.name}`;
    if (name.isDirectory()) collect(path);
    else if (name.name.endsWith('.json')) files.push(path);
  }
};
collect('data/editorial/evidence/legacy');
files.sort();
const entries = [];
const ignored = [];
const sources = new Set();
const matchSubset = (record, source) => Object.entries(source).every(([key, value]) =>
  JSON.stringify(record[key]) === JSON.stringify(value));
const sourceMatches = (record, entry) => {
  if (typeof entry.sourceDigest === 'string') return entry.sourceDigest === sourceDigest(record) && entry.sourceUrl === record.url;
  if (typeof entry.sourceHash === 'string') return record.providerId === 'gam' && record.condition === 'Nuevo' &&
    record.url === entry.url && record.title === entry.title && record.categoryKey === entry.categoryKey &&
    record.brand === entry.brand && record.model === entry.model && record.externalReference === entry.model &&
    record.longDescription && sha(record.longDescription.trim()) === entry.sourceHash &&
    Object.keys(record.specs ?? {}).length === Object.keys(entry.sourceSpecs ?? {}).length &&
    matchSubset(record.specs ?? {}, entry.sourceSpecs ?? {});
  if (entry.source && typeof entry.source === 'object' && !Array.isArray(entry.source)) {
    return entry.source.url === record.url && Object.keys(entry.source).length >= 5 && matchSubset(record, entry.source);
  }
  return false;
};
const priority = (file) => file.includes('/shared/verified-canonical-brief') ? 70 :
  file.includes('/shared/verified-editorial-closure') ? 65 :
    file.includes('/shared/verified-unit-summary') ? 60 :
      file.includes('/shared/') ? 55 :
        file.includes('/verified-') ? 45 : 30;
for (const file of files) {
  const payload = read(file);
  if (payload.version !== 1 || typeof payload.source !== 'string' ||
    typeof payload.sourceSha256 !== 'string' ||
    sha(readFileSync(join(root, payload.source))) !== payload.sourceSha256 ||
    !payload.exports || typeof payload.exports !== 'object') {
    throw new Error(`Evidencia editorial de origen alterada: ${file}`);
  }
  for (const [exportName, records] of Object.entries(payload.exports)) {
    for (const [key, raw] of Object.entries(records)) {
      const prefix = file.split('/').at(-2);
      const candidateKey = key.includes(':') ? key : `${prefix}:${key}`;
      const record = byKey.get(candidateKey);
      const signedIncompleteIdentity = record && (!record.brand || !record.model) &&
        typeof raw.sourceDigest === 'string' && raw.sourceUrl === record.url;
      const identified = record && typeof raw === 'object' && raw !== null && !Array.isArray(raw) &&
        sourceMatches(record, raw) && (!raw.brand || fold(raw.brand) === fold(record.brand)) &&
        (!raw.model || fold(raw.model) === fold(record.model)) &&
        (record.brand && record.model || signedIncompleteIdentity);
      if (!identified) {
        ignored.push({ key: candidateKey, source: file, reason: 'procedencia_insuficiente_o_no_coincidente' });
        continue;
      }
      const short = typeof raw.revisedShort === 'string' && raw.originalShort === record.shortDescription ? raw.revisedShort :
        typeof raw.short === 'string' ? raw.short : null;
      const general = typeof raw.general === 'string' ? raw.general : null;
      const title = typeof raw.sourceDigest === 'string' && typeof raw.title === 'string' && raw.title.trim() ? raw.title : null;
      if (!short && !general && !title) {
        ignored.push({ key: candidateKey, source: file, reason: 'sin_texto_tras_validacion' });
        continue;
      }
      entries.push({ key: candidateKey, brand: record.brand ?? '', model: record.model ?? '', sourceUrl: record.url,
        sourceDigest: sourceDigest(record), short, general, title, evidenceSource: file, exportName, priority: priority(file),
        ...((raw.identityOverride === true || signedIncompleteIdentity) && typeof raw.sourceDigest === 'string' ? { identityOverride: true } : {}) });
      sources.add(file);
    }
  }
}
entries.sort((a, b) => a.key.localeCompare(b.key) || b.priority - a.priority || a.evidenceSource.localeCompare(b.evidenceSource));
const unitData = { version: 1, provenance: 'coincidencia_sha256_con_registro_original', entries };
const sourceCoverage = files.map((file) => ({ file, matched: entries.filter((item) => item.evidenceSource === file).length,
  skipped: ignored.filter((item) => item.source === file).length }));
const report = { version: 1, originalRecords: originals.length, evidenceFiles: files.length, migratedFiles: sources.size,
  sourceCoverage,
  verifiedEntries: entries.length, verifiedTextEntries: entries.filter((item) => item.short || item.general).length, verifiedTitles: entries.filter((item) => item.title).length, verifiedUnits: new Set(entries.map((item) => item.key)).size,
  skippedEntries: ignored.length, skipped: ignored };
const emit = (name, content) => {
  const path = join(root, `data/editorial/knowledge/${name}`);
  const json = JSON.stringify(content, null, 2) + '\n';
  if (process.argv.includes('--check')) {
    if (readFileSync(path, 'utf8') !== json) throw Error(`Evidencia fuera de sincronía: ${relative(root, path)}`);
  } else writeFileSync(path, json);
};
emit('verified-units.json', unitData);
emit('migration-report.json', report);
if (process.argv.includes('--check')) console.log(`PASS | CONOCIMIENTO EDITORIAL | ${files.length} fuentes · ${report.verifiedTextEntries} textos · ${report.verifiedTitles} títulos coincidentes · ${report.verifiedUnits} unidades`);
else console.log(`GENERADO | CONOCIMIENTO EDITORIAL | ${files.length} fuentes · ${report.verifiedTextEntries} textos · ${report.verifiedTitles} títulos coincidentes · ${report.verifiedUnits} unidades`);
