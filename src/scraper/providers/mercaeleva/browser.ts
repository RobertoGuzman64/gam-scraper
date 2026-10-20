import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { promisify } from "node:util";

const run = promisify(execFile);

const candidateBrowsers = (): readonly string[] => {
  const candidates = [process.env.CHROME_PATH, process.env.CHROMIUM_PATH];
  if (process.platform === "win32") {
    for (const home of [process.env.PROGRAMFILES, process.env["PROGRAMFILES(X86)"], process.env.LOCALAPPDATA]) {
      if (home) candidates.push(`${home}\\Google\\Chrome\\Application\\chrome.exe`, `${home}\\Microsoft\\Edge\\Application\\msedge.exe`);
    }
  }
  candidates.push("chromium", "chromium-browser", "google-chrome", "google-chrome-stable", "chrome", "msedge");
  return [...new Set(candidates.filter((value): value is string => !!value))];
};

export const renderMercaelevaListing = async (url: string, timeoutMs: number): Promise<string> => {
  const flags = [
    "--headless", "--disable-gpu", "--disable-extensions", "--no-first-run", "--no-default-browser-check",
    "--disable-dev-shm-usage", "--window-size=1600,2400", "--virtual-time-budget=12000", "--dump-dom", url
  ];
  if (process.platform === "linux" && process.getuid?.() === 0) flags.unshift("--no-sandbox");

  let lastError: unknown = null;
  for (const executable of candidateBrowsers()) {
    if (executable.includes("/") || executable.includes("\\")) {
      if (!existsSync(executable)) continue;
    }
    try {
      const { stdout } = await run(executable, flags, {
        encoding: "utf8", maxBuffer: 20 * 1024 * 1024, timeout: Math.max(timeoutMs, 20000), windowsHide: true
      });
      if (!stdout.includes("<html") && !stdout.includes("<HTML")) throw new Error(`Chrome no devolvió HTML para ${url}`);
      return stdout;
    } catch (error) {
      lastError = error;
      if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") continue;
      throw new Error(`No se pudo renderizar el listado de Mercaeleva (${executable}): ${String(error)}`);
    }
  }
  throw new Error(`Mercaeleva requiere Chrome/Chromium para cargar los productos. Configura CHROME_PATH con la ruta del ejecutable. ${String(lastError ?? "")}`);
};
