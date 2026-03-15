# Stage Screen Agent

> **Agent router:** [../../agents.md](../../agents.md)

## Descripcion

Modulo de la ventana `stage-screen` (ruta `/stage-screen/:displayId`) para monitores de escenario (`STAGE_SCREEN`).
Renderiza el contenido actual con `PresentationView` y superpone widgets de estado stage.

## Archivo principal

- `index.tsx`: **orquestador** — estado IPC, ResizeObserver, memos de timers/widgets. Delega render a subcomponentes.
- `index.tsx`: no contiene `if (widget.type...)` inline; la composición visual vive en `StageWidgets` y `FocusModeOverlay`.
- `types.ts`: tipos compartidos (`StageState`, `StageTimer`, `ResolvedTimer`, `ContainerSize`, `DEFAULT_STATE`).
- `utils.ts`: funciones puras (`resolveRemainingMs`, `formatRemaining`, `fitFontSizeToWidth`, `formatClock`, `parseAspectRatioToNumber`, `MAX_STAGE_TIMERS`).
- `StageTextWidget.tsx`: widget de texto genérico usando `AnimatedText` con escalado por `fontScale`.
- `StageClockWidget.tsx`: render compartido del reloj (normal y enfoque) con estilos tipográficos y no-wrap consistentes.
- `StageMessageBlock.tsx`: bloque compartido para texto de mensaje (normal y enfoque) con tipografía configurable.
- `StageTimersList.tsx`: lista compartida para render de timers (normal y enfoque) usando `StageTimerTextLine`.
- `StageTimerTextLine.tsx`: línea label + valor de un timer con font size autoajustado al ancho del contenedor mediante `fitFontSizeToWidth`.
- `StageWidgets.tsx`: mapea `sortedWidgets` a sus componentes visuales (message, timers, clock, liveTitle, liveScreen).
- `FocusModeOverlay.tsx`: overlay fullscreen de modo enfoque; consume componentes compartidos para reloj/mensaje/timers.

## Fuentes de datos

- `window.api.selectedScreens.getSelectedScreenByScreenId(displayId)`
- `window.api.stageScreenConfig.getStageScreenConfigBySelectedScreenId(selectedScreenId)`
- Eventos IPC:
  - `liveScreen-update`
  - `liveScreen-update-theme`
  - `stageScreen-config-updated`
- `liveScreen-update` puede llegar como payload parcial; stage actualiza solo campos presentes (`itemIndex`, `contentScreen`, `presentationVerseBySlideKey`) para evitar re-renders de `PresentationView` cuando cambian controles de live.

## Comportamiento actual (MVP)

- Si hay `theme` configurado en `StageScreenConfig`, se usa ese tema para stage.
- Si no hay tema configurado, stage hereda el tema live recibido por IPC.
- Renderiza widgets definidos en `layout.items` (ordenados por `z` y respetando `visible`).
- Widgets soportados: `liveScreen`, `message`, `timers`, `clock`, `liveTitle`.
- Si existe al menos un widget `liveScreen`, el `PresentationView` se renderiza dentro de esa caja.
- El `liveScreen` calcula un `customAspectRatio` segun su caja (`w/h`) y el aspect ratio real del display stage, para que el contenido se adapte al contenedor configurado.
- Si no existe `liveScreen`, se mantiene fallback a `PresentationView` full-screen.
- `state.message` y `state.timers` se proyectan dentro de los widgets correspondientes.
- `state.timerVisualMode` permite alternar presets visuales de timers (`broadcast` y `compact`) en stage normal y modo enfoque.
- `state.timers` se limita a un máximo de 5 en render para mantener legibilidad.
- Los timers pueden continuar en cuenta negativa (despues de `00:00`).
- El widget `timers` soporta colores dinamicos por estado: normal, umbral cercano a cero y negativo.
- El umbral de cambio de color para `timers` es configurable por widget en segundos.
- Los textos de `timers` y `clock` escalan dinámicamente según ancho/alto del widget para adaptarse al contenedor.
- En `clock`, además del escalado por alto, se aplica ajuste por ancho útil del widget para evitar recortes laterales cuando el texto (incluyendo `AM/PM`) no cabe.
- En preview, el `clock` usa un ajuste de ancho más agresivo y un inset derecho adicional para evitar recorte del sufijo (`AM/PM`) en tarjetas pequeñas.
- En preview, el `clock` desactiva `tracking-wide` (usa tracking normal) para que el cálculo de ajuste de ancho sea consistente y no recorte caracteres al final.
- En preview, además se aplica un cap adicional de escala del tamaño de fuente del reloj para mantener visibilidad estable en miniaturas muy pequeñas.
- El escalado de texto se calcula con el tamaño real del contenedor (`ResizeObserver`), para que previews embebidos y pantalla stage completa mantengan proporciones correctas.
- El tamaño de texto de `timers` considera tambien la longitud real del tiempo (ej. horas largas) para evitar overflow fuera del contenedor.
- El reloj usa `state.clock` para formato (`12h`/`24h`) y visibilidad de `AM/PM`.
- Los widgets `clock`, `message` y `liveTitle` admiten color y fuente configurables desde layout.
- `liveTitle` usa `AnimatedText` (sin animación) para mantener consistencia visual con texto renderizado en stage.
- En esos widgets de texto, el tamaño de fuente y padding se escalan según el alto real del widget solo en modo preview; en live se respeta el tamaño base configurado.
- En `message`, `clock` y `liveTitle`, los paddings del contenedor se calculan en px a partir del tamaño de fuente efectivo (en vez de valores fijos en `rem`) para mantener proporción y evitar recortes en previews.
- Los tamaños de fuente se controlan por widget desde `layout.config`: `fontSize` para `clock/message/liveTitle` y `timerLabelFontSize` + `timerValueFontSize` para `timers`.
- `clock.fontSize` se normaliza a un rango acotado para evitar valores extremos heredados y mantener legibilidad consistente.
- En `timers`, la separación vertical entre etiqueta y valor se minimiza para evitar bloques con demasiado aire y mantener lectura compacta en previews.
- `timers` se renderiza en flujo normal (`div`/`span`) dentro de cada card para evitar problemas de layout absoluto en previews.
- El valor del tiempo en `timers` usa `AnimatedText` con `fontSize` ajustado dinámicamente al ancho real del card para evitar overflow horizontal en formatos largos.
- El valor del tiempo en `timers` usa dígitos tabulares (`tabular-nums`) y jerarquía tipográfica refinada (label en mayúsculas con tracking + valor central dominante) para mejorar legibilidad en vivo.
- La etiqueta/título de cada timer se mantiene alineada a la izquierda para lectura rápida del operador.
- El contenedor del valor de timer mantiene una altura explícita derivada del tamaño de fuente ajustado para evitar colapso visual del `AnimatedText`.
- Cada card de timer usa `label + value` con límites de tamaño por altura del card para evitar solapes.
- Cambios de `state` (mensaje/timers/reloj) no deben re-disparar la transición de tema del `PresentationView`; la animación solo ocurre cuando cambia realmente la fuente de tema (`configured` o `live`).
- Los widgets stage se renderizan sin bordes visuales (estilo limpio).
- Las tarjetas de `timers` conservan fondo azul translúcido para legibilidad operacional.
- **Modo enfoque** (`stageState.focusMode`): cuando está activo (live y preview), se muestra un overlay `z-50` con fondo oscuro semitransparente que renderiza reloj, timers y mensaje en gran tamaño. El reloj usa ajuste por ancho para evitar overflow en textos con meridiem. El mensaje escala por alto de contenedor y además se ajusta al ancho útil para mantener proporciones entre preview y pantalla real sin desbordes. Los timers usan `StageTimerTextLine` con font sizes proporcionales a la altura disponible. El overlay se calcula sobre `containerSize` real (igual que los demás widgets). Solo aparece si hay widget `clock`/`timers`/`message` visible en el layout.
- En modo enfoque, los cards de timer usan borde sutil + fondo cian translúcido y tamaños de fuente menos agresivos para evitar ruido visual y mantener balance con reloj/mensaje.
- Las posiciones y tamaños (`x`, `y`, `w`, `h`) se aplican en porcentaje sobre el viewport stage.
- Al recibir `stageScreen-config-updated`, la pantalla recarga config desde DB para aplicar cambios de tema/layout/state en caliente.
- Para evitar micro-cortes de video durante cambios frecuentes de estado (ej. `message`), la pantalla stage memoiza `configuredThemeId` y no vuelve a pedir/aplicar tema si `themeId` no cambió; solo actualiza `layout/state`.
