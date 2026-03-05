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
- Cuando una diapositiva de presentación contiene un layer bíblico con rango (`verseEnd`), el avance de verso se hace con controles internos `Verso anterior/siguiente`, sin cambiar `itemIndex` ni provocar cambio de diapositiva.
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
- Para mantener consistencia visual con proyección, `RenderGridMode` admite `themeOverride`; en PRESENTATION usa `BlankTheme` por defecto (fondo blanco cuando no hay tema por slide).

Para sincronización avanzada multi-display, la lógica de `sendLiveMediaState` está implementada en el manager dedicado `liveMediaController` (Electron main), expuesto vía preload como `liveMediaAPI`. El canal `live-media-state` es modular y documentado en agents.md de Electron.

**Patrón modular:**

- Cada canal IPC debe tener su propio manager en Electron (`electron/main/liveMediaController/`).
- Se expone en preload/index.ts como `liveMediaAPI`.
- Documentar canal y propósito en agents.md.
