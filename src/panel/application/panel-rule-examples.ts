import { readFile } from "node:fs/promises";
import { join } from "node:path";

export type PanelRuleId = "source" | "normalization" | "exclusion";

export type PanelRuleExample = {
  readonly title: string;
  readonly summary: string;
  readonly path: string;
  readonly code: string;
};

export type PanelRuleExamples = Readonly<Record<PanelRuleId, PanelRuleExample>>;

type RuleSource = Omit<PanelRuleExample, "code"> & {
  readonly first: string;
  readonly last: string;
};

const sources: Readonly<Record<PanelRuleId, RuleSource>> = {
  source: {
    title: "Aplicación y trazabilidad documental",
    summary: "El recuperador comprueba identidad, huella y posibles colisiones antes de añadir especificaciones; cuando dispone de una referencia documental, registra su origen sin verificar aquí su contenido externo.",
    path: "src/preparation/shared/technical/evidence/documented-technical-evidence.ts",
    first: "if (!unit || record.brand !== unit.brand",
    last: "Object.keys(unit.specifications).some((key) => key in specs)) return specs;"
  },
  normalization: {
    title: "Comprobación de valores numéricos",
    summary: "Se interpreta el valor según su tipo y unidad. Un número no interpretable o negativo no se incorpora por esta regla.",
    path: "src/catalog/normalization/normalize-specs.ts",
    first: 'case "number": {',
    last: "    }"
  },
  exclusion: {
    title: "Exclusión editorial acreditada",
    summary: "La decisión debe coincidir con la URL y las incidencias exigidas; de lo contrario, se detiene la selección. El motivo registrado acompaña la exclusión.",
    path: "src/catalog/editorial/select-publishable.ts",
    first: "if (!decision || entry.product.sourceUrl !== decision.sourceUrl ||",
    last: "        });"
  }
};

export const PANEL_RULE_SOURCE_PATHS: readonly string[] = Object.values(sources).map((source) => source.path);

const readExcerpt = async (workspace: string, spec: RuleSource): Promise<PanelRuleExample> => {
  const lines = (await readFile(join(workspace, spec.path), "utf8")).split(/\r?\n/u);
  const start = lines.findIndex((line) => line.includes(spec.first));
  const end = lines.findIndex((line, index) => index >= start && line.includes(spec.last));
  if (start < 0 || end < start || end - start > 18 ||
    lines.filter((line) => line.includes(spec.first)).length !== 1) {
    throw new Error(`No se puede acreditar el ejemplo de código: ${spec.path}`);
  }
  const selected = lines.slice(start, end + 1);
  const indentation = Math.min(...selected.filter((line) => line.trim()).map((line) => line.length - line.trimStart().length));
  return {
    title: spec.title,
    summary: spec.summary,
    path: spec.path,
    code: selected.map((line) => line.slice(indentation)).join("\n")
  };
};

export const readPanelRuleExamples = async (workspace: string): Promise<PanelRuleExamples> => {
  const [source, normalization, exclusion] = await Promise.all([
    readExcerpt(workspace, sources.source),
    readExcerpt(workspace, sources.normalization),
    readExcerpt(workspace, sources.exclusion)
  ]);
  return { source, normalization, exclusion };
};
