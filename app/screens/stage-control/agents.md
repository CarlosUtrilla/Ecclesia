# Stage Control Agent

> **Agent router:** [../../agents.md](../../agents.md)

## Descripcion

Ventana dedicada de control operativo para pantallas `STAGE_SCREEN`.
Permite gestionar estado en caliente (`state`) sin mezclar UI de stage con el panel `items-on-live`.
Centraliza toda la operación stage fuera de `Settings`.

## Archivos

- `index.tsx`: shell de ventana (`/stage-control`) y cierre de ventana actual; organiza el contenido en tabs (`Control Stage` primero, `Temas Stage` segundo).
- `components/stageThemesPanel.tsx`: asignación de tema **global** compartido para todas las pantallas stage y acceso a `Stage Layout`.
- `components/stageControlsPanel.tsx`: layout en dos columnas en desktop: izquierda con controles globales (mensaje/timers/reloj/modo enfoque), derecha con preview embebido de salida stage usando automáticamente la primera pantalla stage detectada.
- `components/stageControlsPanel.tsx`: incluye presets rápidos de duración para timers (1, 2, 5, 10, 15, 20, 30, 45 y 60 minutos) que rellenan automáticamente `horas/minutos/segundos`.

## Flujo

- Persistencia: `window.api.stageScreenConfig.upsertStageScreenConfig`.
- Refresco en tiempo real: `window.displayAPI.updateStageScreenConfig`.
- Se abre desde preload: `window.windowAPI.openStageControlWindow()`.
- Desde esta ventana se abre `Stage Layout` con `window.windowAPI.openStageLayoutWindow()`.
- En modo global, cada guardado se replica a todas las filas `StageScreenConfig` de pantallas con rol `STAGE_SCREEN` para mantener consistencia total entre displays.

## Reglas operativas

- Timers stage limitados a 5 visibles en estado global compartido (`state.timers`).
- Creación de timer con duración configurable por `horas`, `minutos` y `segundos`.
- Presets rápidos para precargar duración de timer sin edición manual de inputs.
- Selector de estilo visual de timers por pantalla (`Broadcast` y `Compacto`) persistido en `state.timerVisualMode`.
- Los inputs de duración (`horas/minutos/segundos`) incluyen label visible encima de cada campo para identificación rápida.
- La lista de timers muestra tiempo restante en tiempo real (incluye conteo negativo al vencer, igual que runtime stage).
- Configuración de reloj en `state.clock` con:
  - `hourFormat`: `12` o `24`.
  - `showMeridiem`: mostrar/ocultar `AM/PM` en modo 12h.
- **Modo enfoque** (`state.focusMode: boolean`): Switch en el panel de control que activa un overlay fullscreen en la pantalla stage con reloj y timers a gran tamaño (proporcional al viewport). Solo disponible en live (sin efecto en preview). Requiere que existan widgets `clock`/`timers` en el layout para mostrarlos.
