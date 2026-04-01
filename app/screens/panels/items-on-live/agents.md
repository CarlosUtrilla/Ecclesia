# Items-on-live Agent

## Reglas para controladores IPC y preload

Todo nuevo canal/controlador IPC que se exponga a renderer DEBE agregarse en `electron/preload/index.ts`, siguiendo la estructura y patrón de seguridad/contextBridge de ese archivo. Documentar y mantener la API centralizada ahí.

Ejemplo:

```ts
const liveMediaAPI = {
  onMediaState: (callback) => { ... }
}
contextBridge.exposeInMainWorld('liveMediaAPI', liveMediaAPI)
```

No exponer funciones directas de ipcRenderer fuera de este archivo.

## Soporte de items MEDIA (video/imágenes)

Este módulo ahora soporta la visualización de items del tipo MEDIA en vivo:

- Si el item es una imagen, se muestra centrada y adaptada.
- Si el item es un video, se muestra un reproductor con controles (play, pausa, reinicio, seek) y sincronización multi-display usando IPC (`live-media-state`).
- El componente principal es `RenderMedia.tsx`.
- Los controles visuales se componen con `VideoLiveControls.tsx` para mantener consistencia de UI (volumen, progreso, play/pause, reinicio y autorewind opcional).

## Soporte de PRESENTATION en items-on-live

- `index.tsx` usa un render especializado para `PRESENTATION`: `RenderPresentationLiveController`.
- `index.tsx` usa `liveContentVersion` (desde `useLive`) en la `queryKey` de contenido live para forzar refresh al reenviar el mismo item desde schedule.
- Este controlador reutiliza internamente `RenderGridMode` para seleccionar la diapositiva activa en vivo.
- Incluye barra inferior siempre visible con navegación `Anterior/Siguiente` e indicador de posición (`n/total`).
- Si la diapositiva activa contiene video (media directo o layer de presentación), muestra controles de video a la derecha (`Play`, `Pausa`, `Reiniciar`) y emite comandos por `live-media-state`.
- El controlador de PRESENTATION reutiliza `VideoLiveControls.tsx` para igualar la experiencia visual con `RenderMedia` (misma barra de volumen/progreso y acciones principales).
- El controlador respeta `slide.videoLiveBehavior`: `auto` inicia reproducción al entrar a la diapositiva, `manual` deja el video pausado hasta acción del usuario.
- El controlador también respeta `slide.videoLoop`: el `<video>` oculto usado para tiempo/progreso replica el loop real de la diapositiva para mantener sincronía con las pantallas live.
- Cuando una diapositiva de presentación contiene un layer bíblico con rango (`verseEnd`), el avance de verso se hace con controles internos `Verso anterior/siguiente`, sin cambiar `itemIndex` ni provocar cambio de diapositiva.
- Si la diapositiva activa contiene contenido bíblico (slide directo `BIBLE` o layer bíblico dentro de `PRESENTATION`), la barra inferior también muestra el selector de versión, compartiendo espacio con paginación, rango interno y controles de video.
- El cambio de versión en PRESENTATION no persiste en base de datos: reconstruye temporalmente el texto bíblico de la diapositiva activa, actualiza `verse.version` y lo propaga por `LiveContext` a live/stage mediante un mapa de overrides por `slideKey/layerId`.
- La grilla del panel mantiene una tarjeta por diapositiva real y muestra badge de rango (`vX-Y` o estado `actual/fin`) para slides con controlador bíblico.
- Las tarjetas de la grilla son responsivas (`w-full` en móvil y ancho fijo en escritorio) para mantener legibilidad sin romper la selección.
- El verso activo por slide se sincroniza por `LiveContext` usando `presentationVerseBySlideKey`, y se replica en `live-screen` mediante `updateLiveScreenContent`.
- El cambio de verso interno no remonta la diapositiva completa: evita re-animar otras capas compartidas (texto/imagen/video) y actualiza solo el contenido bíblico activo.
- La emisión inicial de `play/pause` del slide activo se condiciona a `liveScreensReady` para evitar perder comandos antes de que las ventanas live terminen de abrir.
- Para progreso/tiempo y duración en el panel de control, `RenderPresentationLiveController` usa un `<video>` oculto con `ref` como fuente local de verdad (`onLoadedMetadata`, `onTimeUpdate`).
- La duración del controlador usa estrategia dual: hint desde metadata persistida del `Media.duration` (cuando existe) + actualización por eventos nativos (`onLoadedMetadata`/`onDurationChange`) del video oculto.
- El controlador evita re-inicializaciones espurias por cambios de referencia de funciones (`sendLiveMediaState`) usando `ref` interna para emitir comandos.
- Si la metadata tarda en resolverse, aplica un polling corto sobre `videoRef.duration` como fallback para poblar la duración y habilitar cálculo correcto del slider.
- Al entrar o reingresar a una diapositiva con video en modo `auto`, el controlador envía una secuencia corta de reintentos `seek(0)+play` para evitar que se pierda el comando durante el remount del video en live.
- Al entrar o reingresar a cualquier diapositiva con video, el controlador reinicia explícitamente el video local y live a `0s` (inicio) antes de aplicar `play`/`pause` según la configuración (`auto`/`manual`).
- Para mantener consistencia visual con proyección, `RenderGridMode` admite `themeOverride`; si no existe override usa `appliedTheme` desde `LiveContext` y no `selectedTheme`, de modo que la grilla siga reflejando el tema realmente enviado a live aunque el operador cambie el selector. En PRESENTATION usa `BlankTheme` por defecto cuando no hay tema por slide.
- El selector de vista del panel (`list/grid`) se persiste en `localStorage` (`items-on-live-view-mode`) para restaurar la preferencia del operador al reiniciar la app.
- El contenedor principal usa `useKeyboardShortcuts` para navegación por teclado con foco: `ArrowLeft/ArrowUp` retrocede slide y `ArrowRight/ArrowDown` avanza slide cuando hay item en vivo con múltiples diapositivas.
- En `PRESENTATION`, la navegación con flechas respeta rangos bíblicos por slide: primero avanza/retrocede versículos internos y solo cambia de diapositiva al llegar al final/inicio del rango.
- En la sección de `Verso` de `RenderPresentationLiveController`, los botones de retroceso y avance muestran `Tooltip` con preview del verso anterior/siguiente en la versión bíblica seleccionada; el texto incluye referencia corta del libro (`book_short`, ej. `Mat 3:16`), con carga por hover/focus y caché.
- `RenderPresentationLiveController` extrae el render de botones de verso con tooltip en `VerseTooltipButton.tsx` y comparte una sola función para resolver previews adyacentes (`previous/next`) evitando duplicación de lógica.
- El controlador de rango de versos se separa en `VerseRangeController.tsx` (estado local, caché y carga lazy de previews), dejando `RenderPresentationLiveController` enfocado en orquestación de navegación de diapositivas y media.
- `VerseRangeController` también soporta modo `chunk` para textos bíblicos largos dentro de una sola diapositiva de `PRESENTATION`: en ese modo los botones navegan `Parte anterior/siguiente` sin cambiar de slide ni consultar versos adyacentes al backend.
- La familia de archivos de PRESENTATION ahora está agrupada en `components/RenderPresentationLiveController/` (`index.tsx`, `VerseRangeController.tsx`, `VerseTooltipButton.tsx`, `nextSlidePreview.utils.ts`) para mantener cohesión del módulo.
- `LivePanel` importa explícitamente `components/RenderPresentationLiveController/index` para evitar resoluciones transitorias al archivo legacy `RenderPresentationLiveController.tsx` después de moverlo a carpeta.
- La lógica de reproducción/sincronización de video del controlador se extrae a `usePresentationVideoController.ts` (estado de reproducción, seek, volumen, sync con live y fallback de duración), para aislar efectos de media del render.
- La barra inferior del controlador se extrae a `PresentationControllerFooter.tsx`, centralizando navegación de diapositivas, control de rango bíblico, selector de versión y controles de video en una sola pieza composable.

## Soporte de BIBLE en items-on-live

- El case `BIBLE` usa `RenderBibleLiveControls` (no `RenderBibleVerses` directamente) para envolver la lista de versos con una barra de controles inferior.
- Cuando un versículo bíblico es demasiado largo para live, el contenido llega fragmentado en múltiples slides del mismo verso; `RenderBibleVerses` usa `id` único por fragmento para evitar colisiones de render y permitir navegación estable entre partes.
- La barra inferior muestra un selector bíblico reutilizable (`BibleVersionSelector`) para cambiar la versión en tiempo real y lo renderiza con `contentPlacement="top"` para que el listado no se recorte contra el borde inferior del panel.
- El selector bíblico ahora usa más ancho para que la versión elegida se lea completa también cuando incluye nombre descriptivo.
- En el desplegable de versiones, cada opción muestra un `Tooltip` con preview del texto bíblico en esa traducción (hasta 150 caracteres), útil para comparar rápidamente qué versión elegir.
- La preview por opción se resuelve por hover con carga diferida (lazy) y caché por versión para evitar consultas repetidas al backend.
- Al seleccionar una versión, el componente reconstruye el `accessData` (`bookId,chapter,verseRange,<nueva_version>`) y llama `setItemOnLive({ ...itemOnLive, accessData })`. Esto hace que:
  1. El `useEffect` de `liveContext` que observa `itemOnLive` re-compute el contenido y lo envíe a las pantallas live.
  2. La `useQuery` de `LivePanel` haga refetch automático (el key incluye `itemOnLive.accessData`).
- El cambio de versión preserva rangos no contiguos del `verseRange` (ej: `1-3,8,12`) sin colapsarlos a un rango continuo, y la preview del selector usa la lista exacta de versos seleccionados.
- Las versiones disponibles se obtienen de `useBibleVersions()` (`window.api.bible.getAvailableBibles()`); el campo relevante es `v.version` (nombre del archivo `.ebbl` sin extensión).

## Nota Stage

- Los controles operativos stage fueron movidos a ventanas dedicadas (`/stage-control` y `/stage-layout`) para no mezclar responsabilidades en este panel.

Para sincronización avanzada multi-display, la lógica de `sendLiveMediaState` está implementada en el manager dedicado `liveMediaController` (Electron main), expuesto vía preload como `liveMediaAPI`. El canal `live-media-state` es modular y documentado en agents.md de Electron.

**Patrón modular:**

- Cada canal IPC debe tener su propio manager en Electron (`electron/main/liveMediaController/`).
- Se expone en preload/index.ts como `liveMediaAPI`.
- Documentar canal y propósito en agents.md.
