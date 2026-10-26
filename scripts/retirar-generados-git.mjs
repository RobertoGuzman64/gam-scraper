import { spawnSync } from "node:child_process";

const argumentsList = process.argv.slice(2);
if (argumentsList.length > 1 || (argumentsList.length === 1 && argumentsList[0] !== "--aplicar")) {
  console.error("Uso: npm run limpiar:versionados [-- --aplicar]");
  process.exitCode = 1;
} else {
  const git = (...args) => {
    const result = spawnSync("git", args, { encoding: "buffer", windowsHide: true });
    if (result.error || result.status !== 0) {
      throw new Error(`Git no disponible o comando fallido: ${args.join(" ")} | ${result.stderr?.toString("utf8").trim() ?? result.error?.message ?? ""}`);
    }
    return result.stdout;
  };
  try {
    const root = git("rev-parse", "--show-toplevel").toString("utf8").trim();
    const current = git("rev-parse", "--show-prefix").toString("utf8").trim();
    if (current !== "" || root === "") throw new Error("Ejecuta el comando en la raíz del repositorio Git");
    const tracked = git("ls-files", "-z", "--", "storage/scraped", "storage/prepared")
      .toString("utf8").split("\0").filter(Boolean);
    const isGenerated = (path) => {
      const match = /^storage\/(scraped|prepared)\/(gam|gomariz|mercaeleva)\/([a-zA-Z0-9_-]+\.json)$/.exec(path);
      if (!match) return false;
      const name = match[3];
      return match[1] === "scraped" ?
        /-(?:catalog|catalog\.manifest|summary)\.json$/.test(name) :
        /-(?:preparation|preparation\.manifest|diagnostics)\.json$/.test(name);
    };
    const unexpected = tracked.filter((path) => !isGenerated(path));
    if (unexpected.length) throw new Error(`Hay recursos versionados no reconocidos; no se eliminan: ${unexpected.join(", ")}`);
    if (!tracked.length) {
      console.log("GIT | No quedan catálogos ni preparaciones históricos versionados");
    } else {
      if (git("diff", "--name-only", "HEAD", "--", ...tracked).length !== 0) {
        throw new Error("Existen cambios sin guardar en archivos históricos; no se eliminan");
      }
      console.log(`GIT | ${argumentsList.length ? "RETIRANDO" : "SIMULACIÓN"} | ${tracked.length} archivos generados:`);
      for (const path of tracked) console.log(`  ${path}`);
      if (argumentsList.length) {
        git("rm", "--", ...tracked);
        if (git("ls-files", "-z", "--", "storage/scraped", "storage/prepared").length !== 0) {
          throw new Error("Todavía quedan archivos históricos versionados: revisa el índice Git");
        }
        console.log("GIT | Retirada preparada en el índice local; revisa git diff --cached antes de hacer commit y push");
      } else console.log("GIT | Simulación: repite con --aplicar tras revisar la lista");
    }
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
