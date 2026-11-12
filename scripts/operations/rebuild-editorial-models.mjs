import { readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { resolveEditorialFacts } from '../../dist/preparation/shared/editorial/domain/editorial-facts.js';

const root = resolve(fileURLToPath(new URL('../..', import.meta.url)));
const read = (path) => JSON.parse(readFileSync(join(root, path), 'utf8'));
const fold = (value) => String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/gu, '').trim().toLowerCase();
const metrics = ['workingHeightM', 'platformHeightM', 'lateralReachM', 'liftingHeightM', 'loadCapacityKg', 'voltageV', 'powerKva', 'gradeabilityPercent', 'energy'];
const grouped = new Map();
for (const provider of ['gam', 'gomariz', 'mercaeleva']) {
  const catalog = read(`catalogs/providers/${provider}/original/scrape-${provider}-catalog.json`);
  for (const record of catalog.products) {
    const facts = resolveEditorialFacts(record);
    if (!facts || !record.reference) continue;
    const key = [fold(facts.brand), fold(facts.model), facts.family].join('|');
    const group = grouped.get(key) ?? [];
    group.push({ reference: `${record.providerId}:${record.reference}`, url: record.url, facts });
    grouped.set(key, group);
  }
}
const entries = [];
for (const records of grouped.values()) {
  if (records.length < 2) continue;
  const first = records[0];
  const stable = {};
  for (const name of metrics) {
    const found = records.map(({ facts }) => facts[name]).filter((value) => value !== null);
    if (found.length < 2 || new Set(found).size !== 1) continue;
    stable[name] = found[0];
  }
  if (!Object.keys(stable).length || !first) continue;
  entries.push({ brand: first.facts.brand, model: first.facts.model, family: first.facts.family,
    samples: records.length, catalogReferences: records.map(({ reference }) => reference), stable });
}
entries.sort((a, b) => [a.brand, a.model, a.family].join('|').localeCompare([b.brand, b.model, b.family].join('|')));
const output = JSON.stringify({ version: 1, criterion: 'minimo_dos_fichas_y_ausencia_de_contradicciones_entre_las_fichas_que_declaran_la_magnitud', entries }, null, 2) + '\n';
const path = join(root, 'data/editorial/knowledge/model-consensus.json');
if (process.argv.includes('--check')) {
  if (readFileSync(path, 'utf8') !== output) throw Error('Consensos editoriales de modelo desactualizados');
} else writeFileSync(path, output);
console.log(`PASS | CONSENSO MODELOS | ${entries.length} modelos · ${entries.reduce((sum, item) => sum + Object.keys(item.stable).length, 0)} magnitudes corroboradas`);
