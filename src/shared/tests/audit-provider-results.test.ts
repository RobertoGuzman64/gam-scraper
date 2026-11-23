import assert from "node:assert/strict";
import test from "node:test";
import { auditProviderCoverage, collectAuditProviderResults, markAuditProviderFailures } from "../audit-provider-results.js";

test("una fuente histórica ausente no impide evaluar las demás", async () => {
  const result = await collectAuditProviderResults(["gam", "gomariz", "mercaeleva"], async (source) => {
    if (source === "gomariz") throw new Error("No se conserva el original acreditado de gomariz (SHA-256 comprobado)");
    return { providerId: source, value: source };
  }, (source) => source);
  assert.deepEqual(result.evaluated, ["gam", "mercaeleva"]);
  assert.deepEqual(auditProviderCoverage(result), {
    requested: 3, evaluated: 2, incompleteSource: 1, errors: 0,
    failures: [{ source: "gomariz", providerId: "gomariz", category: "INCOMPLETE_SOURCE",
      detail: "No se conserva el original acreditado de gomariz (SHA-256 comprobado)" }]
  });
});

test("la ausencia de original portátil es una fuente incompleta, no un error de procesamiento", async () => {
  const result = await collectAuditProviderResults(["gomariz", "gam"], async (source) => {
    if (source === "gomariz") throw new Error("Falta original portátil: gomariz");
    return { providerId: source, value: source };
  }, (source) => source);
  assert.deepEqual(result.evaluated, ["gam"]);
  assert.equal(auditProviderCoverage(result).incompleteSource, 1);
  assert.equal(auditProviderCoverage(result).errors, 0);
  assert.equal(result.failures[0]?.category, "INCOMPLETE_SOURCE");
});

test("el error técnico y el archivo corrupto no se clasifican como fuente histórica ausente", async () => {
  const result = await collectAuditProviderResults(["gam", "gomariz", "mercaeleva"], async (source) => {
    if (source === "gam") throw new Error("Catálogo y manifest pertenecen a ejecuciones distintas");
    if (source === "gomariz") throw new SyntaxError("JSON inválido");
    return { providerId: source, value: source };
  }, (source) => source);
  assert.deepEqual(result.evaluated, ["mercaeleva"]);
  assert.deepEqual(result.failures.map((failure) => failure.category), ["ERROR", "ERROR"]);
  assert.equal(auditProviderCoverage(result).errors, 2);
});

test("los resultados completos no añaden incidencias", async () => {
  const result = await collectAuditProviderResults(["gam", "gomariz"], async (source) =>
    ({ providerId: source, value: source.length }));
  assert.deepEqual(result.evaluated, [3, 7]);
  assert.deepEqual(result.failures, []);
  assert.equal(auditProviderCoverage(result).evaluated, 2);
});

test("la salida conserva la severidad y el código de fallo público", () => {
  const previousExit = process.exitCode;
  const previousError = console.error;
  const messages: string[] = [];
  console.error = (...parts: unknown[]) => { messages.push(parts.map(String).join(" ")); };
  try {
    process.exitCode = 0;
    markAuditProviderFailures([{ source: "origen", providerId: "gomariz", category: "INCOMPLETE_SOURCE", detail: "Histórico ausente" }]);
    assert.equal(process.exitCode, 1);
    markAuditProviderFailures([{ source: "origen", providerId: "gam", category: "ERROR", detail: "Manifest inválido" }]);
    assert.equal(process.exitCode, 1);
    assert.match(messages.join("\n"), /INCOMPLETE_SOURCE \| gomariz \| Histórico ausente/);
    assert.match(messages.join("\n"), /ERROR \| gam \| Manifest inválido/);
  } finally {
    console.error = previousError;
    process.exitCode = previousExit;
  }
});
