# EQUIPZILLA — Guards arquitectónicos v2 (auditoría estricta, sin baseline)

**Base calibrada:** repositorio íntegro `eqz-f7-16e5af.zip` (Fase 7), contrastado con `eqz-t1-740300.zip` (auditoría de tests de Fase 8). Esta entrega **no modifica** el repositorio, los motores, los tests productivos, los JSON ni el tooling. Solo contiene las versiones v2 de los guards y sus pruebas, más este documento.

## Invariante de ejecución

- **0 infracciones → PASS y código de salida 0.**
- **1 o más infracciones → FAIL y código 1, incluidas las antiguas.**
- **Error de ejecución → código 2.**
- No existen baseline, allowlist de deuda, cuotas de infracciones toleradas ni warnings aceptados.
- `--audit` muestra todo el informe y **no** transforma FAIL en PASS; `--strict` mantiene el mismo criterio estricto que el modo por defecto.
- Los guardias son verificadores estáticos de fronteras arquitectónicas, no sustituyen la revisión semántica individual ni acreditan por sí solos la equivalencia de las 82 capacidades editoriales.

## Archivos que se colocan en la raíz

| Archivo                                  | Responsabilidad                                                                                                                                                              |
| ---------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `tests-editorial-architecture-guard.mjs` | Detectar narradores específicos conectados, narradores legados, composición fuera del dueño editorial y bifurcaciones de proveedor/referencia en el dominio compartido       |
| `tests-domain-tests-guard.mjs`           | Detectar pruebas de dominio acopladas a catálogos operativos, fixtures históricas completas, lecturas transitivas y expectativas congeladas de cohortes o hashes editoriales |
| `guards-architecture-core.mjs`           | Análisis AST con TypeScript, grafo de imports, rutas, resultados y estado estricto                                                                                           |
| `tests-architecture-guards.test.mjs`     | Tests positivos y negativos, incluyendo diferencias entre contratos de publicación y pruebas de dominio                                                                      |
| `PLAN-GUARDS-ARQUITECTURA-V2.md`         | Contratos, calibración, límites y operación                                                                                                                                  |

**No se incluye ningún fichero baseline.** El anterior `guards-architecture-baseline-f7.json` ya no es utilizado por el código v2 y debe eliminarse manualmente de la raíz al actualizar los guards. La documentación v1 `PLAN-GUARDS-ARQUITECTURA-F7.md` queda sustituida por la presente versión.

## Comandos (PowerShell, raíz del repo)

```powershell
node tests-editorial-architecture-guard.mjs --detail
node tests-domain-tests-guard.mjs --detail
node --test tests-architecture-guards.test.mjs
```

Se puede usar `--audit` para el detalle completo o `--root <ruta>` para inspeccionar una copia aislada. Ambos guards usan el compilador TypeScript disponible en las dependencias del proyecto o en la instalación global. **No invocan `npm ci`, `npm run build`, `npm test`, `cheerio`, `p-limit` ni comandos de publicación.** Tampoco están conectados a `package.json` ni a tooling.

## Qué protege cada uno

**Editorial:** comprueba el punto de entrada compartido; recorre imports desde preparación y proyección comercial; detecta módulos narrativos de proveedor activos y restos narrativos aislados; prohíbe composición editorial en adaptadores de proveedor; verifica que el dominio no ramifique según `providerId` ni dependa indebidamente de módulos específicos; detecta referencias literales en composición compartida y reescrituras editoriales posteriores a preparación. Respeta los tres adaptadores de origen presentes en F7 y el módulo que despacha hacia ellos. No considera un generador legítimo de palabras clave comerciales una reescritura de descripciones.

**Tests:** analiza también los tests de normalización, clasificación, identidad, medidas, energía y otros dominios técnicos antes fuera de la v1. Detecta la carga directa de catálogos publicados/operativos, las fixtures históricas de catálogo y las importaciones indirectas por builders. Señala recuentos congelados de catálogos dependientes de datos reales y hashes literales de descripciones basadas en esos catálogos. No confunde un recuento de una fixture mínima autocontenida con el censo operativo. No penaliza por defecto los tests de infraestructura/publicación cuya función es acreditar origen, integridad o retención: estos necesitan un análisis separado de su contrato de evidencias.

## Calibración reproducida sobre Fase 7

| Control                          |               Resultado | Interpretación                                                                                        |
| -------------------------------- | ----------------------: | ----------------------------------------------------------------------------------------------------- |
| Guard editorial v2               |  79 hallazgos, salida 1 | 78 narradores legados aislados y una reescritura editorial posterior a preparación                    |
| Guard de tests v2                | 440 hallazgos, salida 1 | 372 lecturas directas/fixtures históricas, 21 transitivas, 37 recuentos fijos y 10 hashes editoriales |
| Suites de dominio inspeccionadas |                     339 | Dominio técnico y editorial del estado F7, no las 523 suites de la auditoría global                   |
| Autopruebas de guards            |         19/19 correctas | Se comprueba tanto detección de infracciones como ausencia de falsos positivos en ejemplos legítimos  |

**Una señal no equivale a un archivo desechable**: un mismo test puede acumular varias infracciones, y una prueba A que conserva su garantía puede necesitar cambiar su forma de obtener los datos.

### Cruce con la auditoría de 523 suites

- 254 suites clasificadas E como *riesgo estático*; 232 de ellas presentan al menos un hallazgo del guard v2.
- Las 22 restantes pertenecen a ámbitos que no deben prohibirse indiscriminadamente, como publicación, campañas, CLI o integración. **No son 22 casos acreditados como correctos:** requieren la clasificación prevista por la auditoría y sus garantías específicas.
- 32 suites clasificadas A (conservar garantía de dominio) también muestran dependencias de catálogo o fixture en el guard. La decisión correcta puede ser **conservar el comportamiento probado y sustituir la entrada histórica**, no retirar automáticamente el test.
- Ninguna suite clasificada B o C en la matriz produce infracciones en esta calibración.
- La auditoría original hablaba de 523 suites; el guard no pretende transformar las 523 en suites de dominio ni convertir toda lectura histórica en delito arquitectónico.

La calibración F7 no sustituye una reejecución sobre el repositorio actual de la futura poda. No se crean exclusiones para conseguir un resultado favorable; las incidencias existentes deben resolverse en sus frentes respectivos, sin modificar motores aquí.

## Limitaciones deliberadas

- El reconocimiento semántico de composiciones equivalentes, datos acreditados por unidad y excepciones legítimas requiere pruebas funcionales y auditoría de conocimiento; no se puede inferir con total precisión mediante un AST.
- La resolución de dependencias contempla imports/exports locales estáticos y llamadas a imports dinámicos con literales. Los loaders con rutas construidas enteramente en ejecución pueden requerir revisión adicional.
- No prohíbe pruebas de publicación basadas en evidencia inmutable: eso equivaldría a debilitar la acreditación. Su ciclo de vida y almacenamiento pertenecen al frente específico de datos/publicaciones.
- `FAIL` en la Fase 7 es **el resultado esperado** de un guard sin baseline; no se corrige suavizando sus reglas ni degradando infracciones a warnings.

## Criterio de promoción al tooling

**No integrarlos todavía.** Tras las reformas, comprobar sobre el repositorio final que los incumplimientos reales están a cero, que las reglas no provocan falsos positivos en extensiones legítimas y que las autopruebas siguen pasando. Solo entonces decidir su ubicación definitiva e integración operativa.
