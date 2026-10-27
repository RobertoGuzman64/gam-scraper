import assert from "node:assert/strict";
import test from "node:test";
import { formatHeader, formatProgressBar, formatStatus, supportsTerminalColor, supportsAnimation } from "../terminal.js";

test("estados semánticos mantienen texto legible en salidas sin color", () => {
  assert.equal(formatStatus("PASS", "Entrega verificada", false), "PASS | Entrega verificada");
  assert.equal(formatStatus("WARN", "Acreditación pendiente", false), "WARN | Acreditación pendiente");
  assert.equal(formatStatus("FAIL", "Error de integridad", false), "FAIL | Error de integridad");
  assert.equal(formatStatus("RUN", "Extrayendo", false), "RUN | Extrayendo");
  assert.equal(formatHeader("ESTADO", false), "◆ EQUIPZILLA / ESTADO");
});

test("aplica verde amarillo rojo y cian únicamente cuando está permitido", () => {
  assert.match(formatStatus("PASS", "ok", true), /\u001b\[32mPASS\u001b\[0m/);
  assert.match(formatStatus("WARN", "revisar", true), /\u001b\[33mWARN\u001b\[0m/);
  assert.match(formatStatus("FAIL", "error", true), /\u001b\[31mFAIL\u001b\[0m/);
  assert.match(formatStatus("RUN", "progreso", true), /\u001b\[36mRUN\u001b\[0m/);
  assert.doesNotMatch(formatStatus("PASS", "ok", false), /\u001b/);
});

test("respeta CI, NO_COLOR y terminal no interactiva", () => {
  const previousCI = process.env.CI;
  const previousNoColor = process.env.NO_COLOR;
  const previousTerm = process.env.TERM;
  try {
    delete process.env.CI;
    delete process.env.NO_COLOR;
    process.env.TERM = "xterm-256color";
    assert.equal(supportsTerminalColor({ isTTY: false }), false);
    assert.equal(supportsTerminalColor({ isTTY: true }), true);
    process.env.NO_COLOR = "1";
    assert.equal(supportsTerminalColor({ isTTY: true }), false);
    assert.equal(supportsAnimation({ isTTY: true }), true);
    delete process.env.NO_COLOR;
    process.env.CI = "true";
    assert.equal(supportsTerminalColor({ isTTY: true }), false);
    assert.equal(supportsAnimation({ isTTY: true }), false);
    delete process.env.CI;
    process.env.TERM = "dumb";
    assert.equal(supportsTerminalColor({ isTTY: true }), false);
    assert.equal(supportsAnimation({ isTTY: true }), false);
  } finally {
    if (previousCI === undefined) delete process.env.CI;
    else process.env.CI = previousCI;
    if (previousNoColor === undefined) delete process.env.NO_COLOR;
    else process.env.NO_COLOR = previousNoColor;
    if (previousTerm === undefined) delete process.env.TERM;
    else process.env.TERM = previousTerm;
  }
});

test("solo muestra progreso con denominador real y límites válidos", () => {
  assert.equal(formatProgressBar(1, 3, 6), "[██░░░░] 1/3");
  assert.equal(formatProgressBar(3, 3, 6), "[██████] 3/3");
  assert.equal(formatProgressBar(0, 0), "");
  assert.equal(formatProgressBar(4, 3), "");
  assert.equal(formatProgressBar(-1, 3), "");
});
