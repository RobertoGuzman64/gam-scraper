import assert from "node:assert/strict";
import test from "node:test";
import { parseValidateOptions } from "../validate.js";
import { parseExportOptions } from "../export.js";

const preparation = "storage/prepared/gam/scrape-gam-marzo-2026-preparation.json";
const source = "storage/scraped/gam/scrape-gam-marzo-2026-catalog.json";

test("validate conserva el modo heredado y añade dos etapas específicas", () => {
  const legacy = parseValidateOptions(["gam"]);
  assert.equal(legacy.stage, "legacy");
  assert.equal(legacy.verbose, false);
  assert.equal(parseValidateOptions(["gam", "--verbose"]).verbose, true);
  const catalog = parseValidateOptions(["gam", "--stage", "catalog", "--prefix", "scrape-gam-marzo-2026"]);
  assert.equal(catalog.stage, "catalog");
  assert.ok(catalog.source?.endsWith("scrape-gam-marzo-2026-catalog.json"));
  const prepared = parseValidateOptions(["gam", "--stage", "preparation", "--preparation", preparation, "--source", source]);
  assert.equal(prepared.stage, "preparation");
  assert.ok(prepared.preparation?.endsWith("scrape-gam-marzo-2026-preparation.json"));
  assert.ok(prepared.source?.endsWith("scrape-gam-marzo-2026-catalog.json"));
  assert.equal(parseValidateOptions(["gam", "--stage", "preparation", "--preparation", preparation, "--verbose"]).verbose, true);
  const renamed = parseValidateOptions(["gam", "--stage", "preparation", "--preparation", "storage/prepared/gam/scrape-gam-marzo-2026-alturas-preparation.json"]);
  assert.equal(renamed.source, null);
});

test("validate rechaza opciones de etapas incompletas sin alterar los alias históricos", () => {
  assert.throws(() => parseValidateOptions(["gam", "--preparation", preparation]), /--stage/);
  assert.throws(() => parseValidateOptions(["gam", "--stage", "preparation"]), /--preparation/);
  assert.throws(() => parseValidateOptions(["gam", "--stage", "catalog", "--preparation", preparation]), /solo es compatible/);
  assert.throws(() => parseValidateOptions(["gam", "--stage", "otro"]), /--stage/);
  assert.throws(() => parseValidateOptions(["gam", "--verbose", "--verbose"]), /repetida/);
  assert.throws(() => parseValidateOptions(["gam", "--stage", "catalog", "--verbose"]), /requiere una validación de preparación/);
  assert.equal(parseValidateOptions(["--provider", "gam", "--outPrefix", "personalizado"]).outputPrefix, "personalizado");
});

test("export mantiene confirmación obligatoria y admite origen canónico explícito", () => {
  const args = ["gam", "--companyID", "45", "--preparation", preparation,
    "--source", source, "--existing", "inventory.csv", "--out", "altas.xlsx"];
  const parsed = parseExportOptions([...args, "--dry-run"]);
  assert.notEqual(parsed, "help");
  if (parsed === "help") return;
  assert.equal(parsed.dryRun, true);
  assert.equal(parsed.companyID, 45);
  assert.ok(parsed.source?.endsWith("scrape-gam-marzo-2026-catalog.json"));
  assert.throws(() => parseExportOptions(args), /--confirm-inventory/);
  assert.throws(() => parseExportOptions([...args, "--dry-run", "--confirm-inventory"]), /incompatibles/);
});

test("validate: comparación de cobertura exige catálogo y rutas canónicas", () => {
  const current = "storage/scraped-20261025-010603/gam/scrape-gam-marzo-2026-catalog.json";
  const prior = "storage/scraped/gam/scrape-gam-marzo-2026-catalog.json";
  const parsed = parseValidateOptions(["gam", "--stage", "catalog", "--source", current, "--baseline", prior]);
  assert.ok(parsed.baseline?.endsWith(prior));
  assert.ok(parsed.source?.endsWith(current));
  assert.throws(() => parseValidateOptions(["gam", "--baseline", prior]), /requiere --stage catalog/);
  assert.throws(() => parseValidateOptions(["gam", "--stage", "preparation", "--preparation", preparation, "--baseline", prior]), /requiere --stage catalog/);
  assert.throws(() => parseValidateOptions(["gam", "--stage", "catalog", "--baseline", "otra.json"]), /debe ser -catalog.json/);
  assert.throws(() => parseValidateOptions(["gam", "--stage", "catalog", "--baseline", prior, "--baseline", prior]), /repetida/);
});
