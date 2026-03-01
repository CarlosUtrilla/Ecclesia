# Settings Screen Agent

> **Agent router:** [`/agents.md`](../../../agents.md)

## Descripcion

Pantalla de ajustes de la aplicacion, abierta en ventana separada (`/settings`).
Actualmente incluye:

- Tema de colores global (`light`, `dark`, `system`) persistido en `localStorage`.
- Configuracion base de sincronizacion (MVP) persistida en `localStorage`.

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

## Convenciones

- Formularios con React Hook Form + Zod.
- Textos de UI en español.
- Persistencia local en MVP sin llamadas al backend.
