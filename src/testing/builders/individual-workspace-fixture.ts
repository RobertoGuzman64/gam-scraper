import assert from "node:assert/strict";
import { cp, copyFile, mkdir, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after } from "node:test";
import type { ProductRecord } from "../../contracts/catalog.js";
import type { CategoryConfig, CategoryScrapeResult } from "../../contracts/scraping.js";
import { consolidatePortableOriginal } from "../../infrastructure/filesystem/catalog/portable-original.js";
import { prepareIndividualCatalogs } from "../../pipeline/preparation/individual-prepare.js";
import { writeOutputs } from "../../pipeline/publication/publish.js";

const providers = ["gam", "gomariz", "mercaeleva"] as const;
const category: CategoryConfig = {
  key: "elevacion-nueva", name: "Plataformas elevadoras nuevas", url: "https://example.test/catalogo"
};

const product = (reference: string, serialNumber: string | null): ProductRecord => ({
  providerId: "gam", categoryKey: category.key, categoryName: category.name,
  url: `https://online.gamrentals.com/es/plataformas-de-tijera-electricas-xcmg/${reference}-maquina`,
  reference, title: "Plataforma de tijera eléctrica XCMG", shortDescription: "Plataforma eléctrica",
  longDescription: "Maquinaria", price: "20000 €", brand: "XCMG", model: "Tijera", year: null,
  location: null, country: null, horometer: null, serialNumber, condition: "Nuevo",
  image: "https://example.test/image.jpg", images: ["https://example.test/image.jpg"],
  specs: { "Altura de trabajo": "8 m" }
});

export const prepareIndividualTestWorkspace = async (root: string): Promise<void> => {
  const results = await prepareIndividualCatalogs({ workspace: root, providers, dryRun: false });
  assert.ok(results.every((item) => item.error === null), JSON.stringify(results.map((item) => item.error)));
};

const createOriginals = async (root: string, serialNumber: string): Promise<void> => {
  const src = join(root, "fuente-gam");
  await mkdir(src);
  const products = [product("11111", serialNumber), product("22222", serialNumber), product("33333", null)];
  const scraped: CategoryScrapeResult = { category, products, discoveredProductUrls: products.length, failures: [] };
  await writeOutputs(src, "scrape-gam", [scraped], "2026-11-03T11:00:00Z", "2026-11-03T11:00:00Z");
  await consolidatePortableOriginal(root, join(src, "scrape-gam-catalog.json"));
  for (const id of ["gomariz", "mercaeleva"] as const) {
    const folder = join(root, `fuente-${id}`);
    await mkdir(folder);
    for (const name of [`scrape-${id}-catalog.json`, `scrape-${id}-catalog.manifest.json`, `scrape-${id}-summary.json`]) {
      await copyFile(join(process.cwd(), "src", "testing", "fixtures", id, name), join(folder, name));
    }
    await consolidatePortableOriginal(root, join(folder, `scrape-${id}-catalog.json`));
  }
};

type FixtureState = "original" | "prepared" | "approved";

type FixtureOptions = {
  readonly prefix: string;
  readonly serialNumber: string;
  readonly defaultState: FixtureState;
  readonly approve?: (root: string) => Promise<void>;
};

export const createIndividualWorkspaceFixture = (options: FixtureOptions) => {
  const seeds = new Map<FixtureState, Promise<string>>();
  const roots = new Set<string>();

  const seed = (state: FixtureState): Promise<string> => {
    const existing = seeds.get(state);
    if (existing) return existing;
    const created = (async (): Promise<string> => {
      const root = await mkdtemp(join(tmpdir(), `${options.prefix}base `));
      roots.add(root);
      try {
        if (state === "original") {
          await createOriginals(root, options.serialNumber);
        } else {
          await cp(await seed(state === "prepared" ? "original" : "prepared"), root, { recursive: true });
          if (state === "prepared") await prepareIndividualTestWorkspace(root);
          else {
            if (!options.approve) throw new Error("La fixture no tiene aprobación editorial configurada");
            await options.approve(root);
          }
        }
        return root;
      } catch (error) {
        await rm(root, { recursive: true, force: true, maxRetries: 3 });
        throw error;
      }
    })();
    seeds.set(state, created);
    return created;
  };

  after(async () => {
    await Promise.allSettled([...seeds.values()]);
    await Promise.all([...roots].map((root) => rm(root, { recursive: true, force: true, maxRetries: 3 })));
  });

  return async (
    action: (root: string, desktop: string) => Promise<void>,
    state: FixtureState = options.defaultState
  ): Promise<void> => {
    const original = await seed(state);
    const root = await mkdtemp(join(tmpdir(), options.prefix));
    try {
      await cp(original, root, { recursive: true });
      const desktop = join(root, "Escritorio con espacios");
      await mkdir(desktop);
      await action(root, desktop);
    } finally {
      await rm(root, { recursive: true, force: true, maxRetries: 3 });
    }
  };
};
