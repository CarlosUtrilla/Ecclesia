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

## Logo / Pantalla de fondo (fallback)

- Solo se aplica en la ventana de proyeccion live real (`isPreview = false`). En previews dentro de la app no se renderiza.
- Al montar, carga `LOGO_FALLBACK_MEDIA_ID` y `LOGO_FALLBACK_COLOR` desde la DB via `window.api.setttings.getSettings`.
- Si no hay item en vivo (`content.content` vacio), renderiza la capa fallback (`z-0`) con imagen/video y color configurado.
- Al pasar de estado vacío a primer item en live, mantiene temporalmente el fallback visible durante `delay + duration` de la transición de tema; luego lo oculta para evitar entrada brusca.
- Si hay item en vivo (incluyendo transiciones), el fondo del contenedor fuerza negro para evitar mostrar el fallback del usuario entre items.
- El contenido de `PresentationView` se renderiza en un wrapper `z-10` encima del fondo.
- Si el recurso es VIDEO, se usa `<video autoPlay loop muted>`. Si es IMAGE, se usa `<img>` con el thumbnail o la ruta directa.
