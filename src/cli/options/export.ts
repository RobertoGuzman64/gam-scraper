import { resolve } from "node:path";
import { getProvider } from "../../scraping/registry.js";

export const exportHelp = `Uso: npm run exportar -- gam --companyID <ID real> --preparation <proveedor-preparation.json> [--source <catalogo-catalog.json>] --existing <inventario.csv> --out <salida.xlsx|salida.json> [--format xlsx|json] [--dry-run | --confirm-inventory] [--allow-empty-inventory] [--verbose]

Para preparación offline, --source identifica el catálogo canónico si no está en la ruta predeterminada.
Sin --source, la preparación offline busca el canónico en la ruta predeterminada; también se admiten publicaciones heredadas completas.
El inventario CSV debe contener companyID,reference y pertenecer a la misma compañía.
--dry-run no crea archivos; --confirm-inventory habilita la generación del archivo seleccionado.
xlsx (predeterminado): POST /product/import; requiere precio y exporta solo altas.
json: cuerpo {"products":[...]} para POST /product/create/many; admite precio ausente si lo demás es válido.
Ninguna opción envía datos al backend; create/many tampoco comprueba duplicados en la base de datos.
El CSV debe ser un inventario completo y actualizado de la empresa en la base de datos de destino.`;

export type ExportOptions = {
  readonly providerId: string;
  readonly companyID: number;
  readonly preparation: string;
  readonly source: string | undefined;
  readonly inventory: string;
  readonly out: string;
  readonly format: "xlsx" | "json";
  readonly dryRun: boolean;
  readonly confirmInventory: boolean;
  readonly allowEmptyInventory: boolean;
};

export const parseExportOptions = (args: readonly string[]): ExportOptions | "help" => {
  if (args.length === 1 && args[0] === "--help") return "help";
  const values = new Map<string, string>();
  const flags = new Set<string>();
  const valueFlags = new Set(["--provider", "--companyID", "--preparation", "--source", "--existing", "--out", "--format"]);
  const booleanFlags = new Set(["--dry-run", "--confirm-inventory", "--allow-empty-inventory", "--verbose"]);
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (index === 0 && arg && !arg.startsWith("--")) {
      flags.add("--provider");
      values.set("--provider", arg);
      continue;
    }
    if (!arg || flags.has(arg) || (!valueFlags.has(arg) && !booleanFlags.has(arg))) {
      throw new Error(`Argumento desconocido o repetido: ${arg ?? ""}`);
    }
    flags.add(arg);
    if (booleanFlags.has(arg)) continue;
    const next = args[index + 1];
    if (!next || next.startsWith("--")) throw new Error(`Falta valor para ${arg}`);
    values.set(arg, next);
    index += 1;
  }
  for (const flag of valueFlags) if (flag !== "--source" && flag !== "--format" && !values.has(flag)) throw new Error(`Falta ${flag}`);
  const providerId = values.get("--provider") ?? "";
  getProvider(providerId);
  const id = values.get("--companyID") ?? "";
  if (!/^[1-9]\d*$/.test(id) || !Number.isSafeInteger(Number(id))) throw new Error("companyID debe ser un ID positivo real");
  const out = resolve(values.get("--out") ?? "");
  const format = values.get("--format") ?? "xlsx";
  if (format !== "xlsx" && format !== "json") throw new Error("--format debe ser xlsx o json");
  if (!out.toLowerCase().endsWith(`.${format}`)) throw new Error(`--out debe terminar en .${format}`);
  const dryRun = flags.has("--dry-run");
  const confirmInventory = flags.has("--confirm-inventory");
  if (dryRun && confirmInventory) throw new Error("--dry-run y --confirm-inventory son incompatibles");
  if (!dryRun && !confirmInventory) throw new Error("Para generar el archivo debe confirmar el inventario con --confirm-inventory");
  return {
    providerId, companyID: Number(id), format, preparation: resolve(values.get("--preparation") ?? ""),
    inventory: resolve(values.get("--existing") ?? ""), out, dryRun, confirmInventory,
    source: values.has("--source") ? resolve(values.get("--source") ?? "") : undefined,
    allowEmptyInventory: flags.has("--allow-empty-inventory")
  };
};

