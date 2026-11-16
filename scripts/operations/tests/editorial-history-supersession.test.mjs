import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadEditorialHistoryInventory } from '../editorial-history-inventory.mjs';
import { preservesEditorialSupersession } from '../editorial-history-supersession.mjs';

const root = resolve(fileURLToPath(new URL('../../..', import.meta.url)));
const inventory = loadEditorialHistoryInventory(root);
const indexed = new Map(inventory.entries.map((item) => [item.id, item]));
const originals = new Map(['gam', 'gomariz', 'mercaeleva'].flatMap((provider) => {
  const catalog = JSON.parse(readFileSync(resolve(root,
    `catalogs/providers/${provider}/original/scrape-${provider}-catalog.json`), 'utf8'));
  return catalog.products.map((product) => [`${product.providerId}:${product.reference}`, product]);
}));
const compare = (subject, changes = {}) => {
  const previous = inventory.entries.find((item) => item.subject === subject &&
    item.sources.some((source) => source.selection === 'displaced'));
  assert.ok(previous, subject);
  const selected = indexed.get(previous.sources.find((source) => source.selection === 'displaced').selectedInstead);
  assert.ok(selected, subject);
  const original = originals.get(subject);
  const prepared = { product: { title: original.title, model: original.model } };
  return preservesEditorialSupersession(changes.previous ?? previous.value,
    changes.selected ?? selected.value, original, changes.prepared ?? prepared);
};

test('las 39 alternativas conservan unidades técnicas, lecturas de horas y identidad', () => {
  const displaced = inventory.entries.filter((item) => item.sources.some((source) => source.selection === 'displaced'));
  assert.equal(displaced.length, 39);
  for (const item of displaced) assert.equal(compare(item.subject), true, item.subject);
});

test('una cifra histórica trasladada a una magnitud diferente impide la justificación', () => {
  const subject = 'mercaeleva:M346-8712';
  const item = inventory.entries.find((entry) => entry.subject === subject &&
    entry.sources.some((source) => source.selection === 'displaced'));
  const selected = indexed.get(item.sources[0].selectedInstead);
  assert.ok(selected.value.includes('24 V'));
  assert.equal(compare(subject, { selected: selected.value.replaceAll('24 V', '24 kg') }), false);
});

test('las dos lecturas de horómetro deben mantener su naturaleza y cautela', () => {
  const subject = 'mercaeleva:M342-3553';
  const item = inventory.entries.find((entry) => entry.subject === subject &&
    entry.sources.some((source) => source.selection === 'displaced'));
  const selected = indexed.get(item.sources[0].selectedInstead).value;
  assert.equal(compare(subject), true);
  assert.equal(compare(subject, { selected: selected.replace('2.278 horas', '2.278 kg') }), false);
  assert.equal(compare(subject, { selected: selected.replace('2.276 h', '2.276 m') }), false);
  assert.equal(compare(subject, { selected: selected.replace('discrepancia de uso', 'uso confirmado')
    .replace('no puede darse una de las cifras por confirmada', 'son lecturas confirmadas') }), false);
});

test('los dos horómetros siguen siendo lecturas, aunque el texto no repita la unidad', () => {
  assert.equal(compare('mercaeleva:M005-5167'), true);
});

test('un modelo histórico desplazado sigue identificado en el producto final', () => {
  const subject = 'gomariz:CC1535';
  assert.equal(compare(subject), true);
  assert.equal(compare(subject, { prepared: { product: {
    title: 'Socage Iveco 35S14 forSte 20D SPEED', model: '20D SPEED'
  } } }), false);
});

test('una negación sobre la tracción del camión no puede invertirse silenciosamente', () => {
  const subject = 'gomariz:CC1535';
  const item = inventory.entries.find((entry) => entry.subject === subject &&
    entry.sources.some((source) => source.selection === 'displaced'));
  const selected = indexed.get(item.sources[0].selectedInstead).value;
  assert.equal(compare(subject), true);
  assert.equal(compare(subject, { selected: selected.replace('no permite afirmar', 'permite afirmar') }), false);
});

test('sin identidad original o producto resultante no se justifica una alternativa', () => {
  assert.equal(preservesEditorialSupersession('2.000 kg', '2.000 kg', null, { product: {} }), false);
  assert.equal(preservesEditorialSupersession('2.000 kg', '2.000 kg', {}, null), false);
});
