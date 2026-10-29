import assert from "node:assert/strict";
import test from "node:test";
import { buildMercaelevaPageUrl } from "../page-url.js";

const url = "https://sales.mercaeleva.com/es/for-sale";

test("Mercaeleva: navega a las páginas con pageIndex basado en cero", () => {
  assert.equal(buildMercaelevaPageUrl(url, 1), url);
  assert.equal(buildMercaelevaPageUrl(url, 2), `${url}?pageIndex=1`);
  assert.equal(buildMercaelevaPageUrl(url, 12), `${url}?pageIndex=11`);
});

test("Mercaeleva: elimina el parámetro antiguo conservando otros filtros", () => {
  assert.equal(buildMercaelevaPageUrl(`${url}?page=8&order=asc`, 2), `${url}?order=asc&pageIndex=1`);
  assert.equal(buildMercaelevaPageUrl(`${url}?pageIndex=5`, 1), url);
});
