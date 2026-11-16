import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import { loadEditorialHistoryInventory } from '../editorial-history-inventory.mjs';
import { loadActiveEditorialPublications } from '../editorial-history-publications.mjs';
import { inspectEditorialPublicationEvidence } from '../editorial-history-publication-evidence.mjs';

const root = resolve(fileURLToPath(new URL('../../..', import.meta.url)));
const read = (path) => JSON.parse(readFileSync(join(root, path), 'utf8'));
const providers = ['gam', 'gomariz', 'mercaeleva'];
const originals = providers.flatMap((provider) => read(`catalogs/providers/${provider}/original/scrape-${provider}-catalog.json`).products);
const products = loadActiveEditorialPublications(root).flatMap((group) => group.products);
const inventory = loadEditorialHistoryInventory(root);
const original = (subject) => originals.find((item) => `${item.providerId}:${item.reference}` === subject);
const published = (subject) => products.find((item) => `${item.providerId}:${item.reference}` === subject);
const archived = (subject, field) => inventory.entries.find((item) => item.nature === 'signed_unit' &&
  item.subject === subject && item.field === field)?.value;
const inspect = (subject, field, product = published(subject)) => {
  const source = archived(subject, field);
  assert.ok(source);
  return inspectEditorialPublicationEvidence(source, original(subject), product, field);
};

test('contrasta en las publicaciones aprobadas las tres discordancias reales de horómetro sin conciliarlas', () => {
  const cases = [
    ['mercaeleva:M018-7013', 7386, 7368],
    ['mercaeleva:M988-6161', 415, 416],
    ['mercaeleva:M840-8278', 623, 627]
  ];
  for (const [subject, announcedHours, structuredHours] of cases) {
    const result = inspect(subject, 'general');
    assert.deepEqual(result.discordance, { announcedHours, structuredHours, result: 'retained_with_caution' });
    assert.equal(result.missing, 0);
    assert.equal(result.atRisk, 0);
  }
});

test('reconoce año y horas de una firma corta cuando la publicación las conserva en otro campo', () => {
  const result = inspect('mercaeleva:M547-2372', 'short');
  assert.deepEqual(result.claims, [
    { kind: 'year', value: '2000', location: 'other_field' },
    { kind: 'horometer', value: 14696, location: 'other_field' }
  ]);
  assert.equal(result.missing, 0);
});

test('la continuidad estructurada no depende de repetir el año y las horas en la descripción', () => {
  const subject = 'mercaeleva:M547-2372';
  const source = published(subject);
  const modified = { ...source, description_general: 'Descripción sustituida sin datos de unidad' };
  const result = inspect(subject, 'short', modified);
  assert.deepEqual(result.claims.map((claim) => claim.location), ['structured', 'structured']);
});

test('si año y horómetro desaparecen de publicación y especificaciones quedan pendientes', () => {
  const subject = 'mercaeleva:M547-2372';
  const source = published(subject);
  const modified = { ...source, description_general: 'Texto sin detalles de la unidad',
    spec: { ...source.spec, 'Año de fabricación': '', 'Horas laborales': '' } };
  const result = inspect(subject, 'short', modified);
  assert.deepEqual(result.claims.map((claim) => claim.location), ['missing', 'missing']);
  assert.equal(result.missing, 2);
});

test('no acepta dos lecturas de horas sin advertir que son contradictorias', () => {
  const subject = 'mercaeleva:M018-7013';
  const source = published(subject);
  const modified = { ...source, description_general: source.description_general
    .replace('Hay una discrepancia que debe verificarse:', 'El anuncio y la ficha indican:')
    .replace('no se consideran lecturas equivalentes', 'ambas lecturas se muestran') };
  assert.notEqual(modified.description_general, source.description_general);
  const result = inspect(subject, 'general', modified);
  assert.equal(result.discordance.result, 'at_risk');
  assert.equal(result.atRisk, 1);
});

test('no considera preservada la contradicción si desaparece una de las lecturas', () => {
  const subject = 'mercaeleva:M988-6161';
  const source = published(subject);
  const modified = { ...source, description_general: source.description_general
    .replace(/415 horas/gu, '416 horas') };
  assert.notEqual(modified.description_general, source.description_general);
  const result = inspect(subject, 'general', modified);
  assert.equal(result.discordance.result, 'at_risk');
});

test('la referencia de vendedor exige una etiqueta y procedencia estructurada de la misma unidad', () => {
  const subject = 'mercaeleva:M018-7013';
  const source = published(subject);
  const result = inspect(subject, 'general');
  assert.ok(result.claims.some((claim) => claim.kind === 'seller_reference' && claim.value === '2111'));
  const changed = { ...source,
    description_general: source.description_general.replace(/Referencia comercial del vendedor:\s*2111/iu, 'número 2111'),
    spec: { ...source.spec, 'Artículo No.': '' } };
  const observed = inspect(subject, 'general', changed);
  assert.ok(observed.claims.some((claim) => claim.kind === 'seller_reference' && claim.location === 'missing'));
});

test('no interpreta el modelo alternativo de GAM como una referencia de vendedor acreditada', () => {
  assert.equal(inspect('gam:2328', 'general').claims.some((claim) => claim.kind === 'seller_reference'), false);
  assert.equal(inspect('gam:4802', 'general').claims.some((claim) => claim.kind === 'seller_reference'), false);
});
