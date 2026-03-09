# StageScreenConfig Backend Agent

> **Agent router:** [`/agents.md`](../../../agents.md)

## Descripcion

Controller/service para persistir configuración de pantallas stage por display configurado.

## Archivos

- `stageScreenConfig.controller.ts`: métodos IPC para CRUD de config stage.
- `stageScreenConfig.service.ts`: acceso Prisma al modelo `StageScreenConfig`.
- `stageScreenConfig.dto.d.ts`: DTOs de entrada para filtros y updates parciales.
- `index.ts`: exports del módulo.

## Capacidades

- Obtener configuración stage por `selectedScreenId`.
- Upsert de configuración base (`themeId`, `layout`, `state`).
- Updates parciales independientes para `theme`, `layout` y `state`.
- Eliminar configuración stage por pantalla.

## Notas

- `layout` y `state` se almacenan como JSON string para permitir alta customización en el editor stage.
- `state` está pensado para mensaje persistente y múltiples timers del operador.
