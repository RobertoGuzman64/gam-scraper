import assert from "node:assert/strict";

import test from "node:test";

import { readCanonicalCatalog } from "../../../../../../infrastructure/filesystem/catalog/canonical-catalog.js";

import { recoverGamBatteryMeasures } from "../../../../../../preparation/gam/energy/battery-measures-evidence.js";

const gomariz = await readCanonicalCatalog("catalogs/providers/gomariz/original/scrape-gomariz-catalog.json");

test("Gomariz permanece fuera del enriquecimiento de baterías GAM", () => {
  assert.ok(gomariz.products.every((record) =>
    JSON.stringify(recoverGamBatteryMeasures(record)) === JSON.stringify(record.specs ?? {})));
});
