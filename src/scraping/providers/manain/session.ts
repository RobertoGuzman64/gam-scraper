import { spawn } from "node:child_process";
import type { ChildProcess } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { waitForDebuggingPort, withTimeout } from "../../../infrastructure/browser/devtools.js";
import { manainCdpPort, selectManainTarget, setManagedManainCdpPort } from "./cdp.js";

const catalogUrl = "https://manain.com/catalogo/venta/";
let launch: Promise<number> | null = null;

const chromeCandidates = (): readonly string[] => {
  const paths = [process.env.CHROME_PATH, process.env.CHROMIUM_PATH];
  if (process.platform === "win32") {
    for (const home of [process.env.PROGRAMFILES, process.env["PROGRAMFILES(X86)"], process.env.LOCALAPPDATA]) {
      if (home) paths.push(`${home}\\Google\\Chrome\\Application\\chrome.exe`, `${home}\\Microsoft\\Edge\\Application\\msedge.exe`);
    }
  }
  paths.push("chromium", "chromium-browser", "google-chrome", "google-chrome-stable", "chrome", "msedge");
  return [...new Set(paths.filter((path): path is string => !!path))];
};

export const manainChromeArguments = (profile: string): readonly string[] => [
  `--user-data-dir=${profile}`,
  "--remote-debugging-address=127.0.0.1",
  "--remote-debugging-port=0",
  "--no-first-run",
  "--no-default-browser-check",
  "--new-window",
  catalogUrl
];

const waitForCatalogTab = async (port: number): Promise<void> => {
  const deadline = Date.now() + 15000;
  while (Date.now() < deadline) {
    try {
      const response = await withTimeout(fetch(`http://127.0.0.1:${port}/json/list`), 2000, "pestañas de Chrome");
      if (response.ok) {
        const targets: unknown = await withTimeout(response.json(), 2000, "respuesta de Chrome");
        selectManainTarget(targets, port);
        return;
      }
    } catch {}
    await new Promise<void>((resolve) => setTimeout(resolve, 300));
  }
  throw new Error("Chrome no abrió la pestaña del catálogo de Manain mediante CDP");
};

const startChrome = async (): Promise<number> => {
  const errors: string[] = [];
  for (const executable of chromeCandidates()) {
    if ((executable.includes("/") || executable.includes("\\")) && !existsSync(executable)) continue;
    const profile = await mkdtemp(join(tmpdir(), "equipzilla-manain-chrome-"));
    let child: ChildProcess | null = null;
    try {
      child = spawn(executable, [...manainChromeArguments(profile)], {
        stdio: "ignore", windowsHide: false
      });
      const current = child;
      const endpoint = await Promise.race([
        waitForDebuggingPort(profile, current, 12000),
        new Promise<never>((_, reject) => current.once("error", reject))
      ]);
      const port = Number(new URL(endpoint).port);
      if (!Number.isSafeInteger(port) || port < 1024 || port > 65535) {
        throw new Error("Chrome devolvió un puerto local inválido");
      }
      await waitForCatalogTab(port);
      setManagedManainCdpPort(port);
      process.once("exit", () => {
        if (current.exitCode === null && current.signalCode === null) current.kill();
      });
      current.unref();
      console.log("MANAIN | Chrome visible iniciado automáticamente; completa la verificación humana si aparece");
      return port;
    } catch (error) {
      errors.push(`${executable}: ${error instanceof Error ? error.message : String(error)}`);
      if (child && child.exitCode === null && child.signalCode === null) child.kill();
      await rm(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 }).catch(() => undefined);
    }
  }
  throw new Error(`Manain: no se pudo iniciar Chrome visible: ${errors.join(" | ") || "navegador no encontrado"}`);
};

export const ensureManainChromeSession = async (): Promise<number> => {
  const existing = manainCdpPort();
  if (existing !== null) return existing;
  launch ??= startChrome().catch((error: unknown) => {
    launch = null;
    throw error;
  });
  return launch;
};
