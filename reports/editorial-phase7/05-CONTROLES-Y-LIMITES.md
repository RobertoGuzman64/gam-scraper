# Verificaciones de la Fase 7

| Comprobación | Resultado |
| --- | --- |
| Guard de integridad de imports productivos | PASS, 743 módulos TS productivos; 0 imports locales ausentes |
| Guard del motor compartido | PASS, 0 narradores por proveedor en preparación; 210 módulos alcanzables |
| Guard de autoridad editorial comercial | PASS, 0 reescrituras posteriores a preparación |
| Guard de contrato comercial v2 | PASS |
| Guard de rendimiento | PASS, 4 suites, 1.299 módulos, 23 cuotas de ejecución y 11 de infraestructura |
| Índice declarativo de conocimiento --check | PASS, 25 fuentes, 433 textos, 18 títulos, 391 unidades |
| Pruebas focales F4/F5/F6/F7 desde TS transpilado | 17 PASS, 0 FAIL |
| Batería editorial compartida desde TS transpilado | 38 PASS, 14 FAIL de 52; 14 regresiones históricas preexistentes |
| Barrido de originales F6 ↔ F7 | 1.751 procesados, 0 excepciones, mismos estados; 9 cambios de corta |
| Catálogos vs F6 | 37/37 ficheros idénticos byte a byte |
| Recuperación `src/catalog/coverage/` desde F5 | 10 archivos, comprobación de SHA-256 e igualdad de bytes |
| Inventario F1 | 82 capacidades, 140 módulos, 1.509 símbolos |
| Typecheck global | NO ACREDITADO, 114 errores; mismos errores y ubicaciones que F6 tras recuperar los 10 ficheros |
| `npm test` completo | NO ACREDITADO; faltan `cheerio`/`p-limit` en este entorno |

La prueba del código editorial se realizó transpilando TypeScript sin comprobación de tipos porque la instalación del proyecto no estaba disponible. Por tanto, la ejecución de la batería y de los guards no equivale a una compilación íntegra. Los 114 errores del chequeo estático coinciden exactamente con los detectados sobre el mismo ZIP F6 usando el mismo entorno; no hay errores específicos de los archivos modificados en F7.

Para la comprobación integral con dependencias instaladas: `npm ci`, `npm run build`, `npm test`, `npm run auditar:comercial -- --acreditacion`, `npm run exportar:comercial -- --simular`.
