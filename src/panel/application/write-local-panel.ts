import { randomUUID } from "node:crypto";
import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { createDashboardPayload } from "./dashboard-data.js";
import { renderPanelHtml } from "./panel-html.js";
import { readPanelSnapshot } from "../evidence/read-panel-snapshot.js";
import { readPanelExplorer } from "../explorer/read-panel-explorer.js";

export const writeLocalPanel = async (workspace: string): Promise<string> => {
  const root = resolve(workspace);
  const snapshot = await readPanelSnapshot(root);
  const explorer = await readPanelExplorer(root, snapshot);
  const content = await renderPanelHtml(root, createDashboardPayload(snapshot, explorer));
  const current = await readPanelSnapshot(root);
  if (current.commercialManifest.sha256 !== snapshot.commercialManifest.sha256 ||
    current.providers.some((provider, index) => provider.publication.sha256 !== snapshot.providers[index]?.publication.sha256)) {
    throw new Error("El corte seleccionado cambió durante la generación del panel");
  }
  const directory = join(root, "panel");
  const destination = join(directory, "index.html");
  await mkdir(directory, { recursive: true });
  try {
    if (await readFile(destination, "utf8") === content) return destination;
  } catch (error: unknown) {
    if (!(error instanceof Error && "code" in error && error.code === "ENOENT")) throw error;
  }
  const temporary = join(directory, `.panel-${randomUUID()}.html`);
  try {
    await writeFile(temporary, content, { encoding: "utf8", flag: "wx" });
    if (await readFile(temporary, "utf8") !== content) {
      throw new Error("El HTML temporal no coincide con los datos validados");
    }
    await rename(temporary, destination);
  } finally {
    await rm(temporary, { force: true });
  }
  return destination;
};
