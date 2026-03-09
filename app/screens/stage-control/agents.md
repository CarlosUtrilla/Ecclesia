# Stage Control Agent

> **Agent router:** [../../agents.md](../../agents.md)

## Descripcion

Ventana dedicada de control operativo para pantallas `STAGE_SCREEN`.
Permite gestionar estado en caliente (`state`) sin mezclar UI de stage con el panel `items-on-live`.
Centraliza toda la operación stage fuera de `Settings`.

## Archivos

- `index.tsx`: shell de ventana (`/stage-control`) y cierre de ventana actual; organiza el contenido en tabs (`Control Stage` primero, `Temas Stage` segundo).
- `components/stageThemesPanel.tsx`: asignación de tema por pantalla stage y acceso a `Stage Layout`.
- `components/stageControlsPanel.tsx`: layout en dos columnas en desktop: izquierda con selector de pantalla stage + mensaje persistente en `textarea`, derecha con preview embebido de salida stage; además timers (máximo 5) con entrada de horas/minutos/segundos, contador restante visible en la lista y formato de reloj.

## Flujo

- Persistencia: `window.api.stageScreenConfig.upsertStageScreenConfig`.
- Refresco en tiempo real: `window.displayAPI.updateStageScreenConfig`.
- Se abre desde preload: `window.windowAPI.openStageControlWindow()`.
- Desde esta ventana se abre `Stage Layout` con `window.windowAPI.openStageLayoutWindow()`.

## Reglas operativas

- Timers stage limitados a 5 visibles por pantalla (`state.timers`).
- Creación de timer con duración configurable por `horas`, `minutos` y `segundos`.
- Los inputs de duración (`horas/minutos/segundos`) incluyen label visible encima de cada campo para identificación rápida.
- La lista de timers muestra tiempo restante en tiempo real (incluye conteo negativo al vencer, igual que runtime stage).
- Configuración de reloj en `state.clock` con:
  - `hourFormat`: `12` o `24`.
  - `showMeridiem`: mostrar/ocultar `AM/PM` en modo 12h.
