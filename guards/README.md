# EQUIPZILLA — Guards de arquitectura vigentes

## AI GUARD

Ninguna IA puede crear, modificar, mover ni eliminar esta guía sin autorización explícita del propietario para el cambio documental concreto. La protección transversal de scripts, Markdown y comandos está definida en [Gobernanza del repositorio](../docs/REPOSITORY_GOVERNANCE.md).

## Estado y alcance

Esta guía describe los **controles actuales**, no un histórico de suites. La ejecución global comunicada por el propietario el 24-11-2026 (anterior al blindaje adicional de `panel`) terminó con 372 suites, 1.941 pruebas correctas, build correcto y cero infracciones; posteriormente se añadieron dos autopruebas arquitectónicas, comprobadas por separado. Ejecutar la batería completa sobre cualquier versión nueva sigue siendo obligatorio para acreditar ese resultado.

`guards/architecture/tests-domain-tests-guard.mjs` admite actualmente **dos dependencias transitivas exactas de tests hacia una fixture de Manain** y `accreditedCatalogIntegrations` admite **dos lecturas directas en una suite**. No existen excepciones activas de recuentos por cohorte. Son contratos verificables, no un baseline de errores ni permisos generales para acoplar nuevos tests a catálogos. La referencia exacta está en los mapas y las comprobaciones del guard, no en contadores históricos.

El inventario de gobernanza `guards/governance/repository-governance.json` protege **17 rutas Markdown, 57 rutas de scripts y 58 comandos npm**. Bloquea rutas no autorizadas, cuotas y cambios de comandos o `bin`, pero no comprueba autorizaciones humanas ni hashes de contenido Markdown. Cualquier edición o baja de un archivo protegido requiere permiso expreso aun cuando el guard no pueda reconocerla.

## Ejecutar los controles

Desde la raíz del repositorio, con las dependencias de `npm ci` instaladas:

```powershell
node guards/governance/tests-repository-governance-guard.mjs
node guards/architecture/tests-module-integrity-guard.mjs
node guards/architecture/tests-editorial-architecture-guard.mjs --detail
node guards/architecture/tests-domain-tests-guard.mjs --detail
node --test --test-reporter=./scripts/testing/test-runner-ui.mjs guards/architecture/tests-architecture-guards.test.mjs
npm test
```

`npm test` integra gobernanza y autopruebas, integridad productiva, motor y autoridad editoriales, arquitectura de tests, conocimiento, rendimiento, contrato comercial v2, build, consenso y batería funcional. Las ejecuciones individuales son diagnósticos y no sustituyen la batería. `guards/architecture/guards-architecture-core.mjs` requiere `node_modules/typescript` local, sin respaldo implícito en TypeScript global.

## Fronteras productivas

`tests-module-integrity-guard.mjs` inspecciona imports relativos productivos, reexports e imports dinámicos de módulo literal. Impide que producción dependa de `src/cli/`, `src/tools/`, `src/testing/` o suites de test; rechaza cruces indebidos entre proveedores de preparación y scraping y las rutas retiradas `src/pipeline/` y `src/catalog/preparation/`. Protege también la separación entre extracción, recuperación técnica y proyección comercial.

**Panel y herramientas:** `src/panel/` es el propietario de la lectura del explorador, los consumidores de evidencias y su caché técnica. Los archivos de `src/tools/catalog/` conservan fachadas de compatibilidad que delegan hacia `panel/`. La dirección permitida es `tools/` → `panel/`, nunca `panel/` → `tools/`. La inclusión de `panel` entre las capas vigiladas impide esa dependencia inversa; las autopruebas negativas cubren imports, reexports e imports dinámicos.

**Presentación CLI:** `src/cli/reporting/` no puede importar de `src/cli/commands/`. Los comandos sí pueden utilizar reporting. La autoprueba verifica ambos sentidos, sin introducir otro sistema de UI ni mover reglas de negocio a reporting.

**Acreditación editorial:** `isCampaignAccreditation` pertenece a `src/catalog/editorial/campaign-accreditation.ts`. `campaign/editorial.ts` y `publication/individual-editorial.ts` reutilizan ese validador compartido. Las autopruebas de arquitectura rechazan que deje de utilizarse en cualquiera de los dos consumidores; las pruebas funcionales acreditan el contrato, no un guard adicional para duplicidades arbitrarias.

## Protección de los tests

`tests-domain-tests-guard.mjs` controla la topología `tests/` local, las integraciones en `src/testing/integration/{catalog,commercial,preparation}/`, builders y fixtures compartidos, los seis helpers existentes bajo `src/preparation/testing/`, y el descubrimiento de suites `*.test.ts`. Impide nuevas infraestructuras de runner bajo `src/testing/`, importar suites como helpers, recuperar datasets históricos retirados y fijar censos o hashes editoriales literales. El hash de manifest de origen verifica procedencia; no se confunde con un hash congelado de redacción.

Las **dos dependencias transitivas** autorizadas son las de `src/publication/tests/manain-individual-selection.test.ts` y `src/publication/tests/manain-individual-finish.test.ts` hacia `src/testing/builders/manain-individual-selection-fixture.ts`. La fixture acredita una lectura de catálogo por huella exacta. Cambiar su contenido o ampliar consumidores no crea una excepción automática.

La **única suite de lectura directa** autorizada es `src/preparation/tests/catalog-publication-consistency.test.ts`, con dos lecturas y SHA-256 exacto en `accreditedCatalogIntegrations`. Comprueba integridad de catálogo y publicaciones; no autoriza nuevos tests atados a censos mutables. No relajar las excepciones ni retirar una prueba censal sin cobertura equivalente.

Las pruebas nuevas deben proteger reglas, identidad, procedencia, precedencias, variantes y contratos reutilizables, con positivos y negativos, no una suite por máquina ni cantidades fijas de catálogos. El guard de rendimiento controla patrones y cuotas de **tests**; no demuestra mejoras de velocidad en procesos productivos.

## Cierre y límites

Un resultado `PASS` de guards acredita únicamente las fronteras detectadas. No garantiza cobertura web, corrección de fichas, integridad de publicaciones futuras, compatibilidad de un entorno Chrome ni éxito de `npm run build` por separado. Ante una nueva infracción, corregir el origen o acreditar un contrato estricto con revisión expresa, nunca aumentar cuotas o aceptar excepciones genéricas. Consultar [Pruebas](../docs/TESTING.md), [Arquitectura](../docs/ARCHITECTURE.md) y [Gobernanza](../docs/REPOSITORY_GOVERNANCE.md).
