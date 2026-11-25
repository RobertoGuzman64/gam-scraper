import { cp, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after } from "node:test";
import type { ProductRecord } from "../../contracts/catalog.js";
import type { CategoryConfig, CategoryScrapeResult } from "../../contracts/scraping.js";
import { prepareSavedCatalog } from "../../preparation/workflow/prepare.js";
import { writeOutputs } from "../../scraping/output/publish.js";
import { approveIndividualEditorial, decideIndividualEditorial, startIndividualEditorial } from "../individual/individual-editorial.js";
import type { IndividualEditorialOptions } from "../individual/individual-editorial.js";

export const reason = "Identidad de origen sin garantías suficientes para publicar";

export const optionsFor = (root: string): IndividualEditorialOptions => ({
  rootDirectory: root, providerId: "gam",
  catalogFile: join(root, "original", "catalogo-ejemplo-catalog.json"),
  preparationFile: join(root, "prepared", "catalogo-ejemplo-preparation.json")
});

export const createIndividualEditorialFixture = (
  category: CategoryConfig,
  machine: (reference: string, serialNumber: string | null) => ProductRecord
) => {
  let baseWorkspace: Promise<string> | undefined;

  let baseApprovedWorkspace: Promise<string> | undefined;

  const createBaseWorkspace = async (): Promise<string> => {
    const root = await mkdtemp(join(tmpdir(), "equipzilla-editorial-seed-"));
    const now = new Date().toISOString();
    const products = [machine("11111", "SERIE-COMPARTIDA"), machine("22222", "SERIE-COMPARTIDA"), machine("33333", null)];
    const result: CategoryScrapeResult = { category, discoveredProductUrls: products.length, products, failures: [] };
    try {
      await writeOutputs(join(root, "original"), "catalogo-ejemplo", [result], now, now);
      await prepareSavedCatalog({
        providerId: "gam", source: join(root, "original", "catalogo-ejemplo-catalog.json"),
        out: join(root, "prepared", "catalogo-ejemplo-preparation.json"), dryRun: false, compare: null
      });
      return root;
    } catch (error) {
      await rm(root, { recursive: true, force: true });
      throw error;
    }
  };

  const createApprovedWorkspace = async (): Promise<string> => {
    baseWorkspace ??= createBaseWorkspace();
    const source = await baseWorkspace;
    const root = await mkdtemp(join(tmpdir(), "equipzilla-editorial-approved-seed-"));
    try {
      await cp(source, root, { recursive: true });
      const options = optionsFor(root);
      const started = await startIndividualEditorial(options);
      for (const item of started.accreditation.exclusions) {
        await decideIndividualEditorial(options, {
          reference: item.reference, decision: "excluir", reason, evidenceUrls: [item.sourceUrl]
        });
      }
      await approveIndividualEditorial(options, "Selección individual contrastada y aprobada expresamente");
      return root;
    } catch (error) {
      await rm(root, { recursive: true, force: true });
      throw error;
    }
  };

  const fixture = async (
    run: (options: IndividualEditorialOptions) => Promise<void>,
    state: "prepared" | "approved" = "prepared"
  ): Promise<void> => {
    const seed = state === "approved"
      ? (baseApprovedWorkspace ??= createApprovedWorkspace())
      : (baseWorkspace ??= createBaseWorkspace());
    const source = await seed;
    const root = await mkdtemp(join(tmpdir(), "equipzilla-editorial-individual-"));
    try {
      await cp(source, root, { recursive: true });
      await run(optionsFor(root));
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  };

  after(async () => {
    const seeds = [baseApprovedWorkspace, baseWorkspace].filter((value): value is Promise<string> => value !== undefined);
    const results = await Promise.allSettled(seeds);
    await Promise.all(results.flatMap((result) => result.status === "fulfilled"
      ? [rm(result.value, { recursive: true, force: true })] : []));
  });

  return fixture;
};
