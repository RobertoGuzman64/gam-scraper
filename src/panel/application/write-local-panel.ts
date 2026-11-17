import { mkdir, writeFile } from "node:fs/promises";
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
  const directory = join(root, "panel");
  const destination = join(directory, "index.html");
  await mkdir(directory, { recursive: true });
  await writeFile(destination, content, { encoding: "utf8", flag: "w" });
  return destination;
};
