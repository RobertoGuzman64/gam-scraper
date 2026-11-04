import assert from "node:assert/strict";
import test from "node:test";
import { readCanonicalCatalog } from "../../../../../../infrastructure/filesystem/catalog/canonical-catalog.js";
import { createGamCondensedEditorialResolver, resolveGamCondensedEditorialGeneral, resolveGamCondensedEditorialShort } from "../../../../mapping/providers/gam/editorial-descriptions/condensed-editorial-resolver.js";
import { multiSectorPrimaryEvidence } from "../../../../evidence/providers/gam/editorial/condensed/multi-sector-primary.js";
import { multiSectorSecondaryEvidence } from "../../../../evidence/providers/gam/editorial/condensed/multi-sector-secondary.js";
import { multiSectorTertiaryEvidence } from "../../../../evidence/providers/gam/editorial/condensed/multi-sector-tertiary.js";
import { cleaningEvidence } from "../../../../evidence/providers/gam/editorial/condensed/cleaning.js";
import { forkliftsEvidence } from "../../../../evidence/providers/gam/editorial/condensed/forklifts.js";
import { handlingEvidence } from "../../../../evidence/providers/gam/editorial/condensed/handling.js";
import { platformsEvidence } from "../../../../evidence/providers/gam/editorial/condensed/platforms.js";
import { warehouseEvidence } from "../../../../evidence/providers/gam/editorial/condensed/warehouse.js";
import { hysterEvidence } from "../../../../evidence/providers/gam/editorial/condensed/hyster.js";
import { tennantEvidence } from "../../../../evidence/providers/gam/editorial/condensed/tennant.js";

const gam = await readCanonicalCatalog("catalogs/providers/gam/original/scrape-gam-catalog.json");
const sources = [
  { name: "multi-sector-primary", evidence: multiSectorPrimaryEvidence, requireMatchingShort: false },
  { name: "multi-sector-secondary", evidence: multiSectorSecondaryEvidence, requireMatchingShort: false },
  { name: "multi-sector-tertiary", evidence: multiSectorTertiaryEvidence, requireMatchingShort: true },
  { name: "cleaning", evidence: cleaningEvidence, requireMatchingShort: true },
  { name: "forklifts", evidence: forkliftsEvidence, requireMatchingShort: true },
  { name: "handling", evidence: handlingEvidence, requireMatchingShort: true },
  { name: "platforms", evidence: platformsEvidence, requireMatchingShort: true },
  { name: "warehouse", evidence: warehouseEvidence, requireMatchingShort: true },
  { name: "hyster", evidence: hysterEvidence, requireMatchingShort: true },
  { name: "tennant", evidence: tennantEvidence, requireMatchingShort: true }
] as const;

test("GAM: conserva las condiciones originales de coincidencia editorial por familia", () => {
  for (const source of sources) {
    const reference = Object.keys(source.evidence)[0];
    assert.ok(reference, source.name);
    const original = gam.products.find((product) => product.reference === reference);
    assert.ok(original, `${source.name}: ${reference}`);
    const resolver = createGamCondensedEditorialResolver(source.evidence, source.requireMatchingShort);
    assert.equal(resolver.general(original), source.evidence[reference]?.general, source.name);
    const changedShort = { ...original, shortDescription: `${original.shortDescription ?? ""} — diferente` };
    assert.equal(resolver.general(changedShort), source.requireMatchingShort ? null : source.evidence[reference]?.general, source.name);
    assert.equal(resolver.short(changedShort), null, source.name);
    assert.equal(resolveGamCondensedEditorialGeneral(changedShort), source.requireMatchingShort ? null : source.evidence[reference]?.general, source.name);
    assert.equal(resolveGamCondensedEditorialShort(changedShort), null, source.name);
  }
});
