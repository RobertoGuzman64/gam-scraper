import { execFile } from "node:child_process";
import { homedir, platform } from "node:os";
import { join, resolve } from "node:path";
import { promisify } from "node:util";

const execute = promisify(execFile);

export const findDesktopDirectory = async (): Promise<string> => {
  if (platform() === "win32") {
    const script = "[Console]::OutputEncoding = [System.Text.Encoding]::UTF8; [Environment]::GetFolderPath([Environment+SpecialFolder]::DesktopDirectory)";
    const { stdout } = await execute("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", script], {
      encoding: "utf8", windowsHide: true, maxBuffer: 4096
    });
    const path = stdout.trim();
    if (!path) throw new Error("No se ha podido resolver el Escritorio de Windows");
    return resolve(path);
  }
  return join(homedir(), "Desktop");
};
