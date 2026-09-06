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
- La firma vive en `@/ui/PresentationView/utils/themeTransitionSignature.ts` y la comparte `PresentationView`, que ademas deriva su propia clave de transicion del `effectiveTheme` que pinta (tema neutro de MEDIA, tema por slide de PRESENTATION). `themeTransitionKey` por si solo no cubre esos cambios.

## Agrupado de mensajes IPC

- `liveScreen-update` y `liveScreen-update-theme` llegan como mensajes IPC separados, asi que React los aplicaria en dos renders distintos: el contenido nuevo sustituiria al viejo **antes** de que la capa de tema se re-montara, y la transicion cruzada acabaria animando el contenido nuevo contra si mismo (efecto: "no se ve el cross fade").
- Por eso los handlers no llaman a `setState` directamente: acumulan en un objeto `pending` y se vuelcan juntos con `requestAnimationFrame`, con un `setTimeout` de respaldo (`PENDING_UPDATE_FALLBACK_MS = 50`) por si el rAF esta throttled (ventana ocluida u offscreen, como la de captura NDI).
- Un mensaje parcial (por ejemplo solo `liveControls`) sigue actualizando unicamente sus claves: `pending` distingue "ausente" de "presente con valor nulo" via `hasContentScreen`.

## Atajo de teclado F7

- Cuando la ventana live screen tiene el foco y se presiona F7, se invoca `window.displayAPI.closeAllScreens()`.
- `closeAllScreens` cierra todas las ventanas live y stage en el main process y emite `all-screens-closed` a la ventana principal, que actualiza `showLiveScreen = false`.

## Integracion

- Entrada IPC:
  - `liveScreen-update`
  - `liveScreen-update-theme`
- `liveScreen-update` acepta payload parcial (por ejemplo solo `liveControls`), y la pantalla actualiza únicamente las claves presentes para no resetear contenido/video innecesariamente.
- Salida IPC:
  - `window.displayAPI.closeAllScreens()` cuando se presiona F7.
- Salida UI:
  - `PresentationView` con `themeTransitionKey` para controlar transiciones.

## Preview mode en cliente remoto

- `LiveScreen` acepta props `previewContent`, `previewItemIndex`, `previewTheme`, `previewPresentationVerseBySlideKey`.
- Cuando `isPreview` y estas props se proporcionan, se usan en lugar del estado local (IPC-driven), permitiendo que el panel `live-screens` en cliente remoto muestre previews sin depender de IPC.

## Logo / Pantalla de fondo (fallback)

- Solo se aplica en la ventana de proyeccion live real (`isPreview = false`). En previews dentro de la app no se renderiza.
- Al montar, carga `LOGO_FALLBACK_MEDIA_ID` y `LOGO_FALLBACK_COLOR` desde la DB via `window.api.setttings.getSettings`.
- Si no hay item en vivo (`content.content` vacio), renderiza la capa fallback (`z-0`) con imagen/video y color configurado.
- Al pasar de estado vacío a primer item en live, mantiene temporalmente el fallback visible durante `delay + duration` de la transición de tema; luego lo oculta para evitar entrada brusca.
- Si hay item en vivo (incluyendo transiciones), el fondo del contenedor fuerza negro para evitar mostrar el fallback del usuario entre items.
- El contenido de `PresentationView` se renderiza en un wrapper `z-10` encima del fondo.
- Si el recurso es VIDEO, se usa `<video autoPlay muted playsInline>` con `loop` controlado por `LOGO_FALLBACK_VIDEO_LOOP` (por defecto `true`). Si es IMAGE, se usa `<img>` con el thumbnail o la ruta directa.
