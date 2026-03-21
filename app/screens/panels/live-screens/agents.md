# Live Screens Panel Agent

> **Agent router:** [`/agents.md`](../../../../agents.md)

## Descripcion

Panel de monitoreo de pantallas live en la vista principal. Permite activar/desactivar la salida en vivo, abrir la gestión de pantallas y mostrar previews de salida.

## Archivo principal

- `index.tsx`: toolbar de control (`En Vivo`, `Gestionar pantallas`) y lista de previews `LiveScreen` en modo `isPreview`.
- `index.tsx` también muestra la sección `Pantallas stage` con preview visual embebido por display (no solo nombre), reutilizando `StageScreen` en modo `isPreview`.
- `index.tsx` incluye una barra de estado sobre los controles `F9/F10/F11` para mostrar la lista de timers stage activos (etiqueta + tiempo restante) usando solo la config stage global (sin duplicar por display).
- `index.tsx` incluye un switch rápido de `Modo enfoque` en la cabecera de `Pantallas stage`, persistido en el estado global de stage y replicado a todas las pantallas stage.
- Los chips de timer en esa barra cambian a rojo cuando el tiempo restante está en negativo (timer vencido).

## Convenciones UI

- El botón principal de activación live se etiqueta como `En Vivo`.
- El botón `En Vivo (F7)` replica el atajo `F7`: solo activa live (`setShowLiveScreen(true)`), no funciona como toggle.
- El botón `Gestionar pantallas` se mantiene en variante compacta para no competir visualmente con el control principal.
- La toolbar muestra indicadores de estado para atajos: `F7` (live activo), `F9` (texto), `F10` (logo), `F11` (negro).
- Cuando un estado está activo, su indicador usa chip tintado por color y punto luminoso para feedback visual inmediato.
- Los chips también son botones interactivos: al hacer click alternan el estado equivalente a su atajo y respetan exclusión mutua entre `F10` (logo) y `F11` (negro).
- Los botones rápidos de `F9/F10/F11` mantienen etiquetas en una sola línea (`whitespace-nowrap`) para estabilidad visual en el grid inferior.
- El estado de timer stage se refresca en tiempo real (1s) y reconsulta configuración al recibir `stageScreen-config-updated`.
