import assert from "node:assert/strict";
import test from "node:test";
import { formatHeader, formatProgressBar, formatReportLine, formatStatus, supportsTerminalColor, supportsAnimation } from "../terminal.js";

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

test("presentación individual colorea estados acreditados y rutas sin alterar el contenido", () => {
  const published = formatReportLine("ENTREGA INDIVIDUAL | GAM | PUBLISHED", true);
  assert.match(published, /\u001b\[36mENTREGA INDIVIDUAL\u001b\[0m/);
  assert.match(published, /\u001b\[32mPUBLISHED\u001b\[0m/);
  assert.equal(published.replace(/\u001b\[[0-9;]*m/g, ""), "ENTREGA INDIVIDUAL | GAM | PUBLISHED");
  const zip = formatReportLine("  ZIP verificado: C:\\Users\\Test\\Desktop\\equipzilla-gam.zip", true);
  assert.match(zip, /\u001b\[32mZIP verificado\u001b\[0m/);
  assert.match(zip, /equipzilla-gam\.zip$/);
});

test("se distinguen las incidencias reales y los ceros sin pintar rutas ni evidencias", () => {
  const metrics = formatReportLine("  Productos: 983 | Calidad ready: 981 | Calidad review: 2 | Fallos: 0", true);
  assert.match(metrics, /\u001b\[32m981\u001b\[0m/);
  assert.match(metrics, /\u001b\[33m2\u001b\[0m/);
  assert.match(metrics, /\u001b\[32m0\u001b\[0m/);
  const empty = formatReportLine("  Publicables: 0 | Excluidas: 5", true);
  assert.match(empty, /\u001b\[33m0\u001b\[0m/);
  const evidence = "  Evidencia: https://example.org/ficha?review=1&ready=0";
  assert.equal(formatReportLine(evidence, true).replace(/\u001b\[[0-9;]*m/g, ""), evidence);
  const urlWithPipes = "  Fuente: https://example.org/a | b?review=1";
  assert.equal(formatReportLine(urlWithPipes, true).replace(/\u001b\[[0-9;]*m/g, ""), urlWithPipes);
});

test("aprobación y decisiones pendientes usan colores semánticos", () => {
  assert.match(formatReportLine("ACREDITACIÓN INDIVIDUAL | GAM | PENDIENTE", true), /\u001b\[33mPENDIENTE\u001b\[0m/);
  assert.match(formatReportLine("ACREDITACIÓN INDIVIDUAL | GAM | APROBADA", true), /\u001b\[32mAPROBADA\u001b\[0m/);
  assert.match(formatReportLine("  Decisiones válidas: 5/5", true), /\u001b\[32m5\/5\u001b\[0m/);
  assert.match(formatReportLine("  Decisiones válidas: 3/5", true), /\u001b\[33m3\/5\u001b\[0m/);
  assert.match(formatReportLine("PROVEEDORES", true), /\u001b\[36mPROVEEDORES\u001b\[0m/);
});

test("sin TTY o color activo el contenido es exactamente el mismo", () => {
  const example = "ENTREGA INDIVIDUAL | GAM | VERIFIED\n  Publicables: 978 | Excluidas: 5\n  JSON: C:\\gam\\publicable.json";
  assert.equal(formatReportLine(example, false), example);
  const json = '{ "long description": "A | PENDIENTE | B", "review": 2 }';
  assert.equal(formatReportLine(json, true), json);
  assert.equal(formatReportLine(formatStatus("PASS", "Completado", true), true), formatStatus("PASS", "Completado", true));
});
