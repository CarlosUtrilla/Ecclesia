# Settings Screen Agent

> **Agent router:** [`/agents.md`](../../../agents.md)

## Descripcion

Pantalla de ajustes de la aplicacion, abierta en ventana separada (`/settings`).
Actualmente incluye:

- Tema de colores global (`light`, `dark`, `system`) persistido en `localStorage`.
- Sincronización con Google Drive (OAuth + scheduler automático) sobre pipeline diferencial en almacenamiento oculto de app (`appDataFolder`).
- Sincronizacion con Google Drive con estrategia de conflicto configurable, eventos de auto-sync y aplicacion en caliente (sin reinicio).
- Credenciales OAuth de Google Drive configuradas a nivel app por variables de entorno (`GOOGLE_DRIVE_CLIENT_ID`, `GOOGLE_DRIVE_CLIENT_SECRET`), no por usuario en UI.
- La UI muestra controles esenciales (activar, workspace, nombre del dispositivo, conectar/subir/descargar).
- Los ajustes de sincronización se persisten automáticamente (debounced) y se reaplican al abrir la pantalla, para mantener activo el scheduler de auto-sync (incluido `autoEvery5Min`) sin depender de acciones manuales adicionales.
- El control de conexión es un único botón contextual (`Conectar Google` / `Desconectar`) según estado de sesión.
- El botón principal de acción en el footer es `Sincronizar ahora`: persiste ajustes actuales y ejecuta `pushNow` inmediato cuando hay conexión activa.
- **Logo / Pantalla de fondo**: permite seleccionar un recurso multimedia (imagen o video) de la biblioteca como fondo permanente en las pantallas en vivo, más un color de respaldo. Persistido en la DB via `window.api.setttings` usando los keys `LOGO_FALLBACK_MEDIA_ID` y `LOGO_FALLBACK_COLOR`.
## Archivos

```text
app/screens/settings/
├── index.tsx      # Contenedor de ajustes + navegación lateral
├── schema.ts      # Zod schema + tipos del formulario de sincronizacion
├── components/
│   ├── colorSettingsSection.tsx    # Lógica/UI del menú Tema de colores
│   ├── syncSettingsSection.tsx     # Lógica/UI del menú Sincronización
│   ├── logoFallbackSection.tsx     # Lógica/UI del menú Logo / Pantalla de fondo
│   ├── remoteControl.tsx          # Control remoto LAN: descubre y conecta otras instancias
│   └── aboutSection.tsx           # Versión de la app, icono y estado de actualizaciones
└── agents.md
```

## Flujo

- La ventana se abre desde `window.windowAPI.openSettingsWindow()`.
- Electron carga la ruta hash `/settings` usando `createSettingsWindow()`.
- El modo de color guardado se aplica globalmente en `app/main.tsx` para todas las ventanas.
- La sección de sincronización usa `window.googleDriveSyncAPI` (preload) para conectarse y disparar `push/pull` del pipeline diferencial.
- **El botón "Subir" hace reconcile automático** antes del push: ejecuta `window.googleDriveSyncAPI.reconcileNow()` y luego `pushNow`, para indexar estado actual (incluyendo cambios históricos) y subirlo a Google Drive sin pasos manuales adicionales.
- **Diagnóstico y Reparación**: sección separada con dos botones:
  - **"Diagnosticar"** → llama `window.googleDriveSyncAPI.diagnoseNow()` que ejecuta `diagnoseSyncIssues()` en el main process. Compara archivos locales vs manifest remoto y muestra un resumen con conteos de archivos OK, por subir, por descargar, huérfanos y eliminados. Incluye un detalle colapsable con la lista de archivos con problemas.
  - **"Reparar"** → llama `window.googleDriveSyncAPI.healNow(diagnostic)` que ejecuta `healSyncIssues()` en el main process. Sube archivos que faltan en Drive y descarga archivos que faltan localmente. Actualiza ambos manifests al finalizar.
- El campo `deviceName` se muestra visible en el formulario. Al cargar, se auto-rellena con el hostname del sistema si no hay valor guardado. **Debe ser único por dispositivo** para que el pull funcione correctamente entre equipos.
- El estado visible incluye: cuenta conectada, nombre del dispositivo, última sincronización, errores del último run y cambios pendientes de subir.
- La UI escucha el evento `sync-state` del main process para mostrar en tiempo real errores del scheduler automático (intervalo, retry, startup) sin necesidad de refrescar la página.
- Los errores de descarga individual de archivos (media, biblias) ya no interrumpen el ciclo pull: se loguean y se salta el archivo, el resto del lote continúa y el manifest local se actualiza con las descargas exitosas.
- **Pestaña Dev**: contiene utilidades de desarrollo y diagnóstico. Actualmente incluye:
  - Botones Diagnosticar/Reparar de sincronización Google Drive (movidos desde Sincronización).
  - Botón "Limpiar archivos no vinculados": llama `window.googleDriveSyncAPI.cleanupMediaOrphans()` que ejecuta `cleanupOrphanMediaFromDiskAndDrive()` en el main process. Pide confirmación antes de eliminar. Muestra resultado con detalle colapsable incluyendo conteo de eliminaciones de Drive.
- Visible en producción por ahora.

### Control remoto LAN (`remoteControl.tsx`)

- Permite descubrir y conectar con otras instancias de Ecclesia en la misma red LAN.
- **Búsqueda LAN**: descubre dispositivos vía UDP broadcast mediante `window.remoteControlAPI.discoverLan()`.
- **Lista de dispositivos**: muestra nombre + IP de cada instancia encontrada, con botón `Conectar` por fila.
- **Conexión manual**: entrada de IP directa + botón `Conectar`.
- Al conectar: llama `setApiConfiguration(queryClient, 'http://{ip}', 7777)` para redirigir todas las llamadas `Api.fetch.*` al host, y `switchSSEConnection('http://{ip}')` para recibir actualizaciones SSE del host.
- Al desconectar: restaura API a localhost y reconecta SSE local.
- No usa `forwardCall` ni canales IPC intermediarios — la conexión es directa del renderer al Express del host.
- `remoteControlEnabled` y `remoteControlIP` se persisten en `localStorage` (no en DB).

## Convenciones

- Formularios con React Hook Form + Zod.
- Textos de UI en español.
- Persistencia local en MVP sin llamadas al backend.
