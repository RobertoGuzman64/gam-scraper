import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { join, resolve } from 'node:path';
import { readFileSync } from 'node:fs';
import { accreditEditorialHistoryConsumption, loadEditorialHistoryInventory } from './editorial-history-inventory.mjs';
import { assessEditorialHistoryPublications, loadActiveEditorialPublications } from './editorial-history-publications.mjs';

const root = resolve(fileURLToPath(new URL('../..', import.meta.url)));
execFileSync(process.execPath, [join(root, 'scripts/operations/rebuild-editorial-knowledge.mjs'), '--check'], { cwd: root });
execFileSync(process.execPath, [join(root, 'scripts/run-build.mjs'), '--quiet', '--if-needed'], { cwd: root });
const [{ editorialSourceDigest }, { resolveKnowledgeEditorial }, { prepareSourceProduct }, { resolveEditorialFacts }] = await Promise.all([
  import('../../dist/infrastructure/filesystem/editorial/knowledge.js'),
  import('../../dist/preparation/shared/editorial/mapping/knowledge-editorial.js'),
  import('../../dist/preparation/prepare-product.js'),
  import('../../dist/preparation/shared/editorial/domain/editorial-facts.js')
]);
const [yale, xcmg, hyster, coherence, ausa] = await Promise.all([
  import('../../dist/preparation/gam/technical/reconciliation/gam-yale-gp80vx.js'),
  import('../../dist/preparation/gam/technical/models/xcmg-1523-model-evidence.js'),
  import('../../dist/preparation/gam/technical/reconciliation/gam-hyster-h45fts5.js'),
  import('../../dist/preparation/gam/technical/reconciliation/gam-verified-capacity-coherence.js'),
  import('../../dist/preparation/mercaeleva/technical/reconciliation/mercaeleva-ausa-height.js')
]);
const reconciliation = {
  reconcileYale: yale.reconcileGamVerifiedYaleGp80vx,
  reconcileXcmg: xcmg.reconcileGamVerifiedXcmg1523Model,
  reconcileHysterTitle: hyster.reconcileGamVerifiedHysterH45fts5Title,
  verifiedHysterEditorial: hyster.verifiedGamHysterH45fts5Editorial,
  reconcileEditorialCoherence: coherence.reconcileGamVerifiedEditorialCoherence,
  normalizeAusaHeight: ausa.normalizeMercaelevaAusaHeightText,
  digestUnit: editorialSourceDigest
};
const read = (path) => JSON.parse(readFileSync(join(root, path), 'utf8'));
const originals = ['gam', 'gomariz', 'mercaeleva'].flatMap((provider) =>
  read(`catalogs/providers/${provider}/original/scrape-${provider}-catalog.json`).products);
const result = accreditEditorialHistoryConsumption(loadEditorialHistoryInventory(root), originals, {
  digestUnit: editorialSourceDigest, resolveUnit: resolveKnowledgeEditorial, prepareUnit: prepareSourceProduct,
  resolveFacts: resolveEditorialFacts
});
const publications = assessEditorialHistoryPublications(result, originals, loadActiveEditorialPublications(root), reconciliation);
if (process.argv.includes('--json')) {
  process.stdout.write(`${JSON.stringify({ ...result, publications }, null, 2)}\n`);
} else {
  console.log(`INVENTARIO HISTÓRICO | ${result.totals.discovered} K parciales · ${result.totals.sources} fuentes · ${result.totals.acceptedEntries} entradas indexadas · ${result.totals.rejectedEntries} descartes · ${result.totals.unconvertedSymbols} símbolo(s) bloqueado(s)`);
  console.log(`ESTADOS K | ${JSON.stringify(result.totals.states)}`);
  console.log(`REFERENCIAS LEGACY DE FABRICANTE | ${JSON.stringify(result.totals.manufacturerSources)} · procedencia archivada, no corroboración del fabricante ni equivalencia de la expresión no convertida`);
  console.log(`PRECEDENCIA FIRMADA | ${JSON.stringify(result.totals.precedence)} · ${result.totals.alternativeExpressionSlots} campos con textos históricos alternativos`);
  console.log(`PREPARACIÓN ACTUAL | ${JSON.stringify(result.totals.runtime)}`);
  console.log(`RESPALDOS DE COMPOSICIÓN | ${result.totals.runtime.composedInsteadOfFallback} analizados · ${result.totals.runtime.fallbackUnitFactsAccredited} hechos específicos acreditados · ${result.totals.runtime.fallbackDiscardedWithEvidence} descartados con evidencia · ${result.totals.states.PENDIENTE_EQUIVALENCIA} equivalencias pendientes · ${JSON.stringify(result.totals.runtime.fallbackNumeric)}`);
  console.log(`CONDICIONES SEMÁNTICAS DE RESPALDO | ${JSON.stringify(result.totals.runtime.fallbackMeaning)}`);
  console.log(`MAGNITUDES DE RESPALDO POR CONCEPTO | ${JSON.stringify(result.totals.runtime.fallbackTechnical)}`);
  console.log(`PUBLICACIONES ACTIVAS | ${JSON.stringify(publications.totals)} · solo copia aprobada, no acreditación de preparación`);
  console.log(`CONTINUIDAD TEXTUAL DE COPIAS APROBADAS | ${JSON.stringify(publications.totals.textContinuity)} · el texto añadido no acredita nuevas afirmaciones`);
  console.log(`DIFERENCIAS TEXTUALES APROBADAS | ${JSON.stringify(publications.totals.textDifferences)} · ${publications.totals.changedUnitFields} campos de unidad con texto sustituido · cifras y cautelas literales, sin equivalencia semántica presumida`);
  console.log(`CORRECCIONES APROBADAS CON RECONCILIADOR PRODUCTIVO | ${JSON.stringify(publications.totals.approvedCorrections)} · no implica equivalencia textual`);
  console.log(`ALTERNATIVAS HISTÓRICAS FIRMADAS EN PUBLICACIÓN | ${JSON.stringify(publications.totals.publishedHistoricalAlternatives)} · prioridad del motor sin cambios, equivalencia semántica no acreditada`);
  console.log(`CONTINUIDAD DE HECHOS DE UNIDAD EN COPIAS APROBADAS | ${JSON.stringify(publications.totals.publishedUnitContinuity)} · no demuestra equivalencia semántica de redacciones`);
  console.log(`RESPALDOS HISTÓRICOS EN COPIAS APROBADAS | ${JSON.stringify(publications.totals.fallbackPublication)} · exige huella y origen de unidad; no acredita equivalencia de preparación`);
  console.log(`CONTRADICCIONES HISTÓRICAS EN COPIAS APROBADAS | ${JSON.stringify(publications.totals.fallbackContradictions)} · una cifra advertida no es una prestación acreditada`);
  console.log(`MAGNITUDES HISTÓRICAS EN COPIAS APROBADAS | ${JSON.stringify(publications.totals.fallbackTechnicalPublication)} · la mera presencia textual no acredita la unidad`);
  console.log(`HECHOS ESTRUCTURADOS EN REDACCIONES SUSTITUIDAS | ${JSON.stringify(publications.totals.unitEvidence)} · año, horómetro y referencia vinculados a la unidad de origen`);
  console.log(`ÍNDICES RELACIONADOS | ${JSON.stringify(result.indexCoverage)}`);
  console.log('LÍMITE | Censo firmado parcial: las exclusiones de respaldo no acreditan equivalencia textual; siguen pendientes las demás generales y la expresión antigua sin fuente ejecutable');
}
if (result.totals.runtime.unresolved > 0 || result.totals.runtime.supersededPending > 0 ||
  result.totals.runtime.fallbackNumeric.sin_conciliacion > 0 ||
  result.totals.runtime.fallbackMeaning.blocking > 0 ||
  result.totals.runtime.fallbackMeaning.unverifiedModelPublications > 0 ||
  result.totals.runtime.fallbackTechnical.blocking > 0 ||
  publications.totals.publishedUnitContinuity.pending > 0 ||
  publications.totals.unitEvidence.missing > 0 ||
  publications.totals.fallbackContradictions.reintroduced > 0 ||
  publications.totals.fallbackTechnicalPublication.blocking > 0 ||
  publications.totals.unitEvidence.discordancesAtRisk > 0) process.exitCode = 1;
