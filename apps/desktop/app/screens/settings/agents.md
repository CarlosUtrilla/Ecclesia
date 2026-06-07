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
- **Biblia en vivo**: permite configurar cómo se fragmentan los versículos largos en live (`auto`, `100`, `150`, `200`, `250`). Persistido en la DB via `window.api.setttings` usando el key `BIBLE_LIVE_CHUNK_MODE`.

## Archivos

```text
app/screens/settings/
├── index.tsx      # Contenedor de ajustes + navegación lateral
├── schema.ts      # Zod schema + tipos del formulario de sincronizacion
├── components/
│   ├── colorSettingsSection.tsx    # Lógica/UI del menú Tema de colores
│   ├── syncSettingsSection.tsx     # Lógica/UI del menú Sincronización
│   ├── logoFallbackSection.tsx     # Lógica/UI del menú Logo / Pantalla de fondo
│   ├── bibleLiveSection.tsx        # Lógica/UI del menú Biblia en vivo
│   ├── remoteControl.tsx          # Control remoto LAN: descubre y conecta otras instancias
│   └── aboutSection.tsx           # Versión de la app, icono y estado de actualizaciones
└── agents.md
```

## Flujo

- La ventana se abre desde `window.windowAPI.openSettingsWindow()`.
- Electron carga la ruta hash `/settings` usando `createSettingsWindow()`.
- El modo de color guardado se aplica globalmente en `app/main.tsx` para todas las ventanas.
- La sección de sincronización usa `window.googleDriveSyncAPI` (preload) para conectarse y disparar `push/pull` del pipeline diferencial.
- La sección `Biblia en vivo` usa `window.api.setttings.getSettings/updateSettings` para guardar el modo de fragmentación y el runtime lo aplica al construir contenido `BIBLE` en schedule/live.
- **El botón "Subir" hace reconcile automático** antes del push: ejecuta `window.googleDriveSyncAPI.reconcileNow()` y luego `pushNow`, para indexar estado actual (incluyendo cambios históricos) y subirlo a Google Drive sin pasos manuales adicionales.
- El campo `deviceName` se muestra visible en el formulario. Al cargar, se auto-rellena con el hostname del sistema si no hay valor guardado. **Debe ser único por dispositivo** para que el pull funcione correctamente entre equipos.
- El estado visible incluye: cuenta conectada, nombre del dispositivo, última sincronización, errores del último run y cambios pendientes de subir.

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
