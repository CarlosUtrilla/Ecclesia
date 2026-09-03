# NDI Manager Agent

> **Agent router:** [`/agents.md`](../../../../../agents.md) · **Padre:** [`electron`](../../agents.md)

## Descripción

Salida de **vídeo NDI** de la pantalla de proyección. Publica una fuente NDI en la red local
que pueden consumir OBS, vMix, ATEM, ProPresenter, etc. Es el complemento de la salida de
texto para OBS (ver [`obs/agents.md`](../../../../api/src/controllers/obs/agents.md)): aquella
manda subtítulos por Browser Source, esta manda la imagen.

Funciona **aunque no haya proyector conectado**: los frames salen de una ventana oculta con
renderizado offscreen, no de la ventana de proyección real.

## Archivos

```text
electron/main/ndiManager/
├── index.ts              # initializeNdiManager(), ciclo de vida, IPC, persistencia
├── ndiConfig.ts          # NdiOutputConfig + defaults + parseNdiConfig/serializeNdiConfig
├── ndiConfig.test.ts     # Tests de parseo/saneado/acotado
├── ndiCaptureWindow.ts   # BrowserWindow offscreen + evento `paint` (BGRA)
├── ndiSender.ts          # Wrapper del addon nativo @stagetimerio/grandiose
├── ndiAPI.ts             # API expuesta al renderer vía preload (`window.ndiAPI`)
└── agents.md             # Este archivo
```

## Flujo

1. `initializeNdiManager()` (llamado desde `main/index.ts` tras `initializeBibleSearchManager`)
   lee `NDI_OUTPUT_CONFIG` de `Setting` y arranca la salida si `enabled` es `true`.
2. `createNdiSender()` crea el sender NDI (`grandiose.send`, `clockVideo: false`).
3. `createNdiCaptureWindow()` abre una `BrowserWindow` oculta con
   `webPreferences.offscreen: true` que carga la ruta `/live-screen/ndi`. Como
   `displayManager` hace broadcast de `liveScreen-update` / `liveScreen-update-theme` a
   **todas** las ventanas, esta ventana muestra exactamente lo mismo que la proyección.
4. Cada evento `paint` copia el bitmap BGRA a `lastFrame` (el buffer de `getBitmap()` solo es
   válido dentro del handler, por eso se copia).
5. Un ticker a los fps configurados reenvía `lastFrame` al sender. Reenviar el mismo frame
   mantiene el flujo estable cuando el contenido es estático; si un envío sigue en curso, el
   frame se descarta en vez de encolarse.
6. Otro ticker (2 s) consulta `sender.connections()` y emite `ndi:status-changed` a las
   ventanas cuando cambia el número de receptores.

## Canales IPC

| Canal | Tipo | Propósito |
| --- | --- | --- |
| `ndi:get-status` | `handle` | Devuelve `NdiStatus` (disponible, activo, nombre, receptores, versión, error, config) |
| `ndi:update-config` | `handle` | Persiste config y arranca/para/reinicia según lo que cambie |
| `ndi:start` | `handle` | Fuerza el arranque (marca `enabled: true`) |
| `ndi:stop` | `handle` | Detiene la salida (marca `enabled: false`) |
| `ndi:status-changed` | `send` → renderer | Notifica cambios de estado (receptores, arranque/parada) |

## Configuración

`NdiOutputConfig = { enabled, sourceName, width, height, fps }`, persistida como JSON en
`Setting` bajo la clave pública `NDI_OUTPUT_CONFIG` (`ndi.output.config`, registrada en
`apps/api/src/controllers/settings/settingKeys.ts`). Igual que las claves de OBS, no está en
el enum `SettingOptions` del schema: `SettingsService` escribe con `$executeRaw`.

`parseNdiConfig` nunca lanza: sanea el nombre (sin caracteres de control, máx. 64), acota
resolución (320–3840 × 180–2160, siempre par) y fps (1–60). Cambiar `sourceName`, resolución
o fps obliga a recrear sender y ventana (`requiresNdiRestart`); cambiar solo `enabled` no.

## Dependencia nativa

`@stagetimerio/grandiose` (fork mantenido de Streampunk/grandiose, NDI SDK 6). El SDK se
descarga en `pnpm install` y el addon se compila con node-gyp, por lo que el paquete está en
`allowBuilds` de `pnpm-workspace.yaml`.

- Es **N-API puro**: no hace falta `electron-rebuild`; el binario compilado contra Node carga
  tal cual bajo el ABI de Electron (verificado con `ELECTRON_RUN_AS_NODE=1`).
- Empaquetado: `asarUnpack: node_modules/@stagetimerio/grandiose/dist/**` en
  `electron-builder.yml` (el `.node` y `libndi.dylib` deben quedar fuera del asar).
- El `.d.ts` del paquete declara `FourCC`/`FrameType` como `const enum` (no sobreviven a
  esbuild) y **no** declara `version()` ni `isSupportedCPU()`. Por eso `ndiSender.ts` usa
  constantes numéricas propias con fallback y accede a esas funciones vía cast.
- Todo el módulo degrada con elegancia: si el addon no carga (CPU no soportada, binario
  ausente), `isNdiAvailable()` devuelve `false`, el diálogo lo indica y la app sigue normal.
- **No hay prebuilds publicados**: el addon se compila siempre desde fuente, y node-gyp no
  cross-compila (a diferencia de `sharp`/`better-sqlite3`/`@napi-rs/canvas`, que sí tienen
  binario Windows descargable). Por eso `release.sh` oculta su `binding.gyp` antes de
  `install-app-deps --platform=win32`, o electron-builder aborta con
  «node-gyp does not support cross-compiling native modules from source».
- Para meter NDI en un instalador Windows construido desde macOS:
  1. `gh workflow run ndi-addon.yml` — compila el addon en `windows-latest` y publica el
     artifact `grandiose-win32-x64` (`grandiose.node` + `Processing.NDI.Lib.x64.dll`).
  2. `release.sh` modo `local` lo descarga con `gh run download` a
     `packages/prebuilds/grandiose-win32-x64/` (git-ignored) y sustituye el `dist/` del
     store durante el empaquetado; el trap de `EXIT` devuelve el `dist/` de macOS.
  - Si el artifact no existe, el build continúa y el `.exe` sale sin NDI.
  - Hay que relanzar el workflow al subir la versión de `@stagetimerio/grandiose`.
- El job `build-windows` del CI (modos `tag`/`github`) compila el addon de forma nativa, así
  que ese instalador siempre lleva NDI.

## Convenciones

- El sender vive en el proceso principal. Si el copiado de frames a 1080p penaliza el hilo
  principal, el siguiente paso es moverlo a un `utilityProcess`.
- **Sin audio** por ahora: la salida es solo vídeo. Añadirlo requiere capturar PCM en el
  renderer (AudioWorklet) y mandarlo por IPC a `sender.audio()`.
- La ruta `/live-screen/ndi` usa un `displayId` no numérico a propósito: `useScreenSize` no
  encuentra ese display y cae al display de proyección/principal para la relación de aspecto.
- **Escalado Retina:** el OSR pinta en píxeles físicos, así que una ventana de 1280x720 en una
  pantalla con `scaleFactor` 2 produce frames de 2560x1440. Por eso `createNdiCaptureWindow`
  divide el tamaño configurado entre `screen.getPrimaryDisplay().scaleFactor`. Si aun así el
  bitmap no coincide con lo pedido, se avisa una vez por log y se emite con el tamaño real
  (el frame NDI siempre usa las dimensiones reales del bitmap, nunca las de la config).

## Permiso de red local (macOS)

macOS pide permiso de **Red local** para anunciar la fuente por mDNS. Mientras no se concede,
el sender arranca y escucha en los puertos NDI (5960/5961) pero **otras apps no ven la
fuente**; en desarrollo el permiso se concede a «Electron» en *Ajustes del Sistema →
Privacidad y seguridad → Red local*. Verificado: con el permiso concedido, un finder externo
descubre `HOSTNAME (Ecclesia)` y el contador de receptores del sender sube al conectarse.

Para el build empaquetado, `electron-builder.yml` declara `NSLocalNetworkUsageDescription` y
`NSBonjourServices: [_ndi._tcp]` en `mac.extendInfo`, que es lo que dispara el diálogo del
sistema con un texto explicativo.

## Verificación manual

Con la salida activa, desde otro proceso: `grandiose.find()` debe listar `HOSTNAME (Ecclesia)`.
Al conectar un receptor, el log muestra `[ndi] Receptores conectados: 1` (y `0` al cerrar), y el
tráfico saliente del proceso ronda los 7 MB/s a 720p30 (`nettop -P -p <pid> -J bytes_out`).

Ojo: el **receptor** de `@stagetimerio/grandiose` 0.2.0 hace segfault al pedir frames en macOS
arm64 (también contra senders ajenos), así que no sirve para inspeccionar la imagen. Para
validar visualmente, usar OBS con plugin NDI o NDI Video Monitor.

## UI

`app/screens/components/NdiOutputDialog.tsx`, abierto desde el menú «OBS» de `AppMenubar`
(«Salida de vídeo (NDI)...»). Muestra estado, nombre de fuente, resolución, fps y receptores
conectados; escucha `ndi:status-changed` mientras está abierto.
