import { resolve } from "node:path";
import type { GapGroupBy } from "../../../catalog/diagnostics/content-gaps-types.js";

export type CommandOptions = { readonly json: boolean; readonly specs: boolean; readonly finalPublications: boolean; readonly compareSources: boolean; readonly groupBy: GapGroupBy; readonly minGroup: number;
  readonly minMissing: number; readonly limit: number; readonly catalogs: readonly string[];
  readonly publications: readonly string[] };

const parsePositive = (value: string | undefined, flag: string): number => {
  if (!value || !/^[1-9]\d*$/.test(value) || !Number.isSafeInteger(Number(value))) {
    throw new Error(`${flag} requiere un entero positivo`);
  }
  return Number(value);
};

export const readContentGapOptions = (args: readonly string[]): CommandOptions => {
  let json = false;
  let specs = false;
  let finalPublications = false;
  let compareSources = false;
  let groupBy: GapGroupBy = "categoria";
  let minGroup = 8;
  let minMissing = 3;
  let limit = 20;
  const catalogs: string[] = [];
  const publications: string[] = [];
  for (let index = 0; index < args.length; index++) {
    const arg = args[index];
    if (arg === "--json") json = true;
    else if (arg === "--specs") specs = true;
    else if (arg === "--finales") finalPublications = true;
    else if (arg === "--comparar") compareSources = true;
    else if (arg === "--catalogo") {
      const value = args[++index];
      if (!value?.trim() || value.startsWith("--")) throw new Error("--catalogo requiere la ruta de un -catalog.json");
      catalogs.push(resolve(value));
    } else if (arg === "--publicacion") {
      const value = args[++index];
      if (!value?.trim() || value.startsWith("--")) throw new Error("--publicacion requiere un fichero -publishable.json");
      publications.push(resolve(value));
    } else if (arg === "--agrupar") {
      const value = args[++index];
      if (value !== "categoria" && value !== "marca" && value !== "modelo") {
        throw new Error("--agrupar admite categoria, marca o modelo");
      }
      groupBy = value;
    } else if (arg === "--min-grupo") minGroup = parsePositive(args[++index], arg);
    else if (arg === "--min-ausentes") minMissing = parsePositive(args[++index], arg);
    else if (arg === "--top") limit = parsePositive(args[++index], arg);
    else throw new Error(`Opción desconocida: ${arg ?? ""}`);
  }
  if (catalogs.length > 0 && publications.length > 0) {
    throw new Error("--catalogo y --publicacion son modos alternativos; no mezclarlos");
  }
  if (finalPublications && (catalogs.length > 0 || publications.length > 0)) {
    throw new Error("--finales no se combina con --catalogo ni --publicacion");
  }
  if (compareSources && (finalPublications || catalogs.length > 0 || publications.length > 0)) {
    throw new Error("--comparar no se combina con --finales, --catalogo ni --publicacion");
  }
  if (specs && !compareSources) throw new Error("--specs requiere --comparar; las publicaciones solas no acreditan especificaciones de origen");
  return { json, specs, finalPublications, compareSources, groupBy, minGroup, minMissing, limit, catalogs, publications };
};

