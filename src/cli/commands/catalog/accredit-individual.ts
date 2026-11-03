import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseIndividualCatalogProviders } from "../../options/individual-catalog.js";
import { formatHeader, printReportLine, printStatus } from "../../reporting/terminal.js";
import { printCommandError } from "../../reporting/errors.js";
import { preflightIndividualAccreditations } from "../../../pipeline/publication/individual-accreditation.js";
import {
  ensureAutomaticIndividualAccreditations, planAutomaticIndividualAccreditation
} from "../../../pipeline/publication/automatic-individual-accreditation.js";
import { readIndividualSelection, selectIndividualPublishable } from "../../../pipeline/publication/individual-selection.js";

export const accreditIndividualHelp = `Uso opcional:
  npm run catalogo:acreditar
  npm run catalogo:acreditar -- --proveedor gam
  npm run catalogo:acreditar -- --simular

La publicación ordinaria acredita automáticamente las exclusiones históricas idénticas.
Este comando ya no es un paso obligatorio ni abre una sesión interactiva.
Solo se reutilizan decisiones vigentes cuando coinciden referencia, fuente, estado e incidencias.
Un caso nuevo o distinto bloquea la acreditación. --simular no escribe.`;

export const runAccreditIndividual = async (args: readonly string[], workspace: string): Promise<boolean> => {
  if (args.length === 1 && args[0] === "--help") {
    printReportLine(accreditIndividualHelp);
    return true;
  }
  if (args.includes("--help")) throw new Error("--help no admite otras opciones");
  const parsed = parseIndividualCatalogProviders(args);
  const root = resolve(workspace);
  printReportLine(formatHeader(`ACREDITACIÓN AUTOMÁTICA${parsed.dryRun ? " · SIMULACIÓN" : ""}`));
  if (parsed.dryRun) {
    const contexts = await preflightIndividualAccreditations(root, parsed.providerIds);
    for (const context of contexts) {
      const plan = planAutomaticIndividualAccreditation(context);
      const selection = await readIndividualSelection(context.providerId, context.options.catalogFile, context.options.preparationFile);
      selectIndividualPublishable(selection, JSON.stringify(plan, null, 2));
      printStatus("PASS", `${context.providerId.toUpperCase()} | ${plan.exclusions.length} exclusiones históricas acreditadas | SIMULACIÓN`);
    }
    printStatus("PASS", "SIMULACIÓN COMPLETA | Sin escrituras, sin publicaciones");
    return true;
  }
  const reviews = await ensureAutomaticIndividualAccreditations(root, parsed.providerIds);
  for (const review of reviews) {
    const provider = review.accreditation.sources[0]?.providerId;
    if (!provider) throw new Error("Acreditación automática sin proveedor");
    printStatus("PASS", `${provider.toUpperCase()} | ${review.inspection.completed} exclusiones acreditadas | APROBADA`);
  }
  printStatus("PASS", "ACREDITACIONES COMPLETAS | Sin publicaciones. El paso es opcional; utiliza catalogo:publicar");
  return true;
};

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  const root = resolve(fileURLToPath(new URL("../../../../", import.meta.url)));
  runAccreditIndividual(process.argv.slice(2), root).then((ok) => {
    if (!ok) process.exitCode = 1;
  }).catch((error: unknown) => {
    printCommandError("catalogo:acreditar", error);
    process.exitCode = 1;
  });
}
