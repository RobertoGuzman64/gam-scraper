# Fase 8 — Controles y límites de validación

| Control | Resultado |
| --- | --- |
| Barrido de preparación F7/F8 sobre los tres originales | PASS: 1.751 productos, 0 excepciones |
| Productos `ready` con corta o general vacía | PASS: 0 |
| Pruebas focales F4-F8 desde TS transpilado | PASS: 21/21 |
| Pruebas nuevas F8 | PASS: 4/4 |
| Batería editorial compartida completa | 42 PASS, 14 FAIL de 56; los 14 fallos son los mismos que en F7 |
| Guard de imports locales de producción | PASS: 744 módulos |
| Guard de motor editorial compartido | PASS: 0 narradores históricos conectados |
| Guard de autoridad editorial en exportación comercial | PASS |
| Guard de conocimiento editorial (`--check`) | PASS: 25 fuentes, 433 textos, 18 títulos, 391 unidades |
| Guard de rendimiento | PASS: 4 suites, 1.301 módulos, cuotas intactas |
| Guard de contrato comercial v2 | PASS |
| Igualdad de `catalogs/` respecto a F7 | PASS: 37/37 archivos idénticos byte a byte |
| TypeScript global con la misma configuración de tipos auxiliares y dependencias del entorno en F7/F8 | NO ACREDITADO: 115 diagnósticos idénticos; 0 errores adicionales en F8 |
| `npm test` íntegro / build con dependencias del proyecto instaladas | NO ACREDITADO: no hay instalación npm válida disponible en este entorno |

Los tests editoriales se han ejecutado sobre JavaScript generado mediante transpile TypeScript. Esto no equivale a `npm run build` ni a `npm test` completos. Ejecutar, en un entorno con `npm ci` satisfactorio, `npm run build`, `npm test`, `npm run auditar:comercial -- --acreditacion` y `npm run exportar:comercial -- --simular` antes de publicar.
