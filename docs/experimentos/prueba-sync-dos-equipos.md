# Prueba de sync con dos equipos (oplog v2)

Objetivo: comprobar con Drive real que la versión nueva (rama `exp/oplog-sin-automerge`)
convive con la actual sin perder datos, y que al actualizar no hay duplicados.

- **Equipo A**: empieza con la versión **actual** (v1.6.1 instalada) y se actualiza en el paso 5.
- **Equipo B**: la versión **nueva** desde el principio.

## Reglas para no tocar nada real

1. **Cuenta de Google de prueba.** La carpeta de Drive es siempre `Ecclesia` en la raíz de
   la cuenta, no se puede cambiar, así que la única forma de aislarla es otra cuenta.
   Si al conectar sale `access_denied`, añade esa cuenta como usuario de prueba en la
   pantalla de consentimiento OAuth de Google Cloud.
2. **Carpeta de datos aislada** en los dos equipos con `--user-data-dir`. En la app
   instalada la base de datos, los medios y la config de sync viven ahí, así que tu
   instalación normal ni se entera. Las dos versiones de A usan **la misma** carpeta.
3. No abras la instalación normal mientras dure la prueba (ambas usan el puerto 7777).

## 0. Preparación

### Compilar la versión nueva

En la rama, con `main` integrado para que lleve lo mismo que v1.6.1:

```bash
git switch exp/oplog-sin-automerge
git merge main
cd apps/desktop
pnpm build:local            # macOS → dist/mac*/Ecclesia.app (sin instalar)
# Windows: pnpm build:win   → instalador en dist/
```

### Carpeta de datos de A con tu historia real (sin credenciales)

Así la prueba parte del estado de producción: un oplog v1 con toda la historia.

macOS:

```bash
SRC="$HOME/Library/Application Support/ecclesia"
DST="$HOME/ecclesia-prueba-A"
mkdir -p "$DST" && rsync -a --exclude backups --exclude Cache --exclude v8-code-cache "$SRC/" "$DST/"
# Sin token ni estado de la cuenta real: se conectará a la de prueba desde cero.
rm -f "$DST"/sync/google-drive-token.json "$DST"/sync/google-drive-config.json \
      "$DST"/sync/oplog-config.json "$DST"/sync/media-manifest.json
```

Windows (PowerShell):

```powershell
$SRC = "$env:APPDATA\ecclesia"; $DST = "$env:USERPROFILE\ecclesia-prueba-A"
robocopy $SRC $DST /E /XD backups Cache v8-code-cache
Remove-Item "$DST\sync\google-drive-token.json","$DST\sync\google-drive-config.json","$DST\sync\oplog-config.json","$DST\sync\media-manifest.json" -ErrorAction SilentlyContinue
```

B empieza **vacío** (`~/ecclesia-prueba-B`, no hay que crearlo): así se prueba también
el caso "equipo nuevo que se une".

### Cómo abrir cada versión

| | macOS | Windows |
| --- | --- | --- |
| A, versión actual | `open -n -a Ecclesia --args --user-data-dir="$HOME/ecclesia-prueba-A"` | `& "<carpeta de instalación>\Ecclesia.exe" --user-data-dir="$env:USERPROFILE\ecclesia-prueba-A"` (por defecto `%LOCALAPPDATA%\Programs\Ecclesia`) |
| Versión nueva | `open -n <ruta>/Ecclesia.app --args --user-data-dir="$HOME/ecclesia-prueba-B"` | igual, con el `.exe` del build nuevo |

Log del sync en cada equipo: `$TMPDIR/ecclesia-oplog-sync.log` (macOS) o
`%TEMP%\ecclesia-oplog-sync.log` (Windows). Vacíalo antes de cada paso para leerlo fácil.

## 1. A (actual) sube la historia al Drive de prueba

1. Abre A, ve a Ajustes → Sincronización → **Conectar Google** con la **cuenta de prueba**.
   Pulsa **Sync** en la barra superior.
2. En drive.google.com (cuenta de prueba) → carpeta `Ecclesia`: debe aparecer
   `ecclesia-oplog.bin` y los blobs de medios.
3. Anota en A: nº de canciones, de medios y de cronogramas.

✅ Esperado: Drive queda como hoy en producción, solo con el archivo v1.

## 2. B (nueva) se une desde cero

1. Abre B, Ajustes → Sincronización → **Conectar Google** (cuenta de prueba), pulsa **Sync**
   y espera a que bajen los medios.
2. Compara con lo anotado en A: mismas canciones, medios (con miniaturas) y cronogramas.
3. Drive: ahora existe además `ecclesia-oplog-v2.json.gz`. `ecclesia-oplog.bin` tiene la
   **misma fecha de modificación** que en el paso 1.
4. Log de B: `download ecclesia-oplog.bin` y, al subir, `uploadOplog ... created`.

✅ Esperado: B adopta la historia de A leyendo el v1, crea el v2 y no toca el v1.

## 3. Cambios en A (actual) → llegan a B

En A:
- crea una canción `Prueba A1`,
- edita la letra de una canción existente,
- borra un medio,
- pulsa **Sync**.

En B pulsa **Sync** (o espera al ciclo automático, máx. 5 min).

✅ Esperado en B: aparece `Prueba A1`, la letra editada y el medio borrado desaparece.
Log de B: `[PullLegacy] Oplog v1 cambió (gen X → Y)` y `N nuevos`.

## 4. Cambios en B (nueva) → NO llegan a A (esperado)

En B crea `Prueba B1` y pulsa **Sync**. En A pulsa **Sync**.

✅ Esperado: `Prueba B1` **no** aparece en A. Es la limitación conocida de la
transición: los equipos viejos no leen el v2. `ecclesia-oplog.bin` sigue sin cambiar de fecha
por culpa de B (solo cambia cuando sincroniza A).

## 5. Actualizar A a la versión nueva

1. Cierra A (confirma "Cerrar" en el aviso de salida).
2. Abre la versión nueva con la carpeta de A (`--user-data-dir=…/ecclesia-prueba-A`).
3. En `ecclesia-prueba-A/sync/`: existe `oplog-v2.json.gz` **y** `oplog.v1.bak.bin`, y ya no
   `oplog.bin`. Log: `OpLog migrado de Automerge a v2 (N ops)`.
4. Pulsa **Sync** en A.

✅ Esperado: aparece `Prueba B1` en A. **Una sola vez** (sin duplicados) y siguen
`Prueba A1`, la letra editada y el borrado del paso 3.

## 6. Los dos en versión nueva

1. En A edita `Prueba B1`; en B crea `Prueba B2`. Pulsa **Sync** en A, luego en B, luego en A otra vez.
2. Haz algo a la vez: edita en A y en B **canciones distintas** y pulsa Sync en los dos casi
   al mismo tiempo (uno recibirá un 412 de Drive y reintentará; en el log: `Conflicto detectado`).
3. Sync dos veces más en cada uno.

✅ Esperado: A y B iguales (mismos totales, mismas letras); nada duplicado ni perdido.

## 7. Memoria

Con los dos sincronizados, en cada equipo:

- macOS: `footprint -p $(lsof -tiTCP:7777 -sTCP:LISTEN | head -1) | grep Footprint`
- Windows: Administrador de tareas → Detalles → proceso `Ecclesia.exe` principal → "Espacio de trabajo privado".

✅ Esperado: proceso principal **< 300 MB** (antes ~1,3 GB).

## Si algo falla

- Copia `ecclesia-oplog-sync.log` de los dos equipos y los números del paso donde falló.
- Nada de esto toca tu cuenta ni tus datos reales. Para empezar de cero: borra las
  carpetas `ecclesia-prueba-A/B` y la carpeta `Ecclesia` de la cuenta de prueba.
- El v1 de Drive y `oplog.v1.bak.bin` no se borran nunca: siempre se puede volver a la
  versión actual con la historia completa.

## Al terminar

Borra `~/ecclesia-prueba-A`, `~/ecclesia-prueba-B` y la carpeta `Ecclesia` del Drive de prueba.
