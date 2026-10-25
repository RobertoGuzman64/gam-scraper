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

## Comandos principales

Ejecutar desde la raíz del repositorio. El separador `--` permite pasar argumentos a la herramienta.

| Comando                                                                                                                                         | Qué hace                                             |
| ----------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------- |
| `npm run ayuda`                                                                                                                                 | Enumera las herramientas sin compilar.               |
| `npm run ayuda -- opciones`                                                                                                                     | Muestra las opciones españolas y sus equivalentes.   |
| `npm run ayuda -- preparar`                                                                                                                     | Muestra el uso de un comando concreto.               |
| `npm run extraer -- gam`                                                                                                                        | Extrae GAM; admite también `gomariz` y `mercaeleva`. |
| `npm run extraer:todos -- --simular`                                                                                                            | Muestra el plan del lote sin ejecutar extracciones.  |
| `npm run extraer:todos -- --proveedores gam,gomariz`                                                                                            | Ejecuta los proveedores indicados en secuencia.      |
| `npm run preparar -- gam --origen <catalogo-catalog.json> --simular`                                                                            | Prepara sin escribir una nueva salida.               |
| `npm run validar -- gam`                                                                                                                        | Comprueba una publicación del proveedor.             |
| `npm run cobertura -- --anterior <anterior-catalog.json> --actual <actual-catalog.json> --simular`                                              | Analiza ausencias y cambios sin crear informe.       |
| `npm run seleccionar -- --gam <gam-preparation.json> --gomariz <gomariz-preparation.json> --mercaeleva <mercaeleva-preparation.json> --simular` | Simula la selección editorial.                       |
| `npm run limpiar:almacen`                                                                                                                       | **Solo simula** la limpieza.                         |
| `npm run exportar -- --help`                                                                                                                    | Consulta el contrato de exportación opcional.        |

**Precauciones:** `--paginas` limita la extracción y **no** acredita cobertura completa. `limpiar:almacen` solo elimina cuando recibe `--aplicar`; no usar esa opción sin revisar previamente la simulación. La publicación editorial requiere además las evidencias y opciones de cobertura que correspondan a los datos de entrada.

Los comandos ingleses anteriores (`scrape`, `validate`, `prepare:catalog`, `select:publishable`, etc.) continúan disponibles por compatibilidad; se recomiendan los españoles. Para conocer opciones especializadas, usar `npm run ayuda` y la ayuda del comando.

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

- `storage/scraped/<proveedor>/`: catálogo canónico, CSV, preparación de publicación, resúmenes, cambios, errores, snapshots y manifests de integridad.
- `storage/prepared/<proveedor>/`: preparación offline, cuando se utiliza esa operación.
- `storage/runs/`: resultados y logs de lotes.
- `data/category/` y `data/import/`: snapshots versionados del esquema de destino usados por los mappers.

Los **prefijos de archivo** dependen de la configuración y de las opciones de ejecución. No deducir el catálogo vigente por un nombre de fichero: identificarlo por sus manifests y procedencia. No sobrescribir ni borrar catálogos originales para corregir fichas editoriales.

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
- [Validación](docs/VALIDACION.md): verificaciones, códigos de salida y evidencias.
- [Operación y despliegue](docs/DESPLIEGUE_AUTOMATICO.md): ejecución manual o programada y seguridad operacional.
- [Integración con Equipzilla](docs/EQUIPZILLA_INTEGRATION.md): límites del receptor y exportaciones auxiliares.
