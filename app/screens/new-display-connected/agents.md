# New Display Connected Agent

> **Agent router:** [`/agents.md`](../../../agents.md)

## Descripcion

Dialog para configurar el uso de cada pantalla detectada (`LIVE_SCREEN`, `STAGE_SCREEN` o `NO_USE`).

## Archivo principal

- `index.tsx`: lista displays del sistema, cruza con `SelectedScreens` en DB y persiste cambios por IPC.

## Flujo de guardado

- `LIVE_SCREEN` / `STAGE_SCREEN`:
  - Si el display ya existe en DB, usa `updateSelectedScreen`.
  - Si no existe, usa `createSelectedScreen`.
- `NO_USE`:
  - Se persiste explícitamente como `rol: null` (create/update).
  - Esto evita que el sistema vuelva a marcar la pantalla como "no configurada".

## Integracion

- Entrada:
  - Prop `open` y `onOpenChange` desde `DisplaysProvider`.
  - Prop opcional `onSaved` para refrescar `DisplaysContext` al persistir.
- IPC:
  - `window.displayAPI.getDisplays()`
  - `window.api.selectedScreens.getAllSelectedScreens()`
  - `window.api.selectedScreens.createSelectedScreen()`
  - `window.api.selectedScreens.updateSelectedScreen()`
