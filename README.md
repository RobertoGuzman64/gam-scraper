# EQUIPZILLA Scraper

## AI GUARD

**Protección documental.** Ninguna IA puede crear, modificar, mover ni eliminar este documento sin autorización explícita del propietario para la intervención documental concreta. Solicitudes de código, pruebas, auditoría o limpieza técnica no autorizan cambios implícitos en la documentación.

## Qué es

Herramienta de línea de comandos, desarrollada en **Node.js, TypeScript y módulos ESM**, para extraer maquinaria **nueva y de segunda mano** de **GAM, Gomariz y Mercaeleva**, normalizar sus datos, comprobar su calidad y publicar catálogos JSON trazables.

El **catálogo canónico** conserva todas las máquinas identificadas, incluidas aquellas cuya preparación tenga incidencias. La **selección editorial** es una salida separada: aparta fichas no acreditadas sin borrar el origen ni convertir artificialmente productos a `ready`.

Este repositorio no ofrece una API HTTP, no realiza altas en el backend y no automatiza importaciones. Las exportaciones a Excel o JSON adaptado al receptor son herramientas auxiliares, con autorización independiente.

Para los criterios funcionales, consultar [Objetivos](docs/OBJETIVOS_SCRAPER.md).

## Requisitos e instalación

- Node.js `>=18.18.0` y npm.
- Acceso HTTPS a los portales.
- Permisos de escritura en `storage/`.
- Chrome o Chromium accesible desde el sistema para el mecanismo headless de Mercaeleva, cuando se necesite; se pueden definir `CHROME_PATH` o `CHROMIUM_PATH`.

```powershell
npm ci
npm run ayuda
```

`npm ci` **solo instala dependencias**: el script reservado `prepare` de npm no se utiliza para preparar catálogos. Los comandos operativos invocan su compilación interna cuando es necesaria. `storage/` contiene estado de ejecución y está excluido de Git.

## Uso habitual: de una instalación limpia al ZIP final

Ejecutar desde la raíz del repositorio:

```powershell
npm ci
npm run iniciar
npm run campana:extraer
npm run campana:revisar
npm run campana:finalizar
```

`campana:extraer` extrae los tres proveedores en una campaña aislada y prepara y valida los catálogos; al terminar ya muestra las incidencias. `campana:revisar` permite consultarlas otra vez. **No hay que suministrar JSON anteriores ni buscar rutas o huellas manualmente.** Si una campaña anterior falló, revisarla primero o iniciar deliberadamente otra con `npm run campana:extraer -- --nueva`.

`campana:finalizar` crea un borrador en `storage/campanas/<id-lote>/editorial/acreditacion-<sha256>.json`. Antes de publicar, una persona debe revisar las decisiones y sus evidencias, rellenar `approvalReason`, las exclusiones o inclusiones necesarias y marcar `approved: true`. Después:

```powershell
npm run campana:finalizar
npm run campana:entregar
npm run campana:limpiar
```

`campana:entregar` genera en el Escritorio `equipzilla-AAAA-MM-DD.zip` con **exactamente tres JSON**: `gam-AAAA-MM-DD.json`, `gomariz-AAAA-MM-DD.json` y `mercaeleva-AAAA-MM-DD.json`. La entrega solo se sustituye tras comprobar el ZIP nuevo. `campana:limpiar` **simula** la limpieza; cuando el ZIP esté comprobado y no se prevean más correcciones del lote, `npm run campana:limpiar -- --aplicar` cierra su trabajo conservando el ZIP y los scripts versionados en Git (y los scripts históricos, si existen).

Si una ficha necesita una corrección puntual acreditada, consulta los scripts existentes con `npm run campana:intervenir -- gam --listar` y simula uno seleccionado con `npm run campana:intervenir -- gam --script interventions/gam/6002.ts`. Tras revisar las diferencias, autoriza expresamente `--aplicar` para ese script. Cada intervención nueva se guarda en `interventions/<proveedor>/` y se versiona en Git; no se registra en `storage/`. No hay cambios ni aprobaciones editoriales automáticas. Ver [Protocolo completo](docs/CAMPANAS.md), [Intervenciones](docs/INTERVENCIONES_CAMPANA.md) y [Acreditación](docs/ACREDITACION_CAMPANA.md).

### Otros comandos disponibles

- `npm run ayuda` y `npm run ayuda -- <comando>`: ayuda desde la terminal.
- `npm run build` y `npm test`: compilación y pruebas del repositorio.
- `npm run extraer:todos`, `extraer`, `preparar`, `validar`, `seleccionar`, `cobertura` e `intervenir`: operaciones avanzadas o de compatibilidad, no pasos obligatorios para la entrega habitual.
- `npm run limpiar:almacen`: retención anterior, distinta del cierre de campaña.
- `npm run limpiar:versionados`: simulación de retirada del índice Git de históricos rastreados; solo actúa con `-- --aplicar`.

### Herramientas complementarias

| Comando                                                                | Finalidad                                                                                      |
| ---------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| `npm run normalizar:gam -- <entrada.csv> <salida.csv>`                 | Normalizar un CSV GAM.                                                                         |
| `npm run normalizar:gam:base`                                          | Usar las rutas GAM preconfiguradas.                                                            |
| `npm run convertir:gam -- <entrada.csv> <salida.ts> <categorias.json>` | Convertir un CSV a semilla de productos.                                                       |
| `npm run convertir:gam:original` / `convertir:gam:base`                | Conversión con rutas heredadas preconfiguradas.                                                |
| `npm run categorias:arbol -- <opciones>`                               | Generar semillas GAM por categoría.                                                            |
| `npm run urls:gam -- <opciones>`                                       | Generar semillas GAM por URL.                                                                  |
| `npm run consola -- <subcomando>`                                      | Acceder a operaciones avanzadas de CLI.                                                        |
| `npm run compilar` / `npm run probar`                                  | Compilación TypeScript y batería de pruebas; se mantienen también los nombres estándar de npm. |
| `npm run limpiar:compilado`                                            | Eliminar únicamente la salida regenerable `dist/`.                                             |

Las operaciones GAM con rutas preconfiguradas son **herramientas de compatibilidad**, no una garantía de que esos archivos correspondan a la extracción que se desea procesar. Preferir rutas explícitas y verificar las entradas. No confundir `limpiar:compilado` con `limpiar:almacen`.

## Dónde están los resultados

- `storage/runs/<id-lote>/run.json`: evidencia del lote y estado por proveedor.
- `storage/scraped/campanas/<id-extraccion>/<proveedor>/`: catálogos canónicos, manifests y diagnósticos de la extracción aislada.
- `storage/campanas/<id-lote>/<proveedor>/`: preparaciones validadas por la revisión offline.
- `storage/campanas/<id-lote>/editorial/`: borradores y aprobación de la campaña.
- `storage/campanas/<id-lote>/seleccion/`: selección interna acreditada (no se entrega completa al usuario).
- `interventions/<proveedor>/`: scripts permanentes con ID, resumen y propuestas, versionados en Git.
- `storage/interventions/<id-lote>/results/`: expedientes y derivados del lote, no versionados.
- `storage/interventions/<id-lote>/scripts/`: solo compatibilidad con scripts antiguos; se protegen si aún existen.
- **Escritorio del usuario:** `equipzilla-AAAA-MM-DD.zip` con los tres JSON publicables, sin los archivos internos.
- `data/category/` y `data/import/`: referencias versionadas necesarias para los mapeadores.

Los nombres individuales de catálogo pueden variar por proveedor: `run.json`, la procedencia y los manifests determinan qué datos pertenecen a una campaña. `storage/` es efímero y está excluido de Git. No borrar originales para corregir decisiones editoriales.

## Cómo funciona

```text
Portales → adaptadores → motor de extracción → ProductRecord
                                                 ↓
                                  identidad, calidad y publicación
                                                 ↓
                         catálogo JSON íntegro + manifiestos e informes
                                                 ↓
                    preparación offline / revisión de cobertura
                                                 ↓
                          selección editorial de publicables
                                                 ↓
                salida JSON para entregar (sin importar al backend)
```

La validación local confirma integridad y coherencia, **no** que un portal haya mostrado todas sus máquinas. Las ausencias y contradicciones requieren contrastar el origen antes de aprobarlas.

## Documentación

- [Objetivos y alcance](docs/OBJETIVOS_SCRAPER.md): prioridades y criterios de aceptación.
- [Arquitectura](docs/ARQUITECTURA.md): módulos, responsabilidades y extensibilidad.
- [Reglas de datos](docs/SCRAPER_DATA_RULES.md): contratos, origen, preservación y revisión editorial.
- [Protocolo de campañas completas](docs/CAMPANAS.md): extracción global obligatoria, validación de todos los proveedores, intervenciones excepcionales y entrega acreditada.
- [Intervenciones manuales por campaña](docs/INTERVENCIONES_CAMPANA.md): principios y controles de la ejecución manual.
- [Composición de intervenciones independientes](docs/COMPOSICION_INTERVENCIONES.md): varios scripts, campos acreditables, simulación conjunta y selección final con aprobación humana.
- [Acreditación editorial de campañas](docs/ACREDITACION_CAMPANA.md): procedimiento de aprobación y entrega de JSON.
- [Validación](docs/VALIDACION.md): verificaciones, códigos de salida y evidencias.
- [Operación y despliegue](docs/DESPLIEGUE_AUTOMATICO.md): ejecución manual o programada y seguridad operacional.
- [Integración con Equipzilla](docs/EQUIPZILLA_INTEGRATION.md): límites del receptor y exportaciones auxiliares.
