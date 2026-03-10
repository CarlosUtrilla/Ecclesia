# Lista de pendientes y features esperadas

> La lista va en orden de prioridades y debe de considerarse resolver los problemas que estan mas arriba primero

---

## 🚀 PRIMER RELEASE BETA — Checklist de deploy

> Estado: **EN PREPARACIÓN** · Versión: `0.1.0-beta.1`

### Infraestructura (hacer una sola vez)

- [ ] Crear repositorio público en GitHub bajo `CarlosUtrilla/Ecclesia` (si no existe) o habilitarlo para releases.
- [ ] Generar un **GitHub Personal Access Token** con scope `repo` y guardarlo localmente.
  - `GH_TOKEN=ghp_xxx` en `.env` local (no commitear) para que `electron-builder` pueda subir el release.
- [ ] Verificar configuración de code signing para macOS (`notarize: false` por ahora en `electron-builder.yml`). Para distribución real fuera de la App Store se necesitará al menos un Developer ID.
  - Mínimo para beta interna: puede distribuirse sin notarizar (usuarios deberán pasar bypass de Gatekeeper).
- [ ] Para Windows (futuro): generar certificado de firma o usar modo sin firma para beta interna.

### Antes de buildear

- [ ] Revisar que no haya errores de TypeScript: `npm run typecheck`
- [ ] Ejecutar tests: `npm run test`
- [ ] Asegurarse de que `prisma/migrations/` solo tenga la migración de baseline activa.
- [ ] Verificar que los assets de build estén completos (`build/entitlements.mac.plist`, íconos, etc.).
  - [ ] Agregar `icon.icns` (macOS), `icon.ico` (Windows) e `icon.png` (Linux) en la carpeta `build/`.
- [ ] Actualizar `CHANGELOG.md` con los cambios del beta (crear el archivo si no existe).

### Crear el build y publicar

```bash
# Build para macOS (desde macOS)
GH_TOKEN=ghp_xxx npm run build:mac -- --publish always

# Build para Windows (desde Windows o usando cross-compilation)
GH_TOKEN=ghx_xxx npm run build:win -- --publish always
```

- El flag `--publish always` sube automáticamente el artefacto como GitHub Release pre-release (canal `beta`).
- Electron Builder subirá: el instalador, el archivo `latest-mac.yml` / `latest.yml` (manifest de update).

### Después del primer release

- [ ] En GitHub, editar el draft release creado automáticamente, agregar notas de versión y publicarlo.
- [ ] Verificar que el canal de auto-update funcione: instalar la versión publicada en una máquina de prueba y esperar que el updater detecte la siguiente versión.
- [ ] Para cada nueva versión: `npm version prerelease --preid=beta` (incrementa a `0.1.0-beta.2`, etc.) antes de hacer el build.

### Flujo de versiones

```
0.1.0-beta.1  ← primer release beta (actual)
0.1.0-beta.2  ← siguiente iteración
...
0.1.0         ← release estable cuando se considere listo
```

---

## 🔴 PRIORIDAD ALTA

### Micro-sync por cambio (sync parcial en cada CRUD)

> Objetivo: sincronizar cada cambio de forma inmediata y ligera. En vez de un ciclo completo de sync al guardar, solo se sube lo estrictamente necesario: el snapshot JSON para cambios de DB, o el manifest de media + blob para cambios de archivos. El ciclo completo sigue corriendo cada 5 min y vía botón manual.

- [ ] **`prisma.ts`** — Exportar `setOnOutboxWriteCallback(fn)` y `setOnMediaChangeCallback(fn)`. El primero se invoca después de cada `appendOutboxEntry`; el segundo solo cuando el modelo es `Media` o `Font`.
- [ ] **`googleDriveSyncManager.ts`** — Implementar `pushSnapshotOnly()` (solo build + upload del snapshot JSON; sin pull, sin media, sin biblia) y `pushMediaOnly()` (solo push side de `syncMediaManifest`; sin DB, sin pull). Exponer `scheduleMicroPush()` y `scheduleMicroMediaPush()` con debounce de 1 s.
- [ ] **`googleDriveSyncManager.ts`** — En `initializeGoogleDriveSyncManager()`: registrar `scheduleMicroPush` en `setOnOutboxWriteCallback` y `scheduleMicroMediaPush` en `setOnMediaChangeCallback`. Cambiar handler de `auto-save-event` para usar `scheduleMicroPush()` en lugar de `executeSyncCycle('save')`.
- [ ] **`googleDriveSyncAPI.ts`** — Añadir método `microPushMedia()` con IPC `sync:google-drive:micro-push-media`.
- [ ] **`library/index.tsx`** — Añadir botón de estado de sync en la cabecera: `✓ Sync` (idle + conectado) / `Sincronizando X%` (en curso). Click = `pushNow()` (ciclo completo). Solo visible cuando hay conexión.

---

7. [ ] Conseguir que los apuntadores (los que se usan para poner diapositiva siguiente y anterior) sean compatibles con la app.
