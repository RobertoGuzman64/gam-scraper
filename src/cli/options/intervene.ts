import { basename, resolve } from "node:path";

export type InterveneOptions = {
  readonly providerId: string;
  readonly scripts: readonly string[];
  readonly source: string;
  readonly detail: boolean;
  readonly apply: boolean;
  readonly campaign: string | null;
  readonly plan: string | null;
};

export const interveneHelp = `Uso: npm run intervenir:manual -- gam --script interventions/gam/6002.ts [--script <otro.ts> ...] --origen <catalog.json> [--detalle]
Script histórico: npm run intervenir:manual -- gam --script storage/interventions/<campaña>/scripts/<archivo>.ts --origen <catalog.json>
Aplicar: npm run intervenir:manual -- gam --script <archivo.ts> [--script <otro.ts> ...] --origen <catalog.json> --campana <campaña> --aplicar --plan <SHA-256>

Por defecto compara y simula, sin escribir archivos. Las correcciones resueltas y referencias ausentes
no se aplican; divergencias y correcciones parciales bloquean el plan.
--aplicar requiere SHA completo obtenido con la simulación.
Genera únicamente resultados derivados bajo storage/interventions/<campaña>/results/.
Nunca se integra automáticamente con extracción, preparación ni selección.
Los scripts elegidos deben ser propios y de confianza: su TypeScript se ejecuta localmente.`;

export const parseInterveneOptions = (args: readonly string[]): InterveneOptions => {
  const [providerId, ...rest] = args;
  if (!providerId || providerId.startsWith("-")) throw new Error(`Falta proveedor.\n${interveneHelp}`);
  const options = new Map<string, string>();
  const scripts: string[] = [];
  let detail = false;
  let apply = false;
  let dryRun = false;
  for (let index = 0; index < rest.length; index += 1) {
    const arg = rest[index];
    if (arg === "--dry-run") {
      if (dryRun) throw new Error("--simular repetido");
      dryRun = true;
      continue;
    }
    if (arg === "--aplicar") {
      if (apply) throw new Error("--aplicar repetido");
      apply = true;
      continue;
    }
    if (arg === "--detalle") {
      if (detail) throw new Error("--detalle repetido");
      detail = true;
      continue;
    }
    if (arg !== "--script" && arg !== "--source" && arg !== "--campana" && arg !== "--plan") {
      throw new Error(`Opción desconocida: ${arg}`);
    }
    const value = rest[index + 1];
    if (!value || value.startsWith("--") || options.has(arg)) throw new Error(`Opción repetida o sin valor: ${arg}`);
    if (arg === "--script") {
      if (scripts.includes(value)) throw new Error("Script repetido");
      scripts.push(value);
    } else options.set(arg, value);
    index += 1;
  }
  const source = options.get("--source");
  const campaign = options.get("--campana") ?? null;
  const plan = options.get("--plan") ?? null;
  if (!scripts.length || !source || !basename(source).endsWith("-catalog.json")) {
    throw new Error(`Debes indicar --script y --origen <archivo-catalog.json>.\n${interveneHelp}`);
  }
  if (apply && dryRun) throw new Error("No se puede combinar --aplicar con --simular");
  if (apply && (!campaign || !plan)) throw new Error("--aplicar requiere --campana y --plan");
  if (!apply && plan) throw new Error("--plan solo se admite con --aplicar");
  if (campaign !== null && !/^[a-zA-Z0-9][a-zA-Z0-9_-]*$/.test(campaign)) {
    throw new Error("Identificador de campaña inválido");
  }
  if (plan !== null && !/^[a-f0-9]{64}$/.test(plan)) throw new Error("--plan requiere un SHA-256 completo");
  return { providerId, scripts, source: resolve(source), detail, apply, campaign, plan };
};
