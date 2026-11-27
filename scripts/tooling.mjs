import { spawnSync } from "node:child_process";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { formatScriptStatus } from "./terminal.mjs";
import { isCurrentBuild } from "./build/build-cache.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const definitions = {
  iniciar: { entry: "cli/commands/maintenance/start.js", usage: "iniciar", description: "Comprobar entorno y descubrir campaña sin extraer" },
  "comercial:contrato": { entry: "guards/tests-commercial-contract-guard.mjs", usage: "comercial:contrato", description: "Verificar el contrato comercial v2 sin compilar ni generar catálogos" },
  "comercial": { entry: "cli/commands/catalog/commercial/commercial-export.js", defaultEnvironment: "develop", usage: "comercial [-- --entorno develop|production] [--simular] [--salida <directorio-nuevo>] [--detalle]", description: "Entregar ZIP comercial (develop por defecto) en Escritorio y actualizar informe interno, o JSON mediante --salida, sin publicar" },
  "comercial:simular": { entry: "cli/commands/catalog/commercial/commercial-export.js", fixed: ["--dry-run"], defaultEnvironment: "develop", usage: "comercial:simular [-- --entorno develop|production] [--detalle] [--salida <directorio-nuevo>]", description: "Simular la exportación comercial en develop por defecto, sin escrituras" },
  "comercial:auditar": { entry: "cli/commands/catalog/commercial/commercial-audit.js", usage: "comercial:auditar [-- --detalle|--acreditacion|--json|--verificar=RUTA [--informe=ZIP]]", description: "Auditar sin escrituras las propuestas de categoría, atributos y cobertura comercial de publicaciones acreditadas" },
  "auditar:huecos": { entry: "cli/commands/catalog/audits/catalog-content-gaps.js", usage: "auditar:huecos [-- --finales | --tecnicas | --catalogo ruta/-catalog.json | --publicacion ruta/-publishable.json] [--agrupar categoria|marca|modelo] [--min-grupo 8] [--min-ausentes 3] [--top 20] [--detalle] [--json] [--comparar --titulos]", description: "Diagnóstico de desarrollo bajo demanda: huecos canónicos o calidad editorial de publicaciones acreditadas; solo lectura" },
  "auditar:normalizacion": { entry: "cli/commands/catalog/audits/normalization-audit.js", usage: "auditar:normalizacion [-- --top 20] [--detalle] | [-- --json]", description: "Diagnóstico de desarrollo bajo demanda: normalización técnica de originales, preparación actual y publicaciones acreditadas; solo lectura" },
  estado: { entry: "cli/commands/campaign/campaign-status.js", usage: "estado [-- --detalle]", description: "Consultar sin escrituras el estado de campaña, entrega, referencia y próximos comandos" },
  extraer: { entry: "cli/commands/campaign/campaign-extract.js", usage: "extraer [-- --nueva]", description: "Extraer los cuatro proveedores y preparar/revisar el lote aislado" },
  revisar: { entry: "cli/commands/campaign/campaign-review.js", usage: "revisar", description: "Revisar Ready y Review; puede crear preparaciones que todavía falten" },
  intervenir: { entry: "cli/commands/campaign/campaign-intervene.js", usage: "intervenir -- gam --listar | --consultar <id> | --mantenimiento | --script <archivo.ts> [--aplicar]", description: "Consultar scripts versionados o simular/aplicar correcciones del lote actual", requiresProvider: true },
  acreditar: { entry: "cli/commands/campaign/campaign-finalize.js", usage: "acreditar [-- --listar | --consultar <proveedor> <ref> | --validar | --decidir <proveedor> <ref> <excluir|incluir> --motivo <texto> --evidencia <url> | --aprobar --motivo <texto> | --simular]", description: "Gestionar y aprobar decisiones editoriales mediante comandos, sin editar JSON" },
  entregar: { entry: "cli/commands/campaign/campaign-deliver.js", usage: "entregar [-- --publicos | --informes --entorno develop|production]", description: "Entregar campaña o agrupar públicos/informes vigentes bajo demanda" },
  "entregar:publicos": { entry: "cli/commands/campaign/campaign-deliver.js", fixed: ["--publicos"], usage: "entregar:publicos", description: "Agrupar las cuatro publicaciones vigentes acreditadas bajo demanda" },
  "entregar:informes": { entry: "cli/commands/campaign/campaign-deliver.js", fixed: ["--informes"], defaultEnvironment: "develop", usage: "entregar:informes [-- --entorno develop|production]", description: "Agrupar informes internos vigentes, develop por defecto" },
  comparar: { entry: "cli/commands/campaign/campaign-compare.js", usage: "comparar", description: "Comparar los originales completos con la última entrega retenida (solo lectura)" },
  referencia: { entry: "cli/commands/campaign/campaign-reference.js", usage: "referencia [-- --actualizar | --recuperar | --exportar <carpeta> | --importar <carpeta> [--sustituir]]", description: "Consultar y trasladar referencias históricas con integridad (legado)" },
  recuperar: { entry: "cli/commands/campaign/campaign-recover.js", usage: "recuperar -- <runId> | --recuperar <runId> | --abandonar <runId> --confirmar <runId>", description: "Consultar y abandonar expresamente un intento fallido; no es limpieza ordinaria" },
  "manain:muestra": { entry: "cli/commands/manain/sample.js", usage: "manain:muestra", description: "Leer cinco fichas de Manain con Chrome visible en modo diagnóstico no publicable" },
  "manain:censo": { entry: "cli/commands/manain/census.js", usage: "manain:censo", description: "Contar y guardar las URL del catálogo de venta de Manain sin extraer fichas" },
  "extraer:proveedor": { entry: "cli/index.js", prefix: ["scrape"], usage: "extraer:proveedor -- gam [--categoria venta] [--paginas 2]", description: "Extraer un proveedor", requiresProvider: true },
  "extraer:todos": { entry: "cli/index.js", prefix: ["batch"], usage: "extraer:todos -- [--proveedores gam,gomariz] [--simular]", description: "Extraer todos o varios proveedores" },
  "intervenir:manual": { entry: "cli/commands/interventions/intervene.js", usage: "intervenir:manual -- gam --script <archivo.ts> [--script <otro.ts> ...] --origen <catalog.json> [--detalle] [--campana <id> --aplicar --plan <sha>]", description: "Simular o aplicar manualmente intervención con SHA aprobado", requiresProvider: true },
  "intervenir:preparar": { entry: "cli/commands/interventions/prepare-intervention.js", usage: "intervenir:preparar -- gam --derivado <catalog-derived.json> --origen <original-catalog.json> [--simular]", description: "Preparar manualmente un catálogo intervenido", requiresProvider: true },
  "intervenir:validar": { entry: "cli/commands/interventions/validate-intervention.js", usage: "intervenir:validar -- gam --derivado <catalog-derived.json> --origen <original-catalog.json> --preparacion <preparation.json>", description: "Validar preparación intervenida y su procedencia", requiresProvider: true },
  "catalogo:acreditar": { entry: "cli/commands/catalog/individual/accredit-individual.js", usage: "catalogo:acreditar [-- --proveedor gam|gomariz|mercaeleva|manain] [--simular]", description: "Comando opcional: acreditar automáticamente exclusiones históricas idénticas; el FINISH ya lo hace" },
  "publicar": { entry: "cli/commands/catalog/individual/publish-individual.js", usage: "publicar [-- --proveedor gam|gomariz|mercaeleva|manain] [--simular] [--detalle] [--estado]", description: "Paso 2/2: FINISH, preflight conjunto, entrega interna, activación verificada, diario de recuperación, retención e informe interno" },
  "publicar:simular": { entry: "cli/commands/catalog/individual/publish-individual.js", fixed: ["--dry-run"], usage: "publicar:simular [-- --proveedor gam|gomariz|mercaeleva|manain] [--detalle]", description: "Simular FINISH de los cuatro proveedores, sin escrituras ni activaciones" },
  "preparar": { entry: "cli/commands/catalog/individual/prepare-individual.js", usage: "preparar [-- --proveedor gam|gomariz|mercaeleva|manain] [--simular] [--detalle]", description: "Paso 1/2: preparar offline los cuatro proveedores individuales desde originales portátiles, con diagnóstico y reutilización segura" },
  "preparar:manual": { entry: "cli/commands/catalog/prepare.js", usage: "preparar:manual -- gam --origen <catalog.json> | manain --origen <partial-all.csv> --censo <censo.json> [--simular]", description: "Preparar un catálogo completo o un registro parcial verificado de Manain", requiresProvider: true },
  validar: { entry: "cli/index.js", prefix: ["validate"], usage: "validar -- gam [--etapa catalogo --origen <catalog.json>]", description: "Validar catálogo o preparación", requiresProvider: true },
  exportar: { entry: "cli/index.js", prefix: ["export"], usage: "exportar -- gam --companyID <id> --preparacion <archivo> --inventario <csv> --salida <xlsx> --simular", description: "Revisar o generar una exportación", requiresProvider: true },
  cobertura: { entry: "cli/commands/catalog/audits/review-coverage.js", usage: "cobertura -- --anterior <catalog.json> --actual <catalog.json> --simular", description: "Auditar ausencias y cambios de catálogo" },
  seleccionar: { entry: "cli/commands/catalog/publications/select-publishable.js", usage: "seleccionar -- --gam <preparation.json> --gomariz <preparation.json> --mercaeleva <preparation.json> --manain <preparation.json> --lote <run.json> --borrador <acreditacion.json> (o --acreditacion <acreditacion.json> --simular)", description: "Seleccionar fichas publicables" },
  "seleccionar:proveedor": { entry: "cli/commands/catalog/individual/select-provider.js", usage: "seleccionar:proveedor -- gam --origen <catalog.json> --preparacion <preparation.json>", description: "Consultar selección individual acreditable sin escrituras", requiresProvider: true },
  "acreditar:proveedor": { entry: "cli/commands/catalog/individual/accredit-provider.js", usage: "acreditar:proveedor -- gam --origen <catalog.json> --preparacion <preparation.json> [--detalle] [--listar | --consultar <ref> | --validar | --decidir <ref> excluir --motivo <texto> --evidencia <url> | --aprobar --motivo <texto>]", description: "Gestionar decisiones y aprobación editorial de un proveedor, sin publicar", requiresProvider: true },
  "publicacion:tecnica": { entry: "cli/commands/catalog/publications/technical-publication.js", usage: "publicacion:tecnica -- gomariz --preparacion <preparation.json> [--activar] | manain --csv <partial-all.csv> --censo <censo.json> [--activar] | <proveedor> --ver|--listar|--comparar <sha256>", description: "Crear, simular y consultar cortes técnicos versionados de fichas ready y review sin modificar publicaciones comerciales" },
  "publicacion:vigente": { entry: "cli/commands/catalog/publications/active-publication.js", usage: "publicacion:vigente -- gam --sha <SHA256> [--activar] [--json]", description: "Simular diferencias o activar expresamente un final individual ya acreditado", requiresProvider: true },
  "entregar:proveedor": { entry: "cli/commands/catalog/individual/deliver-provider.js", usage: "entregar:proveedor -- gam --origen <catalog.json> --preparacion <preparation.json> [--simular | --verificar | --solo-json]", description: "Entregar JSON individual acreditado; ZIP opcional en el Escritorio", requiresProvider: true },
  "migrar:catalogos": { entry: "cli/commands/maintenance/catalogs-migrate.js", usage: "migrar:catalogos [-- --aplicar]", description: "Simular o migrar originales y entregas acreditadas a catalogs/ sin borrar datos", defaultSimulation: true },
  "limpiar:almacen": { entry: "cli/commands/maintenance/storage-clean.js", usage: "limpiar:almacen [-- --aplicar]", description: "Simular limpieza; ejecutar solo con --aplicar", defaultSimulation: true },
  "normalizar:gam": { entry: "tools/gam/normalize-csv.js", usage: "normalizar:gam -- <entrada.csv> <salida.csv> [--informe <json>]", description: "Normalizar un CSV GAM" },
  "normalizar:gam:base": { entry: "tools/gam/normalize-csv.js", fixed: ["storage/scraped/gam/scrape-gam-all.csv", "storage/normalized/gam/scrape-gam-all.normalized.csv", "--report", "storage/normalized/gam/normalize.report.json"], usage: "normalizar:gam:base", description: "Normalizar las rutas GAM predeterminadas" },
  "convertir:gam": { entry: "tools/gam/seed/convert-csv.js", usage: "convertir:gam -- <entrada.csv> <salida.ts> <categorias.json>", description: "Convertir CSV GAM a semilla" },
  "convertir:gam:original": { entry: "tools/gam/seed/convert-csv.js", fixed: ["storage/scraped/gam/scrape-gam-all.csv", "storage/seeds/seedDataProduct.gam.ts", "data/category/categorySell-flat.json"], usage: "convertir:gam:original", description: "Convertir el CSV GAM original" },
  "convertir:gam:base": { entry: "tools/gam/seed/convert-csv.js", fixed: ["storage/normalized/gam/scrape-gam-all.normalized.csv", "storage/seeds/seedDataProduct.gam.ts", "data/category/categorySell-flat.json"], usage: "convertir:gam:base", description: "Convertir el CSV GAM normalizado" },
  "categorias:arbol": { entry: "tools/gam/seed/convert-csv-by-category.js", usage: "categorias:arbol -- <opciones>", description: "Generar semillas por categoría GAM" },
  "urls:gam": { entry: "tools/gam/seed/convert-csv-by-url.js", usage: "urls:gam -- <opciones>", description: "Generar semillas por URL GAM" },
  consola: { entry: "cli/index.js", usage: "consola -- <subcomando> [opciones]", description: "Acceso avanzado a la CLI existente" }
};

const options = {
  "--simular": "--dry-run",
  "--categoria": "--category",
  "--paginas": "--pages",
  "--proveedores": "--providers",
  "--origen": "--source",
  "--salida": "--out",
  "--entorno": "--environment",
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

const helpGroups = {
  "OPERATIVA HABITUAL": ["preparar", "publicar:simular", "publicar", "comercial:simular", "comercial", "estado"],
  "AUDITORÍA Y CALIDAD": ["auditar:huecos", "auditar:normalizacion", "auditar:bateria", "comercial:auditar", "comercial:contrato", "diagnosticar:finish", "cobertura", "editorial:auditar-reutilizacion", "editorial:verificar-conocimiento", "editorial:auditar-cobertura"],
  "ENTREGAS": ["entregar:publicos", "entregar:informes", "entregar:proveedor", "entregar"],
  "EXTRACCIÓN Y CAMPAÑA GLOBAL": ["iniciar", "extraer", "extraer:todos", "extraer:proveedor", "manain:muestra", "manain:censo", "revisar", "comparar", "referencia", "acreditar", "recuperar"],
  "OPERACIONES INDIVIDUALES Y AVANZADAS": ["preparar:manual", "catalogo:acreditar", "acreditar:proveedor", "seleccionar", "seleccionar:proveedor", "publicacion:vigente", "publicacion:tecnica", "validar", "exportar", "intervenir", "intervenir:manual", "intervenir:preparar", "intervenir:validar", "consola"],
  "MANTENIMIENTO Y HERRAMIENTAS GAM": ["limpiar:almacen", "limpiar:versionados", "migrar:catalogos", "editorial:actualizar-conocimiento", "normalizar:gam", "normalizar:gam:base", "convertir:gam", "convertir:gam:original", "convertir:gam:base", "categorias:arbol", "urls:gam"],
  "DESARROLLO Y AYUDA": ["test", "build", "clean", "test:guard", "medir:ejecucion", "ayuda"],
};

const additionalHelp = {
  "limpiar:versionados": { usage: "limpiar:versionados [-- --aplicar]", description: "Simular retirada de históricos rastreados por Git; aplicar solo expresamente" },
  "medir:ejecucion": { usage: "medir:ejecucion [-- -Concurrency 6]", description: "Medir el runner en Windows (PowerShell)" },
  "build": { usage: "build", description: "Compilar TypeScript" },
  "test": { usage: "test", description: "Ejecutar guards, compilación necesaria y batería completa" },
  "clean": { usage: "clean", description: "Eliminar dist, incluida la caché local de tests" },
  "test:guard": { usage: "test:guard", description: "Comprobar las cuotas de rendimiento de tests" },
  "editorial:actualizar-conocimiento": { usage: "editorial:actualizar-conocimiento", description: "Regenerar conocimiento editorial y consenso de modelos" },
  "editorial:auditar-reutilizacion": { usage: "editorial:auditar-reutilizacion", description: "Auditar reutilización del conocimiento editorial" },
  "editorial:verificar-conocimiento": { usage: "editorial:verificar-conocimiento", description: "Verificar conocimiento, consenso y arquitectura reutilizable" },
  "editorial:auditar-cobertura": { usage: "editorial:auditar-cobertura", description: "Auditar cobertura editorial" },
  "auditar:bateria": { usage: "auditar:bateria", description: "Ejecutar la batería de auditores de desarrollo" },
  "diagnosticar:finish": { usage: "diagnosticar:finish [-- --proveedor gam|gomariz|mercaeleva|manain]", description: "Diagnosticar preflight de FINISH sin activar publicaciones" },
  "ayuda": { usage: "ayuda [-- <comando>|opciones]", description: "Consultar esta ayuda o las opciones de un comando" },
};

const printHelp = (requested) => {
  if (!requested) {
    console.log("◆ EQUIPZILLA / AYUDA\n");
    console.log("Uso: npm run <comando> (argumentos avanzados: -- [opciones])");
    for (const [group, commands] of Object.entries(helpGroups)) {
      console.log(`\n${group}\n`);
      for (const command of commands) {
        const definition = definitions[command] ?? additionalHelp[command];
        console.log(`  ${command.padEnd(34)} ${definition.description}`);
      }
    }
    console.log("\nFLUJO HABITUAL (cuatro proveedores, comercial en develop)\n");
    for (const command of helpGroups["OPERATIVA HABITUAL"]) console.log(`  npm run ${command}`);
    console.log("\nLECTURA | publicar:simular, comercial:simular y estado no activan ni entregan publicaciones.");
    console.log("PREPARACIÓN/ESCRITURA | iniciar crea carpetas; revisar puede preparar; acreditar registra decisiones.");
    console.log("AUTORIZACIÓN | acreditar --aprobar y recuperar --abandonar requieren decisión explícita.");
    console.log("  La campaña global (extraer, revisar, acreditar, entregar) es independiente de FINISH.");
    console.log("  npm run ayuda -- preparar      Ayuda de un comando");
    console.log("  npm run ayuda -- opciones       Opciones de terminal");
    console.log("  npm ci instala dependencias sin extraer ni preparar catálogos.");
    return true;
  }
  if (requested === "opciones") {
    console.log("OPCIONES DISPONIBLES\n");
    for (const [alias, original] of Object.entries(options)) console.log(`  ${alias.padEnd(26)} ${original}`);
    console.log("  --actualizar                Legado de referencia; la comparación ya utiliza campañas retenidas");
    console.log("  --aplicar                   Ejecuta únicamente limpieza de almacenamiento individual");
    return true;
  }
  const definition = Object.hasOwn(definitions, requested) ? definitions[requested] : Object.hasOwn(additionalHelp, requested) ? additionalHelp[requested] : null;
  if (!definition) return false;
  console.log(`${definition.description}\n\nUso: ${requested === "test" ? "npm test" : `npm run ${definition.usage}`}`);
  if (definition.defaultSimulation) console.log("No elimina nada sin --aplicar.");
  console.log("Opciones: npm run ayuda -- opciones");
  return true;
};

const fail = (message, command) => {
  console.error(formatScriptStatus("FAIL", message, process.stderr));
  if (command) console.error(`Consulta: npm run ayuda -- ${command}`);
  process.exitCode = 1;
};

const rawCommand = process.argv[2] ?? "ayuda";
const args = process.argv.slice(3);
const command = rawCommand;
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
  const normalized = args.map((argument) => command === "auditar:huecos" && (argument === "--catalogo" || argument === "--comparar")
    ? argument
    : options[argument] ?? argument);
  for (let index = 0; index < normalized.length - 1; index += 1) {
    if (normalized[index] === "--stage") {
      if (normalized[index + 1] === "catalogo") normalized[index + 1] = "catalog";
      if (normalized[index + 1] === "preparacion") normalized[index + 1] = "preparation";
    }
  }
  if (selected.requiresProvider && (normalized.length === 0 || normalized[0]?.startsWith("-"))) {
    fail("Falta el proveedor (gam, gomariz, mercaeleva o manain)", command);
  } else if ((command === "limpiar:almacen" || command === "migrar:catalogos") && normalized.includes("--aplicar") && normalized.includes("--dry-run")) {
    fail("No combines --aplicar y --simular", command);
  } else if (normalized.includes("--aplicar") && !(["limpiar:almacen", "migrar:catalogos", "intervenir", "intervenir:manual"].includes(command))) {
    fail("--aplicar solo corresponde a limpiar:almacen, intervenir o intervenir:manual", command);
  } else {
    const cleaned = command === "intervenir" || command === "intervenir:manual" || command === "recuperar" || command === "migrar:catalogos" ? normalized : normalized.filter((argument) => argument !== "--aplicar");
    if (selected.defaultSimulation && !normalized.includes("--aplicar") && !cleaned.includes("--dry-run")) cleaned.push("--dry-run");
    if (selected.defaultEnvironment && !cleaned.includes("--environment")) cleaned.push("--environment", selected.defaultEnvironment);
    const requireContractGuard = command === "comercial:contrato" || command === "comercial" || command === "comercial:simular";
    const guard = requireContractGuard ? spawnSync(process.execPath, [join(root, definitions["comercial:contrato"].entry)], {
      cwd: root, stdio: "inherit", windowsHide: true
    }) : null;
    if (guard && (guard.error || guard.status !== 0)) {
      fail(guard.error?.message ?? "El contrato comercial no coincide con la versión protegida", command);
    } else if (command === "comercial:contrato") {
      if (cleaned.length > 0) fail("Este comando no acepta opciones adicionales", command);
      else process.exitCode = 0;
    } else {
      const cached = isCurrentBuild(root);
      const compile = cached ? null : spawnSync(process.execPath, [join(root, "scripts/build/run-build.mjs"), "--quiet", "--if-needed"], {
        cwd: root, stdio: "inherit", windowsHide: true
      });
      if (compile && (compile.error || compile.status !== 0)) {
        fail(compile.error?.message ?? `No se pudo compilar (código ${compile.status ?? "desconocido"})`);
      } else {
        const result = spawnSync(process.execPath, [join(root, "dist", selected.entry), ...(selected.prefix ?? []), ...(selected.fixed ?? []), ...cleaned], {
          cwd: root, stdio: "inherit", windowsHide: true
        });
        if (result.error) fail(result.error.message);
        else if (result.signal) fail(`La operación terminó por señal ${result.signal}`);
        else {
          process.exitCode = result.status ?? 1;
          const activateIndividual = command === "publicacion:vigente" && cleaned.includes("--activar") && cleaned[0] !== "--campana";
          const deliverIndividual = command === "entregar:proveedor" &&
            !cleaned.some((arg) => ["--dry-run", "--verificar", "--solo-candidata"].includes(arg));
          if (process.exitCode === 0 && (activateIndividual || deliverIndividual)) {
            const retention = spawnSync(process.execPath, [join(root, "scripts/maintenance/consolidate-local-artifacts.mjs"), "--aplicar"], {
              cwd: root, stdio: "inherit", windowsHide: true
            });
            if (retention.error || retention.status !== 0) {
              console.error(formatScriptStatus("WARN", `Publicación individual activada, pero la retención local quedó PENDIENTE: ${retention.error?.message ?? `código ${retention.status}`}. Revisar antes de continuar`, process.stderr));
              process.exitCode = 1;
            }
          }
        }
      }
    }
  }
}
