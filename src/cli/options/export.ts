import { resolve } from "node:path";
import { getProvider } from "../../scraping/registry.js";

export const exportHelp = `Uso: npm run export -- gam --companyID <ID real> --preparation <proveedor-preparation.json> --existing <inventario.csv> --out <salida.xlsx> [--dry-run | --confirm-inventory] [--allow-empty-inventory] [--verbose]

El inventario CSV debe contener companyID,reference y pertenecer a la misma compañía.
--dry-run no crea archivos; --confirm-inventory habilita la generación del XLSX.
El importador de Equipzilla SOLO crea productos, por eso se omiten referencias existentes.
El CSV debe ser un inventario completo y actualizado de la empresa en la base de datos de destino.`;

export type ExportOptions = {
  readonly providerId: string;
  readonly companyID: number;
  readonly preparation: string;
  readonly inventory: string;
  readonly out: string;
  readonly dryRun: boolean;
  readonly confirmInventory: boolean;
  readonly allowEmptyInventory: boolean;
};

export const parseExportOptions = (args: readonly string[]): ExportOptions | "help" => {
  if (args.length === 1 && args[0] === "--help") return "help";
  const values = new Map<string, string>();
  const flags = new Set<string>();
  const valueFlags = new Set(["--provider", "--companyID", "--preparation", "--existing", "--out"]);
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
  for (const flag of valueFlags) if (!values.has(flag)) throw new Error(`Falta ${flag}`);
  const providerId = values.get("--provider") ?? "";
  getProvider(providerId);
  const id = values.get("--companyID") ?? "";
  if (!/^[1-9]\d*$/.test(id) || !Number.isSafeInteger(Number(id))) throw new Error("companyID debe ser un ID positivo real");
  const out = resolve(values.get("--out") ?? "");
  if (!out.toLowerCase().endsWith(".xlsx")) throw new Error("--out debe terminar en .xlsx");
  const dryRun = flags.has("--dry-run");
  const confirmInventory = flags.has("--confirm-inventory");
  if (dryRun && confirmInventory) throw new Error("--dry-run y --confirm-inventory son incompatibles");
  if (!dryRun && !confirmInventory) throw new Error("Para generar el archivo debe confirmar el inventario con --confirm-inventory");
  return {
    providerId, companyID: Number(id), preparation: resolve(values.get("--preparation") ?? ""),
    inventory: resolve(values.get("--existing") ?? ""), out, dryRun, confirmInventory,
    allowEmptyInventory: flags.has("--allow-empty-inventory")
  };
};

