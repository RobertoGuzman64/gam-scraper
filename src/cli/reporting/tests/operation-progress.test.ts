import assert from "node:assert/strict";
import { mock, test } from "node:test";
import { OperationProgress } from "../progress/operation-progress.js";

const capture = (action: () => void): string => {
  const lines: string[] = [];
  const log = mock.method(console, "log", (message: string) => { lines.push(message); });
  const write = mock.method(process.stdout, "write", (message: string | Uint8Array) => {
    lines.push(typeof message === "string" ? message : message.toString());
    return true;
  });
  const writeError = mock.method(process.stderr, "write", (message: string | Uint8Array) => {
    lines.push(typeof message === "string" ? message : message.toString());
    return true;
  });
  try { action(); }
  finally {
    writeError.mock.restore();
    write.mock.restore();
    log.mock.restore();
  }
  return lines.join("\n").replace(/\u001b\[[0-9;]*m/g, "");
};

test("presenta una línea definitiva por proveedor, contador y etapas sin barras", () => {
  const output = capture(() => {
    const progress = new OperationProgress("PREPARAR", true);
    progress.stage("CATÁLOGOS", "3 proveedores");
    progress.update("GAM", 0, 3);
    progress.update("GAM", 1, 3);
    progress.update("GAM", 1, 3);
    progress.update("GOMARIZ", 1, 3);
    progress.update("GOMARIZ", 2, 3);
    progress.update("MERCAELEVA", 2, 3);
    progress.update("MERCAELEVA", 3, 3);
    progress.stage("REFERENCIAS", "comprobando integridad");
    progress.finish();
  });
  assert.equal((output.match(/  GAM \| 1\/3 procesados/g) ?? []).length, 1);
  assert.equal((output.match(/  GOMARIZ \| 2\/3 procesados/g) ?? []).length, 1);
  assert.equal((output.match(/  MERCAELEVA \| 3\/3 procesados/g) ?? []).length, 1);
  assert.match(output, /PASS \| PREPARAR \| REFERENCIAS/);
  assert.match(output, /PASS \| PREPARAR \| TOTAL/);
  assert.doesNotMatch(output, /█|░|RUN \| PREPARAR|PASS \| PREPARAR \| CATÁLOGOS \| GAM|%/);
});

test("registra avances de inspección sin atribuir tiempos de proveedor no medidos", () => {
  const output = capture(() => {
    const progress = new OperationProgress("FINISH", true);
    progress.stage("INSPECCIÓN", "2 proveedores");
    progress.update("GAM", 1, 2);
    progress.update("GOMARIZ", 2, 2);
    progress.finish();
  });
  assert.match(output, /  GAM \| 1\/2 procesados\n/);
  assert.match(output, /  GOMARIZ \| 2\/2 procesados\n/);
  assert.doesNotMatch(output, /█|░/);
});

test("una interrupción no acredita la etapa inacabada", () => {
  const output = capture(() => {
    const progress = new OperationProgress("FINISH", true);
    progress.stage("VERIFICACIÓN", "sin total acreditado");
    progress.update("GOMARIZ");
    progress.abort();
    progress.finish();
  });
  assert.match(output, /WARN \| FINISH \| VERIFICACIÓN/);
  assert.match(output, /WARN \| FINISH \| INTERRUMPIDA/);
  assert.doesNotMatch(output, /PASS \| FINISH/);
  assert.doesNotMatch(output, /█|░/);
});


test("los contadores inválidos y los eventos repetidos no inventan proveedores completados", () => {
  const output = capture(() => {
    const progress = new OperationProgress("FINISH", true);
    progress.stage("ACREDITACIÓN", "3 proveedores");
    progress.update("GAM", 0, 3);
    progress.update("GAM", 0, 3);
    progress.update("GAM", -1, 3);
    progress.update("GAM", 4, 3);
    progress.update("GAM", 1, 3);
    progress.update("GAM", 1, 3);
    progress.update("GOMARIZ", 1, 3);
    progress.abort();
  });
  assert.equal((output.match(/GAM \| 1\/3 procesados/g) ?? []).length, 1);
  assert.doesNotMatch(output, /GOMARIZ \| [0-9]+\/3 procesados|4\/3 procesados|-1\/3 procesados/);
  assert.match(output, /WARN \| FINISH \| ACREDITACIÓN/);
  assert.doesNotMatch(output, /PASS \| FINISH|█|░/);
});

test("una etapa fallida conserva el estado FAIL y no anuncia una ejecución correcta", () => {
  const output = capture(() => {
    const progress = new OperationProgress("EXPORTACIÓN COMERCIAL");
    progress.stage("VERIFICACIÓN", "fuentes acreditadas");
    progress.update("GAM", 1, 3);
    progress.finish("FAIL");
    progress.finish();
    progress.update("GOMARIZ", 2, 3);
  });
  assert.equal((output.match(/FAIL \| EXPORTACIÓN COMERCIAL \| VERIFICACIÓN/g) ?? []).length, 1);
  assert.equal((output.match(/FAIL \| EXPORTACIÓN COMERCIAL \| TOTAL/g) ?? []).length, 1);
  assert.doesNotMatch(output, /PASS \| EXPORTACIÓN COMERCIAL|GOMARIZ|█|░/);
});


test("el progreso compacto resume cada etapa sin perder el contador ni el estado final", () => {
  const output = capture(() => {
    const progress = new OperationProgress("FINISH");
    progress.stage("PREFLIGHT", "3 proveedores");
    progress.update("GAM", 1, 3);
    progress.update("GOMARIZ", 2, 3);
    progress.update("MERCAELEVA", 3, 3);
    progress.stage("INSPECCIÓN", "3 proveedores");
    progress.update("GAM", 1, 3);
    progress.update("GOMARIZ", 0, 3);
    progress.update("GOMARIZ", 4, 3);
    progress.abort();
  });
  assert.match(output, /PASS \| FINISH \| PREFLIGHT \| 3\/3 proveedores procesados \| \d+s/);
  assert.match(output, /WARN \| FINISH \| INSPECCIÓN \| 1\/3 proveedores procesados \| \d+s/);
  assert.doesNotMatch(output, /^  (GAM|GOMARIZ|MERCAELEVA) \| .*procesados/gm);
  assert.doesNotMatch(output, /PASS \| FINISH \| INSPECCIÓN|4\/3 proveedores procesados/);
});
