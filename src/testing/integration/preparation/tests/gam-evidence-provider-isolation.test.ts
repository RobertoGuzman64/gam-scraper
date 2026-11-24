import assert from "node:assert/strict";
import test from "node:test";
import type { ProductRecord, SpecsMap } from "../../../../contracts/catalog.js";
import { readCanonicalCatalog } from "../../../../infrastructure/filesystem/catalog/canonical-catalog.js";
import { recoverGamVerifiedOperationalSafety } from "../../../../preparation/gam/safety/verified-operational-safety-evidence.js";
import { recoverGamClearanceAndPlatform } from "../../../../preparation/gam/measurements/evidence/clearance-platform-evidence.js";
import { recoverGamVerifiedUnitGeometrySpecs } from "../../../../preparation/gam/measurements/evidence/verified-unit-geometry-specs.js";
import { recoverGamVerifiedTractionBraking } from "../../../../preparation/gam/mobility/verified-traction-braking-evidence.js";
import { recoverGamVerifiedDrivetrainBrakes } from "../../../../preparation/gam/mobility/verified-drivetrain-brakes-evidence.js";
import { recoverGamCleaningTankSpecs } from "../../../../preparation/gam/operations/cleaning-tank-evidence.js";
import { recoverGamVerifiedUnitPerformanceSpecs } from "../../../../preparation/gam/operations/verified-unit-performance-specs.js";
import { recoverGamAcousticSpec } from "../../../../preparation/gam/safety/acoustic-evidence.js";
import { recoverGamVerifiedOperatorControls } from "../../../../preparation/gam/safety/verified-operator-controls-evidence.js";
import { recoverGamVerifiedTyreDimensions } from "../../../../preparation/gam/mobility/verified-tyre-dimensions-evidence.js";
import { recoverGamVerifiedConditionalAcoustics } from "../../../../preparation/gam/safety/verified-conditional-acoustics-evidence.js";

type Recoverer = (record: ProductRecord) => SpecsMap;

const recoverers: readonly Recoverer[] = [
  recoverGamVerifiedOperationalSafety,
  recoverGamClearanceAndPlatform,
  recoverGamVerifiedUnitGeometrySpecs,
  recoverGamVerifiedTractionBraking,
  recoverGamVerifiedDrivetrainBrakes,
  recoverGamCleaningTankSpecs,
  recoverGamVerifiedUnitPerformanceSpecs,
  recoverGamAcousticSpec,
  recoverGamVerifiedOperatorControls,
  recoverGamVerifiedTyreDimensions,
  recoverGamVerifiedConditionalAcoustics
];

test("la evidencia técnica GAM no se propaga a los originales actuales de Gomariz ni Mercaeleva", async () => {
  for (const providerId of ["gomariz", "mercaeleva"] as const) {
    const catalog = await readCanonicalCatalog(`catalogs/providers/${providerId}/original/scrape-${providerId}-catalog.json`);
    for (const record of catalog.products) {
      const before = JSON.stringify(record);
      for (const recover of recoverers) {
        assert.deepEqual(recover(record), record.specs ?? {}, `${providerId}:${record.reference}:${recover.name}`);
      }
      assert.equal(JSON.stringify(record), before, `${providerId}:${record.reference}`);
    }
  }
});

test("el censo GAM actual no pierde especificaciones acreditadas ni altera originales", async () => {
  const catalog = await readCanonicalCatalog("catalogs/providers/gam/original/scrape-gam-catalog.json");
  for (const record of catalog.products) {
    const before = JSON.stringify(record);
    for (const recover of recoverers) {
      const next = recover(record);
      for (const [key, value] of Object.entries(record.specs ?? {})) {
        assert.deepEqual(next[key], value, `${record.reference}:${recover.name}:${key}`);
      }
    }
    assert.equal(JSON.stringify(record), before, record.reference ?? "sin referencia");
  }
});
