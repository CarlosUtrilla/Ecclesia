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

Para sincronización avanzada multi-display, la lógica de `sendLiveMediaState` está implementada en el manager dedicado `liveMediaController` (Electron main), expuesto vía preload como `liveMediaAPI`. El canal `live-media-state` es modular y documentado en agents.md de Electron.

**Patrón modular:**
- Cada canal IPC debe tener su propio manager en Electron (`electron/main/liveMediaController/`).
- Se expone en preload/index.ts como `liveMediaAPI`.
- Documentar canal y propósito en agents.md.
