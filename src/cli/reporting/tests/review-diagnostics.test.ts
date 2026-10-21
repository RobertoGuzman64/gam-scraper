import assert from "node:assert/strict";
import test from "node:test";
import { formatReviewDiagnostics } from "../review-diagnostics.js";
import type { PreparedProduct } from "../../../catalog/import/prepare.js";

const entry = (reference: string | null, issues: readonly string[], status: PreparedProduct["status"] = "review", condition: PreparedProduct["product"]["condition"] = null): PreparedProduct => ({
  status,
  issues,
  product: {
    providerId: "gam", sourceUrl: `https://example.com/${reference ?? "sin-referencia"}`,
    reference, title: "Plataforma", categorySellID: null, category: null, condition, price: null,
    description_title: "Plataforma", description: null, description_general: null,
    image: null, images: [], spec: {}, attributes: []
  }
});

test("agrupa los motivos por referencia sin sumar fichas repetidas ni confundir bloqueos", () => {
  const rows = formatReviewDiagnostics([
    entry("A1", ["Precio no disponible o inválido"]),
    entry("A2", ["Precio no disponible o inválido", "Atributo obligatorio ausente: Altura de trabajo"]),
    entry("A3", ["Precio no disponible o inválido", "Precio no disponible o inválido"]),
    entry("A4", ["Atributo obligatorio ausente: Altura de trabajo", "Categoría sin correspondencia"]),
    entry("A5", ["Precio no disponible o inválido", "Categoría sin correspondencia"]),
    entry("LISTA", [], "ready")
  ]).join("\n");
  assert.match(rows, /Diagnóstico review: 5 fichas \| 1 motivo: 2 \| 2\+ motivos: 3 \| sin motivo: 0 \| incidencias: 8/);
  assert.match(rows, /Precio no disponible o inválido \| 4 fichas \| solo: 2 \| con otros: 2 \| refs: A1, A2, A3/);
  assert.match(rows, /Atributo obligatorio ausente: Altura de trabajo \| 2 fichas \| solo: 0 \| con otros: 2/);
  assert.match(rows, /Categoría sin correspondencia \| 2 fichas \| solo: 0 \| con otros: 2/);
  assert.doesNotMatch(rows, /LISTA/);
  assert.match(rows, /Causa de los bloqueos: no determinada/);
});

test("conserva literalmente los motivos desconocidos y de serie y muestra referencias rastreables", () => {
  const serial = "Número de serie ABC compartido por referencias A1, A2; revisar identidad de origen";
  const lines = formatReviewDiagnostics([
    entry("A1", [serial]),
    entry("A2", [serial, "Motivo nuevo, sin clasificar"]),
    entry(null, ["Motivo nuevo, sin clasificar"]),
    entry("A4", []),
    entry("A5", [""])
  ]).join("\n");
  assert.match(lines, /Diagnóstico review: 5 fichas \| 1 motivo: 3 \| 2\+ motivos: 1 \| sin motivo: 1 \| incidencias: 5/);
  assert.ok(lines.includes(`${serial} | 2 fichas | solo: 1 | con otros: 1 | refs: A1, A2`));
  assert.ok(lines.includes("Motivo nuevo, sin clasificar | 2 fichas | solo: 1 | con otros: 1 | refs: A2, https://example.com/sin-referencia"));
  assert.match(lines, /\(motivo sin texto\) \| 1 ficha \| solo: 1/);
});

test("no genera diagnóstico ni modifica el estado de un lote sin review", () => {
  assert.deepEqual(formatReviewDiagnostics([entry("A1", [], "ready")]), []);
  assert.deepEqual(formatReviewDiagnostics([]), []);
});

test("diagnóstico separa las cohortes comerciales sin inventar causas ni cambiar estados", () => {
  const entries = [
    entry("N1", ["Precio no disponible o inválido"], "review", "Nuevo"),
    entry("N2", [], "ready", "Nuevo"),
    entry("U1", ["Atributo obligatorio ausente: Altura de trabajo"], "review", "Segunda_Mano"),
    entry("U2", ["Número de serie X compartido por referencias U2, U3; revisar identidad de origen"], "review", "Segunda_Mano"),
    entry("?", ["Condición comercial no confirmada (Nuevo o Segunda_Mano)"], "review")
  ];
  const lines = formatReviewDiagnostics(entries).join("\n");
  assert.match(lines, /Nuevo: 2 fichas \| ready: 1 \| review: 1/);
  assert.match(lines, /Segunda_Mano: 2 fichas \| ready: 0 \| review: 2/);
  assert.match(lines, /Sin confirmar: 1 ficha \| ready: 0 \| review: 1/);
  assert.match(lines, /Precio no disponible o inválido.*diagnóstico: requisito Excel; origen por contrastar/);
  assert.match(lines, /Atributo obligatorio ausente.*diagnóstico: requisito Excel; origen por contrastar/);
  assert.match(lines, /Número de serie X.*diagnóstico: integridad de identidad/);
  assert.match(lines, /Condición comercial no confirmada.*diagnóstico: equivalencia o condición por verificar/);
  assert.match(lines, /no fallos de extracción demostrados/);
  assert.equal(entries[1]?.status, "ready");
});
