import { jlgPlatformProfiles } from "./platform-profiles-jlg.js";
import { haulottePlatformProfiles } from "./platform-profiles-haulotte.js";
import { manitouPlatformProfiles } from "./platform-profiles-manitou.js";
import { lgmgPlatformProfiles } from "./platform-profiles-lgmg.js";
import { geniePlatformProfiles } from "./platform-profiles-genie.js";

export const profiles = [
  ...jlgPlatformProfiles,
  ...haulottePlatformProfiles,
  ...manitouPlatformProfiles,
  ...lgmgPlatformProfiles,
  ...geniePlatformProfiles,
  {
    brand: "Skyjack", model: "SJ6832RT", workHeight: "12 m", motor: "Diesel",
    title: "PLATAFORMA TIJERA DIESEL 12 MT",
    source: "https://www.skyjack.com/sites/default/files/literature-library/KC_SJ6832_RT_TEAR_SHEET_WEB.pdf",
    specifications: { "Altura de plataforma": "9,75 m", "Capacidad máxima de plataforma": "454 kg", "Anchura total": "1,76 m", "Extensión de plataforma": "1,52 m" }
  },
  {
    brand: "Hollandlift", model: "HL-220 E12", workHeight: "22 m", motor: "El\u00e9ctrico",
    title: "PLATAFORMA TIJERA ELECTRICA 22 MT",
    source: "https://www.lectura-specs.es/es/modelo/plataformas-elevadoras/plataformas-de-tijera-plataformas-de-tijeras-de-ruedas-holland-lift/hl-220-e12-11704863",
    specifications: { "Anchura total": "1,2 m", "Capacidad máxima de plataforma": "500 kg", "Longitud de plataforma": "3,38 m", "Extensión de plataforma": "1,5 m" }
  },
  {
    brand: "Oil & Steel", model: "SCORPION 1490", workHeight: "15 m", motor: "Diesel",
    title: "CAMION CESTA TELESCOPICO ALUMINIO 15 MT",
    source: "https://www.lectura-specs.com/en/model/aerial-work-platform/telescopic-boom-lifts-truck-mounted-telescopic-boom-lifts-oil-steel/scorpion-1490-11697689",
    specifications: { "Alcance horizontal": "9,2 m", "Anchura de plataforma": "0,7 m" }
  }
] as const;
