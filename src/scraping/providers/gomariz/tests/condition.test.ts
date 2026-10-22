import assert from "node:assert/strict";
import test from "node:test";
import { gomarizProvider } from "../adapter.js";
import { GOMARIZ_CATEGORIES } from "../config.js";

test("Gomariz: los próximos scrapes guardan la condición verificada de la colección de ocasión", () => {
  const category = GOMARIZ_CATEGORIES[0];
  assert.ok(category);
  assert.equal(gomarizProvider.resolveCondition?.(category, null, "gomariz"), "Segunda mano");
  assert.equal(gomarizProvider.resolveCondition?.(category, undefined, "gomariz"), "Segunda mano");
  assert.equal(gomarizProvider.resolveCondition?.(category, "Nuevo", "gomariz"), "Nuevo");
  assert.equal(gomarizProvider.resolveCondition?.({ ...category, url: "https://example.com/venta/" }, null, "gomariz"), null);
  assert.equal(gomarizProvider.resolveCondition?.(category, null, "otro-proveedor"), null);
  assert.equal(gomarizProvider.resolveCondition?.({ ...category, name: "Maquinaria nueva" }, null, "gomariz"), null);
});
