import { spawnSync } from "node:child_process";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const definitions = {
  "campana:estado": { entry: "cli/campaign-status.js", usage: "campana:estado", description: "Consultar sin escrituras la fase de campaña, entrega, referencia y próximos comandos" },
  "campana:comparar": { entry: "cli/campaign-compare.js", usage: "campana:comparar", description: "Comparar los catálogos originales completos con la referencia única (solo lectura)" },
  "campana:referencia": { entry: "cli/campaign-reference.js", usage: "campana:referencia [-- --actualizar | --recuperar | --exportar <carpeta> | --importar <carpeta> [--sustituir]]", description: "Consultar (solo lectura), actualizar o trasladar con integridad la referencia operativa" },
  "campana:extraer": { entry: "cli/campaign-extract.js", usage: "campana:extraer [-- --nueva]", description: "Extraer los tres proveedores y preparar/revisar el lote aislado" },
  "campana:intervenir": { entry: "cli/campaign-intervene.js", usage: "campana:intervenir -- gam --listar | --consultar <id> | --mantenimiento | --script <archivo.ts> [--aplicar]", description: "Consultar scripts versionados o simular/aplicar correcciones del lote actual", requiresProvider: true },
  "campana:entregar": { entry: "cli/campaign-deliver.js", usage: "campana:entregar", description: "Entregar ZIP comprobado con tres JSON en el Escritorio sin perder la versión anterior" },
  "campana:finalizar": { entry: "cli/campaign-finalize.js", usage: "campana:finalizar [-- --listar | --consultar <proveedor> <ref> | --validar | --decidir <proveedor> <ref> <excluir|incluir> --motivo <texto> --evidencia <url> | --aprobar --motivo <texto> | --simular]", description: "Gestionar y aprobar decisiones editoriales mediante comandos, sin editar JSON" },
  "campana:revisar": { entry: "cli/campaign-review.js", usage: "campana:revisar", description: "Revisar Ready y Review; puede crear preparaciones que todavía falten" },
  iniciar: { entry: "cli/start.js", usage: "iniciar", description: "Comprobar entorno y descubrir campaña sin extraer" },
  extraer: { entry: "cli/index.js", prefix: ["scrape"], usage: "extraer -- gam [--categoria venta] [--paginas 2]", description: "Extraer un proveedor", requiresProvider: true },
  "extraer:todos": { entry: "cli/index.js", prefix: ["batch"], usage: "extraer:todos -- [--proveedores gam,gomariz] [--simular]", description: "Extraer todos o varios proveedores" },
  "intervenir:preparar": { entry: "cli/prepare-intervention.js", usage: "intervenir:preparar -- gam --derivado <catalog-derived.json> --origen <original-catalog.json> [--simular]", description: "Preparar manualmente un catálogo intervenido", requiresProvider: true },
  "intervenir:validar": { entry: "cli/validate-intervention.js", usage: "intervenir:validar -- gam --derivado <catalog-derived.json> --origen <original-catalog.json> --preparacion <preparation.json>", description: "Validar preparación intervenida y su procedencia", requiresProvider: true },
  intervenir: { entry: "cli/intervene.js", usage: "intervenir -- gam --script <archivo.ts> [--script <otro.ts> ...] --origen <catalog.json> [--detalle] [--campana <id> --aplicar --plan <sha>]", description: "Simular o aplicar manualmente intervención con SHA aprobado", requiresProvider: true },
  preparar: { entry: "cli/prepare.js", usage: "preparar -- gam --origen <catalog.json> [--simular]", description: "Preparar un catálogo guardado", requiresProvider: true },
  validar: { entry: "cli/index.js", prefix: ["validate"], usage: "validar -- gam [--etapa catalogo --origen <catalog.json>]", description: "Validar catálogo o preparación", requiresProvider: true },
  exportar: { entry: "cli/index.js", prefix: ["export"], usage: "exportar -- gam --companyID <id> --preparacion <archivo> --inventario <csv> --salida <xlsx> --simular", description: "Revisar o generar una exportación", requiresProvider: true },
  cobertura: { entry: "cli/review-coverage.js", usage: "cobertura -- --anterior <catalog.json> --actual <catalog.json> --simular", description: "Auditar ausencias y cambios de catálogo" },
  seleccionar: { entry: "cli/select-publishable.js", usage: "seleccionar -- --gam <preparation.json> --gomariz <preparation.json> --mercaeleva <preparation.json> --lote <run.json> --borrador <acreditacion.json> (o --acreditacion <acreditacion.json> --simular)", description: "Seleccionar fichas publicables" },
  "campana:limpiar": { entry: "cli/campaign-clean.js", usage: "campana:limpiar [-- --aplicar]", description: "Simular o cerrar la campaña ya entregada; protege scripts y trabajos pendientes" },
  "limpiar:almacen": { entry: "cli/storage-clean.js", usage: "limpiar:almacen [-- --aplicar]", description: "Simular limpieza; ejecutar solo con --aplicar", defaultSimulation: true },
  "normalizar:gam": { entry: "tools/gam/normalize-csv.js", usage: "normalizar:gam -- <entrada.csv> <salida.csv> [--informe <json>]", description: "Normalizar un CSV GAM" },
  "normalizar:gam:base": { entry: "tools/gam/normalize-csv.js", fixed: ["storage/scraped/gam/scrape-gam-marzo-2026-all.csv", "storage/normalized/gam/scrape-gam-marzo-2026-all.normalized.csv", "--report", "storage/normalized/gam/normalize.report.json"], usage: "normalizar:gam:base", description: "Normalizar las rutas GAM predeterminadas" },
  "convertir:gam": { entry: "tools/gam/seed/convert-csv.js", usage: "convertir:gam -- <entrada.csv> <salida.ts> <categorias.json>", description: "Convertir CSV GAM a semilla" },
  "convertir:gam:original": { entry: "tools/gam/seed/convert-csv.js", fixed: ["storage/scraped/gam/scrape-gam-marzo-2026-all.csv", "storage/seeds/seedDataProduct.gam.ts", "data/category/categorySell-flat.json"], usage: "convertir:gam:original", description: "Convertir el CSV GAM original" },
  "convertir:gam:base": { entry: "tools/gam/seed/convert-csv.js", fixed: ["storage/normalized/gam/scrape-gam-marzo-2026-all.normalized.csv", "storage/seeds/seedDataProduct.gam.ts", "data/category/categorySell-flat.json"], usage: "convertir:gam:base", description: "Convertir el CSV GAM normalizado" },
  "categorias:arbol": { entry: "tools/gam/seed/convert-csv-by-category.js", usage: "categorias:arbol -- <opciones>", description: "Generar semillas por categoría GAM" },
  "urls:gam": { entry: "tools/gam/seed/convert-csv-by-url.js", usage: "urls:gam -- <opciones>", description: "Generar semillas por URL GAM" },
  consola: { entry: "cli/index.js", usage: "consola -- <subcomando> [opciones]", description: "Acceso avanzado a la CLI existente" }
};

const legacy = {
  scrape: "extraer",
  "scrape:all": "extraer:todos",
  "prepare:catalog": "preparar",
  "validate:catalog": "validar",
  validate: "validar",
  "check:catalog": "validar",
  "export:import": "exportar",
  export: "exportar",
  "review:coverage": "cobertura",
  coverage: "cobertura",
  "select:publishable": "seleccionar",
  publish: "seleccionar",
  "storage:clean": "limpiar:almacen",
  "normalize:gam": "normalizar:gam",
  "normalize:gam:default": "normalizar:gam:base",
  "convert:gam": "convertir:gam",
  "convert:gam:raw:default": "convertir:gam:original",
  "convert:gam:default": "convertir:gam:base",
  "category:tree": "categorias:arbol",
  "slugs:gam": "urls:gam",
  cli: "consola"
};

const options = {
  "--simular": "--dry-run",
  "--categoria": "--category",
  "--paginas": "--pages",
  "--proveedores": "--providers",
  "--origen": "--source",
  "--salida": "--out",
  "--directorio-salida": "--outDir",
  "--comparar": "--compare",
  "--anterior": "--baseline",
  "--actual": "--current",
  "--catalogo": "--catalog",
  "--revision-cobertura": "--coverage-review",
  "--preparacion": "--preparation",
  "--derivado": "--derived",
  "--inventario": "--existing",
  "--confirmar-inventario": "--confirm-inventory",
  "--empresa": "--companyID",
  "--formato": "--format",
  "--permitir-inventario-vacio": "--allow-empty-inventory",
  "--etapa": "--stage",
  "--informe": "--report",
  "--ayuda": "--help"
};

const printHelp = (requested) => {
  if (!requested) {
    console.log("EQUIPZILLA | HERRAMIENTAS\n");
    console.log("Uso: npm run <comando> -- [argumentos]\n");
    for (const [command, value] of Object.entries(definitions)) {
      console.log(`  ${command.padEnd(26)} ${value.description}`);
    }
    console.log("\nEJEMPLOS\n");
    console.log("  npm run iniciar  (crea carpetas de trabajo si faltan)");
    console.log("  npm run campana:estado  (consulta sin escrituras)");
    console.log("  npm run campana:extraer");
    console.log("  npm run campana:comparar");
    console.log("  npm run campana:referencia  (solo lectura; incluso tras limpiar)");
    console.log("  npm run campana:referencia -- --actualizar  (después de entregar; antes de limpiar)");
    console.log("  npm run campana:referencia -- --exportar <carpeta-nueva>  (respaldo/traslado)");
    console.log("  npm run campana:revisar");
    console.log("  npm run campana:intervenir -- gam --listar");
    console.log("  npm run campana:intervenir -- gam --consultar gam-6002");
    console.log("  npm run campana:intervenir -- gam --mantenimiento");
    console.log("  npm run campana:intervenir -- gam --script interventions/gam/6002.ts");
    console.log("  npm run campana:finalizar");
    console.log("  npm run campana:finalizar -- --listar");
    console.log("  npm run campana:finalizar -- --consultar gam 6682");
    console.log("  npm run campana:finalizar -- --validar");
    console.log("  npm run campana:finalizar -- --aprobar --motivo \"Motivo global documentado de la campaña\"");
    console.log("  npm run campana:entregar");
    console.log("  npm run campana:limpiar");
    console.log("  LECTURA | campana:estado, campana:comparar, campana:referencia sin argumentos y modos editoriales de consulta.");
    console.log("  PREPARACIÓN/ESCRITURA | iniciar crea carpetas; campana:revisar puede preparar; campana:finalizar crea selección y sus modos de decisión escriben.");
    console.log("  AUTORIZACIÓN | campana:referencia --actualizar, campana:finalizar --aprobar y campana:limpiar --aplicar son acciones explícitas.");
    console.log("  npm run limpiar:versionados  (limpia solo archivos históricos rastreados por Git)");
    console.log("  npm run extraer -- gam");
    console.log("  npm run extraer:todos -- --simular");
    console.log("  npm run preparar -- gam --origen storage/scraped/gam/archivo-catalog.json --simular");
    console.log("  npm run validar -- gam --etapa catalogo --origen archivo-catalog.json");
    console.log("  npm run limpiar:almacen");
    console.log("\n  npm run ayuda -- preparar      Ayuda de un comando");
    console.log("  npm run ayuda -- opciones       Alias españoles de opciones");
    console.log("\n  npm ci instala dependencias sin extraer ni preparar catálogos.");
    console.log("  npm run limpiar:almacen y campana:limpiar simulan; --aplicar autoriza la limpieza.");
    console.log("  npm test y npm run build siguen siendo compatibles con npm.");
    console.log("  Los comandos antiguos permanecen como alias de compatibilidad.");
    return true;
  }
  if (requested === "opciones") {
    console.log("OPCIONES EN ESPAÑOL (también se aceptan las originales)\n");
    for (const [alias, original] of Object.entries(options)) console.log(`  ${alias.padEnd(26)} ${original}`);
    console.log("  --actualizar                Sustituye la referencia únicamente en campana:referencia");
    console.log("  --aplicar                   Ejecuta la limpieza en lugar de simularla");
    return true;
  }
  const definition = definitions[legacy[requested] ?? requested];
  if (!definition) return false;
  console.log(`${definition.description}\n\nUso: npm run ${definition.usage}`);
  if (definition.defaultSimulation) console.log("No elimina nada sin --aplicar. El comando anterior storage:clean conserva su comportamiento.");
  console.log("Opciones: npm run ayuda -- opciones");
  return true;
};

const fail = (message, command) => {
  console.error(`HERRAMIENTAS | ERROR | ${message}`);
  if (command) console.error(`Consulta: npm run ayuda -- ${command}`);
  process.exitCode = 1;
};

const rawCommand = process.argv[2] ?? "ayuda";
const args = process.argv.slice(3);
const command = legacy[rawCommand] ?? rawCommand;
const selected = definitions[command];

if (rawCommand === "ayuda") {
  if (args.length > 1 || !printHelp(args[0])) fail("Comando de ayuda desconocido");
} else if (!selected) {
  fail(`Comando desconocido: ${rawCommand}. Consulta npm run ayuda`);
} else if (args.length === 1 && (args[0] === "--help" || args[0] === "--ayuda" || args[0] === "-h")) {
  printHelp(command);
} else if (selected.entry.startsWith("tools/") && args.some((argument) => ["--help", "--ayuda", "-h"].includes(argument))) {
  fail("La ayuda no admite argumentos adicionales", command);
} else {
  const normalized = args.map((argument) => options[argument] ?? argument);
  for (let index = 0; index < normalized.length - 1; index += 1) {
    if (normalized[index] === "--stage") {
      if (normalized[index + 1] === "catalogo") normalized[index + 1] = "catalog";
      if (normalized[index + 1] === "preparacion") normalized[index + 1] = "preparation";
    }
  }
  if (selected.requiresProvider && !(rawCommand === "scrape" && normalized.length === 0) && (normalized.length === 0 || normalized[0]?.startsWith("-"))) {
    fail("Falta el proveedor (gam, gomariz o mercaeleva)", command);
  } else if (command === "limpiar:almacen" && rawCommand !== "storage:clean" && normalized.includes("--aplicar") && normalized.includes("--dry-run")) {
    fail("No combines --aplicar y --simular", command);
  } else if (normalized.includes("--aplicar") && ((command !== "limpiar:almacen" && command !== "campana:limpiar" && command !== "intervenir" && command !== "campana:intervenir") || rawCommand === "storage:clean")) {
    fail("--aplicar solo corresponde a limpiar:almacen, campana:limpiar o intervenir", command);
  } else {
    const cleaned = command === "intervenir" || command === "campana:intervenir" || command === "campana:limpiar" ? normalized : normalized.filter((argument) => argument !== "--aplicar");
    if (selected.defaultSimulation && rawCommand !== "storage:clean" && !normalized.includes("--aplicar") && !cleaned.includes("--dry-run")) cleaned.push("--dry-run");
    const compile = spawnSync(process.execPath, [join(root, "scripts/run-build.mjs"), "--quiet"], {
      cwd: root, stdio: "inherit", windowsHide: true
    });
    if (compile.error || compile.status !== 0) {
      fail(compile.error?.message ?? `No se pudo compilar (código ${compile.status ?? "desconocido"})`);
    } else {
      const result = spawnSync(process.execPath, [join(root, "dist", selected.entry), ...(selected.prefix ?? []), ...(selected.fixed ?? []), ...cleaned], {
        cwd: root, stdio: "inherit", windowsHide: true
      });
      if (result.error) fail(result.error.message);
      else if (result.signal) fail(`La operación terminó por señal ${result.signal}`);
      else process.exitCode = result.status ?? 1;
    }
  }
}
