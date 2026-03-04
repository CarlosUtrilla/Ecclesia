# Live Screen Agent

> **Agent router:** [../../agents.md](../../agents.md)

## Descripcion

Modulo encargado de la ventana de proyeccion en vivo y su sincronizacion por IPC.

## Archivo principal

- `index.tsx`: renderiza `PresentationView` en modo `live`, recibe updates por IPC y controla cuando disparar transicion de tema.

## Reglas de transicion de tema

- Siempre actualiza `selectedTheme` cuando llega `liveScreen-update-theme`.
- Solo incrementa `themeTransitionKey` cuando cambia la firma de transicion del tema:
  - `theme.id`
  - `theme.background`
  - `backgroundMedia.type`
  - `backgroundMedia.filePath`
  - `backgroundMedia.thumbnail`
  - `backgroundMedia.fallback`
- Si llega el mismo tema/fondo (evento redundante), no dispara una nueva transicion.

## Integracion

- Entrada IPC:
  - `liveScreen-update`
  - `liveScreen-update-theme`
- Salida UI:
  - `PresentationView` con `themeTransitionKey` para controlar transiciones.
