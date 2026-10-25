import assert from "node:assert/strict";
import test from "node:test";
import { extractMercaelevaLinks } from "../parsers.js";
import type { CategoryConfig } from "../../../../contracts/scraping.js";

const category: CategoryConfig = { key: "venta", name: "Maquinaria en venta", url: "https://sales.mercaeleva.com/es/for-sale" };
const baseUrl = "https://sales.mercaeleva.com/es/for-sale/machine/";

test("Mercaeleva: el parser aplica la misma identidad de URL sin query ni barra final", () => {
  const html = `<a href="${baseUrl}M1?origen=lista">M1</a>
    <a href="${baseUrl}M1/#detalles">M1</a>
    <a href="https://externo.com/es/for-sale/machine/OTRA">Otra web</a>
    <a href="https://sales.mercaeleva.com/ca/for-sale/machine/M2">M2</a>`;
  assert.deepEqual(extractMercaelevaLinks(category.url, html), [
    `${baseUrl}M1`, "https://sales.mercaeleva.com/ca/for-sale/machine/M2"
  ]);
});


