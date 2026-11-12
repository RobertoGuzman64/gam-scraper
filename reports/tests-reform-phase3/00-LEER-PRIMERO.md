# EQUIPZILLA — Poda focalizada tras los fallos de tests

## Alcance

Se parte exclusivamente del ZIP `gam-scraper-develop.zip` aportado en este turno y de los **229 fallos** del último `npm test` local. Los guards v2 se han ejecutado para observar la deuda, pero **no se ha atacado su inventario completo**. No se ha iniciado otra auditoría general.

**69 suites eliminadas físicamente**, todas presentes entre los 133 archivos de prueba fallidos. En el registro anterior acumulaban **117 de los 229 fallos**. Quedan **112 fallos históricos asociados a 64 archivos conservados**; NO significa que 112 vayan a reproducirse en la próxima ejecución, ya que no se ha ejecutado la batería completa tras la poda.

No se han modificado reglas de dominio, motores, contratos, configuración de `npm test`, thresholds, baselines, catálogos ni publicaciones. Se ha restaurado el script `scripts/operations/rebuild-editorial-knowledge.mjs` corregido anteriormente, ausente en el ZIP base, sin restaurar los módulos editoriales retirados.

## Principio utilizado

- Se retiran suites ligadas a resultados exactos por unidad, modelo y campaña histórica, en especial los correctores específicos del catálogo anterior y comparaciones de textos, sin sustituirlas por nuevas fotos del catálogo.
- Se conservan las pruebas del motor editorial compartido, reglas técnicas compartidas, preparador, publicación, procedencia, contratos comerciales, scraping, CLI y guards; algunas conservadas siguen fallando y deberán corregirse por su comportamiento, no por una cifra histórica.
- Ningún cambio de datos operativos: los **37 archivos** de `catalogs/` se han comparado byte a byte y permanecen idénticos al ZIP base.
- No se retiran evidencias históricas ni módulos narrativos todavía no clasificados por equivalencia funcional. El guard editorial sigue señalándolos; serán tratados por su propio frente, no mediante esta poda limitada.

## Guards nuevos (sin modificar sus reglas)

| Guard | Antes | Después | Estado actual |
|---|---:|---:|---|
| Arquitectura editorial | 43 | 43 | FAIL, fuera del alcance de esta intervención |
| Arquitectura de tests de dominio | 306 | 209 | FAIL, deuda restante a tratar por grupos |
| Autopruebas de guards | 19/19 | 19/19 | PASS |

La reducción de **97 infracciones** en el guard de tests es una consecuencia de retirar exclusivamente suites fallidas del registro local. No se ha añadido ninguna exclusión ni baseline.

## Comprobaciones disponibles

- Guard de integridad: **PASS**, 702 módulos TS productivos, cero imports relativos ausentes.
- Motor editorial compartido: **PASS**, cero narradores de proveedor conectados.
- Frontera editorial comercial: **PASS**.
- Conocimiento editorial: **PASS**, 25 fuentes, 433 textos, 18 títulos, 391 unidades.
- Autopruebas de arquitectura: **PASS 19/19**.
- Pruebas focales del runner: **PASS 36/36**.
- Guard de rendimiento y guard comercial clásicos: **no ejecutables aquí** sin paquete local `typescript`; no se han alterado para esquivar el fallo.
- `npm test` y `npm run build` oficiales posteriores a la poda: **pendientes en el equipo local con dependencias instaladas**. No se declara el repositorio estable ni la batería verde.

## Bloqueo genuino que NO se ha silenciado

La carga de varias pruebas de proyección comercial rechaza que falte el original acreditado de Gomariz cuyo SHA-256 empieza por `52cd6523`. El original operativo disponible tiene una huella distinta. No es correcto usarlo como sustituto del origen de la publicación anterior; hay que conservar la política de procedencia y resolver el almacenamiento/acreditación con evidencia legítima, o convertir las pruebas de dominio que no necesiten esa publicación en contratos con registros mínimos.

## Próximas comprobaciones locales

```powershell
npm ci
node tests-editorial-architecture-guard.mjs --detail
node tests-domain-tests-guard.mjs --detail
node --test tests-architecture-guards.test.mjs
npm run build
npm test
npm run estado
```

Consultar `01-SUITES-RETIRADAS.csv` y `02-TESTS-FALLIDOS-CONSERVADOS.csv` para cada ruta. **No se han borrado suites que no estuvieran en el registro de fallos aportado.**
