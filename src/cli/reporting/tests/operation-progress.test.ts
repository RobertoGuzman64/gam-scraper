import assert from "node:assert/strict";
import { mock, test } from "node:test";
import { OperationProgress } from "../operation-progress.js";

const capture = (action: () => void): string => {
  const lines: string[] = [];
  const log = mock.method(console, "log", (message: string) => { lines.push(message); });
  const write = mock.method(process.stdout, "write", (message: string | Uint8Array) => {
    lines.push(typeof message === "string" ? message : message.toString());
    return true;
  });
  try { action(); }
  finally {
    write.mock.restore();
    log.mock.restore();
  }
  return lines.join("\n").replace(/\u001b\[[0-9;]*m/g, "");
};

test("presenta una línea definitiva por proveedor, contador y etapas sin barras", () => {
  const output = capture(() => {
    const progress = new OperationProgress("PREPARAR");
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
    const progress = new OperationProgress("FINISH");
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
    const progress = new OperationProgress("FINISH");
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
