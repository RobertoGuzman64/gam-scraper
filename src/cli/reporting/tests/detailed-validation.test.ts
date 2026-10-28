import assert from "node:assert/strict";
import test from "node:test";
import type { PreparedProduct } from "../../../catalog/preparation/contracts.js";
import { formatDetailedValidation } from "../detailed-validation.js";

const entry: PreparedProduct = {
  status: "review", issues: ["Precio no disponible o inválido", "Atributo obligatorio ausente: Tipo de mástil"],
  product: {
    providerId: "gam", sourceUrl: "https://example.test/111", reference: "111", title: "Plataforma",
    categorySellID: 5, category: "Plataformas", condition: "Nuevo", price: null,
    description_title: "Plataforma", description: "Plataforma eléctrica",
    description_general: "Altura de trabajo 8 m", image: "https://example.test/111.jpg",
    images: ["https://example.test/111.jpg"], spec: { "Altura de trabajo": "8 m" },
    attributes: [{ attributeID: 7, value: 8 }]
  }
};

test("audit detallado identifica solo review y explica todos los motivos sin volcar fichas", () => {
  const ready: PreparedProduct = { ...entry, status: "ready", issues: [], product: { ...entry.product, reference: "222" } };
  const snapshot = JSON.stringify([entry, ready]);
  const output = [...formatDetailedValidation([entry, ready])].join("\n");
  assert.match(output, /AUDIT DE REVIEW \| 1\/2 fichas en revisión/);
  assert.match(output, /1 fichas \| excel\.price \+ excel\.required_attribute:Tipo de mástil/);
  assert.match(output, /GAM \| 111 \| 2 motivos/);
  assert.match(output, /\[excel.price\] Precio no disponible o inválido/);
  assert.match(output, /\[excel.required_attribute:Tipo de mástil\] Atributo obligatorio ausente: Tipo de mástil/);
  assert.doesNotMatch(output, /GAM \| 222/);
  assert.doesNotMatch(output, /"Altura de trabajo"|"price"|"attributes"|Origen canónico|Preparación \(todos/);
  assert.equal(JSON.stringify([entry, ready]), snapshot);
});

test("audit detallado identifica review sin referencia por su URL", () => {
  const anonymous: PreparedProduct = { ...entry, product: { ...entry.product, reference: null } };
  const output = [...formatDetailedValidation([anonymous])].join("\n");
  assert.match(output, /GAM \| https:\/\/example\.test\/111 \| 2 motivos/);
});

test("audit detallado informa de review sin motivos y no inventa causas", () => {
  const inconsistent: PreparedProduct = { ...entry, issues: [] };
  const output = [...formatDetailedValidation([inconsistent])].join("\n");
  assert.match(output, /sin motivos registrados/);
  assert.match(output, /Sin motivos registrados: revisar la coherencia del diagnóstico/);
});

test("audit detallado omite fichas ready cuando no hay review", () => {
  const ready: PreparedProduct = { ...entry, status: "ready", issues: [] };
  const output = [...formatDetailedValidation([ready])].join("\n");
  assert.match(output, /AUDIT DE REVIEW \| 0\/1 fichas en revisión/);
  assert.match(output, /No hay fichas en review/);
  assert.doesNotMatch(output, /GAM \| 111|Patrones de bloqueos simultáneos/);
});
