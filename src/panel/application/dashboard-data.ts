import { PANEL_METRIC_DEFINITIONS } from "../evidence/metric-definitions.js";
import type { PanelMetricDefinition } from "../evidence/metric-definitions.js";
import type { PanelProviderId, PanelSnapshot } from "../evidence/types.js";
import type { PanelExplorerPayload } from "../explorer/types.js";

export type PanelDecisionRow = {
  readonly stage: string;
  readonly input: string;
  readonly control: string;
  readonly output: string;
  readonly decision: string;
  readonly evidence: string;
  readonly authorization: string;
};

export type PanelDashboardPayload = {
  readonly snapshot: PanelSnapshot;
  readonly explorer: PanelExplorerPayload;
  readonly definitions: readonly PanelMetricDefinition[];
  readonly decisions: readonly PanelDecisionRow[];
  readonly names: Readonly<Record<PanelProviderId, string>>;
};

const PANEL_NAMES: Readonly<Record<PanelProviderId, string>> = {
  gam: "GAM",
  gomariz: "Gomariz",
  mercaeleva: "Mercaeleva"
};

const PANEL_DECISIONS: readonly PanelDecisionRow[] = [
  {
    stage: "Original canónico",
    input: "Catálogo extraído del proveedor",
    control: "Identidad e integridad SHA del original acreditado",
    output: "Original con procedencia contrastable",
    decision: "Comprobación de integridad; no es una decisión editorial",
    evidence: "Manifiesto de origen y publicación individual",
    authorization: "No aplica"
  },
  {
    stage: "Preparación técnica",
    input: "Original canónico",
    control: "Motor editorial y validaciones técnicas existentes",
    output: "Fichas preparadas para revisión",
    decision: "Las diferencias agregadas no acreditan una regla concreta por ficha",
    evidence: "Informe técnico del corte; atribución individual no disponible aquí",
    authorization: "No consta en esta vista"
  },
  {
    stage: "Acreditación y FINISH",
    input: "Preparación y revisión individual",
    control: "Decisiones registradas y selección de aprobación vigente",
    output: "Publicación técnica individual",
    decision: "Acreditación editorial; posibles exclusiones",
    evidence: "active.json, manifest.json y accreditation.json",
    authorization: "Circuito de acreditación humana cuando procede"
  },
  {
    stage: "Proyección comercial",
    input: "Publicaciones técnicas acreditadas",
    control: "Contrato comercial v2 y validación de proyección",
    output: "Productos elegibles y exclusiones comerciales",
    decision: "Elegibilidad y correspondencia de categorías y atributos",
    evidence: "Manifest comercial, JSON por proveedor e informe comercial",
    authorization: "No equivale a aprobación de inserción en BD"
  },
  {
    stage: "Integración en backend",
    input: "Paquete comercial local",
    control: "No verificado en este corte",
    output: "No acreditado",
    decision: "No inferir importación ni aceptación en BD",
    evidence: "Informe comercial: NO VERIFICADO EN BD",
    authorization: "No acreditado"
  }
];

export const createDashboardPayload = (snapshot: PanelSnapshot, explorer: PanelExplorerPayload): PanelDashboardPayload => ({
  snapshot, explorer,
  definitions: PANEL_METRIC_DEFINITIONS,
  decisions: PANEL_DECISIONS,
  names: PANEL_NAMES
});
