import assert from "node:assert/strict";
import { access, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { runExport } from "../../../cli/export.js";
import { prepareExport } from "../prepare-export.js";
import { prepareSavedCatalog } from "../../preparation/prepare.js";
import { writeOutputs } from "../../publication/publish.js";
import type { ProductRecord } from "../../../contracts/catalog.js";
import type { CategoryConfig } from "../../../contracts/scraping.js";
import { offlinePreparationManifestPath } from "../../../infrastructure/filesystem/offline-preparation.js";

const category: CategoryConfig = {
  key: "elevacion-nueva", name: "Plataformas elevadoras nuevas", url: "https://example.test/catalogo"
};

const machine = (reference: string, condition: "Nuevo" | "Segunda mano" | null, price: string | null): ProductRecord => ({
  providerId: "gam", categoryKey: condition === "Segunda mano" ? "elevacion" : "elevacion-nueva",
  categoryName: condition === "Segunda mano" ? "Plataformas de ocasión" : "Plataformas nuevas",
  url: condition === "Segunda mano"
    ? `https://online.gamrentals.com/es/plataformas-elevadoras-tijera-electricas-segunda-mano/${reference}-maquina`
    : `https://online.gamrentals.com/es/plataformas-de-tijera-electricas-xcmg/${reference}-maquina`,
  reference, title: "Plataforma de tijera eléctrica XCMG", shortDescription: "Plataforma eléctrica",
  longDescription: "Maquinaria", price, brand: "XCMG", model: "Tijera", year: null, location: null,
  country: null, horometer: null, serialNumber: null, condition,
  image: "https://example.test/image.jpg", images: ["https://example.test/image.jpg"],
  specs: { "Altura de trabajo": "8 m" }
});

const fixture = async (run: (paths: {
  source: string; preparation: string; inventory: string; out: string; root: string;
}) => Promise<void>) => {
  const root = await mkdtemp(join(tmpdir(), "equipzilla-export-stage3-"));
  const source = join(root, "scraped", "fase3-catalog.json");
  const preparation = join(root, "prepared", "fase3-preparation.json");
  const inventory = join(root, "inventario.csv");
  const out = join(root, "altas.xlsx");
  const products = [
    machine("11111", "Nuevo", "20000 €"), machine("22222", "Segunda mano", "18000 €"),
    machine("33333", "Nuevo", null), machine("44444", null, "17000 €")
  ];
  const now = new Date().toISOString();
  try {
    await writeOutputs(join(root, "scraped"), "fase3", [{ category, products, discoveredProductUrls: 4, failures: [] }], now, now);
    await prepareSavedCatalog({ providerId: "gam", source, out: preparation, dryRun: false, compare: null });
    await writeFile(inventory, "companyID,reference\n45,11111\n");
    await run({ source, preparation, inventory, out, root });
  } finally { await rm(root, { recursive: true, force: true }); }
};

const args = (preparation: string, source: string, inventory: string, out: string) => [
  "gam", "--companyID", "45", "--preparation", preparation,
  "--source", source, "--existing", inventory, "--out", out
];

test("export offline: dry-run no escribe, inventario excluye existentes y XLSX contiene solo altas ready", async (t) => {
  t.mock.method(console, "log", () => {});
  await fixture(async ({ source, preparation, inventory, out }) => {
    const argumentsList = args(preparation, source, inventory, out);
    const sourceBefore = await readFile(source, "utf8");
    const oldFetch = globalThis.fetch;
    globalThis.fetch = () => { throw new Error("No acceder a la red"); };
    try {
      await runExport([...argumentsList, "--dry-run"]);
      await assert.rejects(access(out), { code: "ENOENT" });
      await assert.rejects(access(`${out}.report.json`), { code: "ENOENT" });
      await runExport([...argumentsList, "--confirm-inventory"]);
      assert.equal((await readFile(out)).readUInt32LE(0), 0x04034b50);
      const report: unknown = JSON.parse(await readFile(`${out}.report.json`, "utf8"));
      assert.ok(report && typeof report === "object" && "newProducts" in report && report.newProducts === 1);
      assert.ok("existingProducts" in report && report.existingProducts === 1);
      assert.ok("reviewProducts" in report && report.reviewProducts === 2);
      assert.equal(await readFile(source, "utf8"), sourceBefore);
      await assert.rejects(runExport([...argumentsList, "--confirm-inventory"]), { code: "EEXIST" });
    } finally { globalThis.fetch = oldFetch; }
  });
});

test("export offline bloquea manipulación de manifiestos e inventario incorrecto", async () => {
  await fixture(async ({ source, preparation, inventory, out }) => {
    const argumentsList = args(preparation, source, inventory, out);
    await writeFile(inventory, "companyID,reference\n99,11111\n");
    await assert.rejects(prepareExport("gam", 45, preparation, inventory, false, source), /companyID|compañía/i);
    await writeFile(inventory, "companyID,reference\n45,11111\n");
    const manifestPath = offlinePreparationManifestPath(preparation);
    await writeFile(manifestPath, "{}");
    await assert.rejects(runExport([...argumentsList, "--confirm-inventory"]), /Manifest/);
    await assert.rejects(access(out), { code: "ENOENT" });
  });
});
