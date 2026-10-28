# Referencia operativa: consulta, Git y traslado

`data/reference/` contiene una referencia verificable del inventario original completo. Para el contrato actual: `gam.json`, `gomariz.json`, `mercaeleva.json`, `manain.json`, `manifest.json` y `differences.json`. El lector mantiene compatibilidad con referencias históricas completas de **tres proveedores** (`gam`, `gomariz`, `mercaeleva`). Es un estado de trabajo sustituible; **no** incluye la selección editorial ni forma parte del ZIP público. La limpieza de campañas no la elimina.

## Comandos

```text
npm run referencia
npm run referencia -- --actualizar
npm run referencia -- --recuperar
npm run referencia -- --exportar <carpeta-nueva>
npm run referencia -- --importar <carpeta-existente>
npm run referencia -- --importar <carpeta-existente> --sustituir
```

- Sin argumentos: **solo lectura**, incluso sin campaña activa. Comprueba las huellas SHA-256, el manifiesto, el informe y el conjunto de catálogos declarado. Una referencia ausente es normal en una instalación nueva. Una referencia inválida produce error; una recuperable se señala **sin repararla**. Si hay respaldo íntegro y una operación interrumpida, `--recuperar` realiza la reparación explícita y revalida la referencia sin requerir campaña.
- `--actualizar`: única actualización a partir de una campaña acreditada y entregada; requiere que existan sus originales y la entrega verificada. No depende del inventario destructivo de limpieza.
- `--exportar`: crea una carpeta nueva y comprueba los archivos del conjunto de referencia (seis en el contrato actual; cinco en el histórico). Nunca sobrescribe una carpeta existente; la ruta debe estar fuera del repositorio. Usar un destino seguro al que solo accedan operadores autorizados: los JSON pueden contener información del inventario.
- `--importar`: comprueba una copia exportada e instala los archivos verificados del conjunto de referencia con sustitución transaccional. Una referencia presente no se reemplaza salvo con `--sustituir`. No exige una campaña ni edita el contenido de la copia. Si la referencia local está corrupta o hay una transacción pendiente no recuperable, la importación se bloquea para evitar pérdidas: conservar los archivos y diagnosticar antes de intervenir. `--recuperar` solo procede cuando el estado es recuperable y existe una copia comprobable.

Antes de usar la primera versión con nombres ingleses sobre una instalación anterior, ejecutar desde la raíz del repositorio `node scripts/migrate-storage.mjs` y después `npm run referencia`. La migración verifica los SHA256 y renombra `data/referencia/` a `data/reference/` y `diferencias.json` a `differences.json`, sin modificar sus bytes. Rechaza campañas antiguas pendientes, transacciones de referencia y destinos en conflicto. Las copias exportadas por la versión anterior se convierten cuando sea necesario mediante `node scripts/migrate-storage.mjs --transfer "<carpeta-externa>"`; el importador ordinario acepta únicamente el formato nuevo. El script de migración es transitorio y no introduce una ruta alternativa en el funcionamiento normal.

Para cambiar de máquina, exportar desde la instalación original, transportar esa carpeta por el medio aprobado y ejecutar `--importar` en la nueva. No hace falta reconstruir campañas ni copiar archivos dentro de `data/` a mano. **Este comando no envía archivos por red**: el transporte externo sigue siendo responsabilidad del operador.

## Política de Git

La referencia es **operativa, local y no versionada por defecto**. `.gitignore` excluye `data/reference/` y las carpetas/archivos de transacción `.reference-*` bajo `data/`. Los snapshots comerciales heredados `data/category/` y `data/import/` permanecen versionables, pero no condicionan la preparación canónica actual. No se generan históricos paralelos en el repositorio.

`.gitignore` **no desindexa archivos ya rastreados**. Para comprobar el repositorio local ejecutar `git ls-files -- data/reference/`. Si aparecen archivos de referencia, el propietario debe decidir y aplicar una sola retirada del índice con `git rm -r --cached -- data/reference/`, revisar `git status` y registrar ese cambio; `--cached` conserva los archivos de trabajo. No ejecutar retirada automática del índice durante la instalación, consulta ni actualización de la referencia. El archivo ZIP de origen no incluye `.git`, por lo que no acredita el estado real del índice del usuario.

Una instalación nueva sin referencia puede iniciar un lote y compararlo como referencia inicial. Antes de limpiar un lote entregado debe decidirse si actualizarla; la limpieza nunca realiza esa actualización de manera implícita. La exportación y la importación deben revisarse cuando se actualice el procedimiento de copia de seguridad de la organización.
