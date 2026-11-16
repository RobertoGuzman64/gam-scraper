import assert from "node:assert/strict";
import test from "node:test";
import { formatAccreditationIssues } from "../individual-accreditation.js";
import type { AccreditationIssue } from "../../../catalog/editorial/campaign-accreditation.js";

const issues: readonly AccreditationIssue[] = [
  { providerId: "gam", reference: "6703", message: "decisión pendiente" },
  { providerId: "gam", reference: "6703", message: "motivo requerido de al menos 15 caracteres" },
  { providerId: "gam", reference: "6703", message: "evidencia HTTPS inválida o falta la URL original de la ficha" },
  { providerId: "gam", reference: "6682", message: "motivo requerido de al menos 15 caracteres" },
  { providerId: "", reference: "", message: "aprobación global sin motivo válido (mínimo 15 caracteres)" }
];

test("cada decisión pendiente se presenta una vez y conserva referencias", () => {
  const output = formatAccreditationIssues(issues, false);
  assert.equal(output.length, 3);
  assert.match(output[0] ?? "", /gam:6703.*3 requisitos sin completar/);
  assert.match(output[1] ?? "", /gam:6682.*motivo requerido/);
  assert.match(output[2] ?? "", /global.*aprobación global/);
});

test("--detalle conserva todos los mensajes reales y no altera los datos", () => {
  assert.equal(formatAccreditationIssues(issues, true).length, 5);
  assert.match(formatAccreditationIssues(issues, true)[2] ?? "", /evidencia HTTPS inválida/);
  assert.equal(issues.length, 5);
  assert.deepEqual(formatAccreditationIssues([], false), []);
});
