# Settings Screen Agent

> **Agent router:** [`/agents.md`](../../../agents.md)

## Descripcion

Pantalla de ajustes de la aplicacion, abierta en ventana separada (`/settings`).
Actualmente incluye:

- Tema de colores global (`light`, `dark`, `system`) persistido en `localStorage`.
- Sincronizacion con Google Drive (OAuth, subida de respaldo completo y descarga para restauracion al reiniciar).
- Sincronizacion con Google Drive con estrategia de conflicto configurable, eventos de auto-sync y aplicacion en caliente (sin reinicio).
- Credenciales OAuth de Google Drive configuradas a nivel app por variables de entorno (`GOOGLE_DRIVE_CLIENT_ID`, `GOOGLE_DRIVE_CLIENT_SECRET`), no por usuario en UI.
- La UI muestra solo controles esenciales (activar, workspace, conectar/subir/descargar); la configuración avanzada se mantiene con valores internos por defecto.
- El control de conexión es un único botón contextual (`Conectar Google` / `Desconectar`) según estado de sesión.
- El botón principal de acción en el footer es `Sincronizar ahora`: persiste ajustes actuales y ejecuta `pushNow` inmediato cuando hay conexión activa.

## Archivos

```text
app/screens/settings/
├── index.tsx      # Contenedor de ajustes + navegación lateral
├── schema.ts      # Zod schema + tipos del formulario de sincronizacion
├── components/
│   ├── colorSettingsSection.tsx  # Lógica/UI del menú Tema de colores
│   └── syncSettingsSection.tsx   # Lógica/UI del menú Sincronización
└── agents.md
```

## Flujo

- La ventana se abre desde `window.windowAPI.openSettingsWindow()`.
- Electron carga la ruta hash `/settings` usando `createSettingsWindow()`.
- El modo de color guardado se aplica globalmente en `app/main.tsx` para todas las ventanas.
- La seccion de sincronizacion usa `window.googleDriveSyncAPI` (preload) para conectarse, subir backup y preparar restauracion.

## Convenciones

- Formularios con React Hook Form + Zod.
- Textos de UI en español.
- Persistencia local en MVP sin llamadas al backend.
