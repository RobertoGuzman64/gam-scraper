import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { createManainStocklistManifest, readManainStocklist } from "../manain-stocklist.js";

const stocklist = {
  fuente: {
    archivo: "StocklistNoviembreManain.pdf",
    sha256: "c7c2f88e284c2efa153c1e8ff51d771d9195e0952a57820c1456974f8f2d2fb2",
    paginas: 42, tipo: "Stocklist Noviembre", proveedor: "Manain", registros_declarados: 1
  },
  productos: [{
    referencia: "MA4075", familia: "AD-12 ARTICULADA DIESEL", marca: "HAULOTTE", modelo: "HA 120 PX",
    anio: 2015, horas: 2885, precio_eur: 24500, estado: "Usada", observaciones: null,
    foto: "05/26", url: "https://manain.com/?sku=MA4075", pagina_pdf: 1
  }]
};

const withFiles = async (work: (path: string) => Promise<void>): Promise<void> => {
  const path = await mkdtemp(join(tmpdir(), "eqz-manain-stocklist-"));
  try {
    const raw = JSON.stringify(stocklist, null, 2);
    await writeFile(join(path, "manain-stocklist.json"), raw);
    await writeFile(join(path, "manain-stocklist.manifest.json"),
      JSON.stringify(createManainStocklistManifest(raw), null, 2));
    await work(path);
  } finally {
    await rm(path, { recursive: true, force: true });
  }
};

test("Manain: manifiesto determinista y lectura íntegra del original", async () => {
  await withFiles(async (path) => {
    const raw = await readFile(join(path, "manain-stocklist.json"), "utf8");
    assert.deepEqual(createManainStocklistManifest(raw), createManainStocklistManifest(raw));
    const result = await readManainStocklist(path);
    assert.equal(result.stocklist.productos.length, 1);
    assert.equal(result.stocklist.fuente.sha256, stocklist.fuente.sha256);
    assert.equal(result.stocklistSha256, createManainStocklistManifest(raw).stocklistSha256);
  });
});

test("Manain: alteraciones del JSON o del manifiesto bloquean el origen", async () => {
  await withFiles(async (path) => {
    const original = await readFile(join(path, "manain-stocklist.json"), "utf8");
    await writeFile(join(path, "manain-stocklist.json"), `${original} `);
    await assert.rejects(readManainStocklist(path), /contenido alterado/);
    await writeFile(join(path, "manain-stocklist.json"), original);
    await writeFile(join(path, "manain-stocklist.manifest.json"), JSON.stringify({
      ...createManainStocklistManifest(original), productCount: 2
    }));
    await assert.rejects(readManainStocklist(path), /manifiesto discordante/);
  });
});

test("Manain: el lector rechaza originales sin manifiesto o con enlaces incompatibles", async () => {
  await withFiles(async (path) => {
    await writeFile(join(path, "manain-stocklist.json"), JSON.stringify({
      ...stocklist, productos: [{ ...stocklist.productos[0], url: "https://manain.com/?sku=OTRA" }]
    }));
    await assert.rejects(readManainStocklist(path), /fila 1/);
    await rm(join(path, "manain-stocklist.manifest.json"));
    await assert.rejects(readManainStocklist(path), /ENOENT/);
  });
});
