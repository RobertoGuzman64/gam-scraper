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

test("presenta etapas, contador verdadero y cierre sin porcentajes inventados", () => {
  const output = capture(() => {
    const progress = new OperationProgress("PREPARAR");
    progress.stage("CATÁLOGOS", "3 proveedores");
    progress.update("GAM", 1, 3);
    progress.stage("REFERENCIAS", "comprobando integridad");
    progress.finish();
  });
  assert.match(output, /PREPARAR \| CATÁLOGOS/);
  assert.match(output, /\[████░░░░░░░░\] 1\/3/);
  assert.match(output, /PASS \| PREPARAR \| REFERENCIAS/);
  assert.match(output, /PASS \| PREPARAR \| TOTAL/);
  assert.doesNotMatch(output, /%/);
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
  assert.doesNotMatch(output, /\[.*\]/);
});
