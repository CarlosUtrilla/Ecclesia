# Stage Layout Agent

> **Agent router:** [../../agents.md](../../agents.md)

## Descripcion

Ventana dedicada para editar el `layout` de pantallas `STAGE_SCREEN`.
Implementa editor visual de recursos stage con posicionamiento y tamano por porcentaje.

## Archivos

- `index.tsx`: ruta `/stage-layout`, selector de pantalla stage, canvas visual y panel de propiedades.
- `../stage/shared/layout.ts`: tipos y normalización de layout (`StageLayout`, `StageLayoutItem`, defaults).

## Recursos editables

- `message`: caja de mensaje persistente.
- `timers`: contenedor de timers activos.
- `clock`: reloj en tiempo real.
- `liveTitle`: título del recurso en vivo actual.
- `liveScreen`: caja para renderizar `PresentationView` en modo live dentro del stage.

Cada recurso permite editar `title`, visibilidad y configuraciones visuales por widget.
Además, los widgets del canvas son arrastrables con mouse para ajustar `x/y` directamente.
Tambien incluyen control de `resize` por arrastre para ajustar `w/h` desde el canvas.
El editor aplica `snap` a grilla de 2% durante move/resize para facilitar alineacion visual.

## Configuracion por widget

- `timers`: color normal, color de umbral, color en negativo, umbral en segundos y fuente.
- `timers`: color normal, color de umbral, color en negativo, umbral en segundos, fuente y tamaño independiente para `etiqueta`/`valor`.
- `clock`: color de texto, fuente y tamaño de fuente.
- `message`: color de texto, fuente y tamaño de fuente.
- `liveTitle`: color de texto, fuente y tamaño de fuente.
- Los tamaños se seleccionan con listas de opciones en `px` (patrón consistente con editores de tema/presentación), en lugar de inputs numéricos libres.
- Las listas de tamaño se separan por contexto: texto general (`message/clock/liveTitle`) con rango normalizado hasta `96px`, y timers con rango extendido para `valor`.
- Las posiciones/tamanos se ajustan en canvas (drag/resize), no con inputs numericos en panel.
- La seleccion de fuente reutiliza `FontFamilySelector`, con acceso a todas las fuentes del sistema y fuentes personalizadas de `FontsContext`.
- Los colores se editan con `ColorPicker` compartido de `app/ui/colorPicker.tsx`.
- El drag/resize usa el hook compartido `useCanvasWidgetTransform` (`app/hooks/useCanvasWidgetTransform.ts`).
- El resize incluye handles en esquinas y bordes, alineado con el patrón de editores visuales de la app.
- Las funciones de actualización de widget se mantienen estables (`useCallback`) para no interrumpir listeners de drag/resize durante rerenders.
- El callback `onUpdateWidgetRect` hacia el hook tambien es estable para evitar cleanup prematuro de listeners durante drag/resize.

## Vista en vivo en editor

- El canvas puede alternar entre fondo negro y `Vista en vivo` para acomodar overlays stage sobre el contenido real proyectado.
- La vista en vivo usa los eventos IPC `liveScreen-update` y `liveScreen-update-theme`.
- En `liveScreen-update`, `itemIndex` es opcional; el editor aplica guardia `typeof data.itemIndex === 'number'` antes de actualizar estado local.
- Si existe tema configurado para la pantalla stage seleccionada, se prioriza sobre el tema live global para la previsualizacion.

## Flujo

- Persistencia de layout: `window.api.stageScreenConfig.upsertStageScreenConfig`.
- Notificación en caliente: `window.displayAPI.updateStageScreenConfig`.
- Se abre desde preload: `window.windowAPI.openStageLayoutWindow()`.
