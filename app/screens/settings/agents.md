# Settings Screen Agent

> **Agent router:** [`/agents.md`](../../../agents.md)

## Descripcion

Pantalla de ajustes de la aplicacion, abierta en ventana separada (`/settings`).
Actualmente incluye:

- Tema de colores global (`light`, `dark`, `system`) persistido en `localStorage`.
- Sincronización con Google Drive (OAuth + scheduler automático) sobre pipeline diferencial en almacenamiento oculto de app (`appDataFolder`).
- Sincronizacion con Google Drive con estrategia de conflicto configurable, eventos de auto-sync y aplicacion en caliente (sin reinicio).
- Credenciales OAuth de Google Drive configuradas a nivel app por variables de entorno (`GOOGLE_DRIVE_CLIENT_ID`, `GOOGLE_DRIVE_CLIENT_SECRET`), no por usuario en UI.
- La UI muestra solo controles esenciales (activar, workspace, conectar/subir/descargar); la configuración avanzada se mantiene con valores internos por defecto.
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
│   └── logoFallbackSection.tsx     # Lógica/UI del menú Logo / Pantalla de fondo
└── agents.md
```

## Flujo

- La ventana se abre desde `window.windowAPI.openSettingsWindow()`.
- Electron carga la ruta hash `/settings` usando `createSettingsWindow()`.
- El modo de color guardado se aplica globalmente en `app/main.tsx` para todas las ventanas.
- La sección de sincronización usa `window.googleDriveSyncAPI` (preload) para conectarse y disparar `push/pull` del pipeline diferencial, además de `reconcileNow` para reindexado manual de bootstrap cuando se necesite recuperación controlada.

## Convenciones

- Formularios con React Hook Form + Zod.
- Textos de UI en español.
- Persistencia local en MVP sin llamadas al backend.
