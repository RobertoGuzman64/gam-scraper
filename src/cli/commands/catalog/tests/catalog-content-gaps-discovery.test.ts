import assert from "node:assert/strict";
import test from "node:test";
import { cleanupBaseline, execute, executeBaseline, gam } from "./catalog-content-gaps-fixtures.js";

test.after(cleanupBaseline);

test("huecos puede descubrir y auditar las publicaciones finales sin listar rutas", async () => {
  const output = await executeBaseline(["--finales", "--top", "2", "--detalle"]);
  assert.match(output, /finales [1-9]\d*/);
  assert.match(output, /DESCRIPCIONES GENERALES MÁS LARGAS/);
  const automatic = await executeBaseline(["--top", "1"]);
  assert.match(automatic, /finales [1-9]\d*/);
  await assert.rejects(execute(["--finales", "--catalogo", gam]), /no se combina/);
});

