# Pruebas y límites de ejecución — Fase 6

## Controles ejecutados

| Comprobación | Resultado |
|---|---|
| Guard de narradores compartidos | PASS; 0 narradores de proveedor conectados, 208 módulos alcanzables |
| Nuevo guard `tests-commercial-editorial-boundary-guard.mjs` | PASS; composición común obligatoria, proyección sin reglas de reescritura y sin correcciones por referencia |
| Guard de rendimiento | PASS; 4 suites, 1296 módulos, 23 cuotas de ejecución, 11 cuotas de infraestructura |
| Guard de contrato comercial v2 | PASS |
| Reconstrucción de conocimiento declarativo `--check` | PASS; 433 textos, 18 títulos, 391 unidades |
| Pruebas focales de proyección y normalización | 55/55 PASS |
| Tres nuevas pruebas de frontera, reutilización y casos negativos | 3/3 PASS |
| Barrido real sobre fuentes originales | 1.751/1.751 sin excepción; 0 reescrituras editoriales después de preparación |
| Comparación de salida final F5 ↔ F6 | 1.750 idénticas y una discrepancia intencional en un adjetivo de capacidad |
| Regresión ampliada de 145 tests ejecutados desde fuente TS transpilada sin comprobación de tipos | 121 PASS, 24 FAIL; sin fallos nuevos frente a las mismas 142 pruebas de F5 (117 PASS, 25 FAIL) |
| Catálogos vs ZIP F5 | 37/37 idénticos, SHA-256 por archivo |

## Regresiones anteriores

La batería ampliada contiene 24 fallos existentes, incluidos los casos de originales históricos no disponibles en el paquete y las regresiones editoriales ya señaladas en la auditoría F5. No se han reducido esas incidencias modificando snapshots de Fases 1–5 ni reactivando narradores de proveedor. Una prueba histórica sobre ERP25VL deja de fallar por la corrección genérica de capacidad.

Ver `evidence/145-pruebas-editoriales.tap.txt` para las aserciones individuales y `reports/editorial-phase5` para el inventario de deuda previo.

## Build global y test completo

Las dependencias de `npm ci --offline` no estaban íntegramente disponibles (`yocto-queue` no cacheado). Para los controles disponibles se usó TypeScript de instalación global y los tipos Node del entorno, **sin incluir dependencias ni symlinks en el ZIP**.

El typecheck `tsc --noEmit` registra **114 errores** concentrados en paquetes no instalados (`cheerio`, `p-limit`) y las inferencias de tipos asociadas. Ninguno está situado en los archivos de preparación/editorial/comercial modificados. El log original está en `evidence/typecheck-entorno-incompleto.log`.

`npm test` ejecutó correctamente todos los guards iniciales, pero el proceso completo agotó el límite del entorno durante `scripts/run-build.mjs --quiet --if-needed`, antes de lanzar la batería completa. Ver `evidence/npm-test-interrumpido.log`. **No se acredita un build ni un npm test completos.**

## Comandos para ejecutar con dependencias disponibles

```bash
npm ci
npm run build
npm test
npm run auditar:comercial -- --acreditacion
npm run exportar:comercial -- --simular
```

Esta fase no altera el contrato v2, las fuentes originales ni las publicaciones. El criterio definitivo de cierre de las 82 capacidades sigue reservado a las próximas fases.
