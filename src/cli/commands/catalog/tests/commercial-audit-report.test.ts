import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { auditCommercialCatalog } from "../../../../commercial/export/commercial-audit.js";
import { printCommercialAuditReport } from "../../../reporting/commercial-audit.js";
import { runCommercialAudit } from "../commercial-audit.js";

const root = fileURLToPath(new URL("../../../../../", import.meta.url));

const collect = (print: () => void): string[] => {
  const messages: string[] = [];
  const previous = console.log;
  const exitCode = process.exitCode;
  console.log = (...values: unknown[]) => { messages.push(values.map(String).join(" ")); };
  try {
    print();
  } finally {
    console.log = previous;
    process.exitCode = exitCode;
  }
  return messages;
};

test("la auditoría comercial conserva informes, opciones y selección por ficha y atributo", async () => {
  const report = await auditCommercialCatalog(root);
  assert.ok(report.providers.length > 0);
  const render = (mode?: string, attributeId?: string, reference?: string): string[] =>
    collect(() => printCommercialAuditReport(report, mode, attributeId, reference));

  assert.deepEqual(JSON.parse(render("--json").join("\n")), report);
  assert.deepEqual(JSON.parse(render("--acreditacion-json").join("\n")), {
    version: 1, providers: report.providers.map((provider) => provider.accreditation)
  });
  const defaultOutput = render();
  assert.ok(defaultOutput.some((line) => line.includes(`${report.providers.reduce((sum, item) => sum + item.baseline.products, 0)} fichas técnicas acreditadas`)));
  assert.ok(defaultOutput.length < render("--detalle").length);
  assert.ok(render("--acreditacion").some((line) => line.includes("Validación semántica e integración en BD: NO VERIFICADAS")));
  assert.equal(render("--exportacion").length >= report.providers.length, true);
  assert.equal(render("--contenido").length >= report.providers.length * 3, true);
  assert.equal(render("--contenido-revision").length >= render("--contenido").length, true);
  const outputFindings = report.providers.flatMap((provider) => provider.outputConsistencyAudit.findings);
  assert.deepEqual(outputFindings, []);
  assert.equal(render("--contenido-revision").some((line) =>
    line.includes("modelo-variante-titulo-contradictorio")), false);
  const coverage = report.providers.flatMap((provider) => provider.crossCoverageAudit.findings);
  const modelReview = coverage.find((item) => item.area === "identidad" &&
    item.reason === "modelo-titulo-spec-discordante" && item.reference === "6934");
  assert.ok(modelReview);
  assert.equal(coverage.some((item) => item.area === "imagenes" && item.reference === "CC1666"), false);
  assert.ok(coverage.some((item) => item.area === "imagenes" &&
    item.reason === "modelo-portada-variante-discordante" && item.reference === "TE1772"));
  assert.equal(coverage.some((item) => item.reason === "imagen-de-otro-modelo"), false);
  assert.ok(!coverage.some((item) => item.area === "editorial" &&
    item.reason === "general_repetida_entre_modelos" &&
    ["GR1679", "GR1680", "GR1681"].includes(item.reference ?? "")));
  assert.ok(render("--contenido-revision").some((line) => line.includes("Cobertura transversal:")));
  assert.ok(render("--contenido-revision").some((line) => line.includes("modelo-portada-variante-discordante")));
  assert.equal(render("--contenido-revision").some((line) => line.includes("portada-referencia-ajena")), false);
  assert.ok(render("--revision").some((line) => line.includes("PRIORIDADES GAM")));
  assert.equal(report.providers.some((provider) => provider.interventionPriorities.controlled.some((item) =>
    item.reason === "especificaciones-incompatibles-filtradas")), false);
  assert.equal(render("--revision").some((line) => line.includes("CONTROLADA | especificaciones-incompatibles-filtradas")), false);
  assert.ok(render("--revision").some((line) => line.includes(modelReview.sourceUrl)));
  assert.ok(render("--contenido-revision").some((line) => line.includes("protecciones controladas")));
  assert.equal(report.providers.some((provider) => provider.interventionPriorities.pending.some((priority) =>
    priority.source === "salida")), false);
  assert.equal(render("--atributos").length >= report.providers.length, true);
  assert.equal(render("--atributos-revision").length >= render("--atributos").length, true);
  assert.equal(render("--atributos-vacios").length >= report.providers.length, true);
  assert.equal(render("--pendientes").length >= report.providers.length, true);
  assert.equal(render("--muestras").length >= report.providers.length, true);
  assert.equal(render("--revision").length >= report.providers.length, true);

  const reference = report.providers.flatMap((provider) => provider.presentationAudit.decisions)
    .find((decision) => !!decision.reference)?.reference;
  assert.ok(reference);
  assert.ok(render("--ficha", undefined, reference).some((line) => line.includes(reference)));
  assert.deepEqual(render("--ficha", undefined, "__REFERENCIA_AUSENTE__"),
    ["No existe referencia técnica publicada __REFERENCIA_AUSENTE__"]);
  const attributeId = report.providers.flatMap((provider) => provider.attributeAudit.coverage)[0]?.attributeID;
  assert.ok(attributeId);
  assert.ok(render("--atributo", String(attributeId)).some((line) => line.includes(String(attributeId))));
  assert.deepEqual(render("--atributo", "9999999999"),
    ["No hay categorías elegibles relacionadas con el atributo 9999999999"]);
});

test("el comando conserva ayuda y rechazo de opciones inválidas", async () => {
  const output: string[] = [];
  const previous = console.log;
  console.log = (...values: unknown[]) => { output.push(values.map(String).join(" ")); };
  try {
    await runCommercialAudit(["--help"]);
  } finally {
    console.log = previous;
  }
  assert.match(output.join("\n"), /--acreditacion-json/);
  assert.match(output.join("\n"), /--revision prioriza hallazgos/);
  await assert.rejects(() => runCommercialAudit(["--desconocida"]), /Opciones inválidas/);
  await assert.rejects(() => runCommercialAudit(["--json", "--pendientes"]), /Opciones inválidas/);
  await assert.rejects(() => runCommercialAudit(["--atributo=9007199254740992"]), /Opciones inválidas/);
});

test("verificar mantiene el rechazo de manifiestos con entorno inválido", async () => {
  const directory = await mkdtemp(join(tmpdir(), "eqz-commercial-audit-"));
  try {
    await writeFile(join(directory, "commercial-manifest.json"), JSON.stringify({ environment: "staging" }));
    await assert.rejects(() => runCommercialAudit([`--verificar=${directory}`]), /entorno válido/);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
