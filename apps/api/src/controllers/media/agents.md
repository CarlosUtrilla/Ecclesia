# Media Controller Agent

## Descripción
Controlador para la gestión de archivos de medios (imágenes, videos, PDF) en Ecclesia.

## Responsabilidad
- CRUD de archivos de medios.
- Gestión de rutas y metadatos de archivos.
- Integración con el MediaServer de Electron.
- **Importación PDF**: `importPdf()` recibe PDFs via multer, renderiza cada página como PNG usando `pdfjs-dist` + `@napi-rs/canvas`, crea una Presentación oculta con slides por página y un único `Media` tipo `PDF` con `presentationId` a la Presentación.
- **Verificación de integridad**: `verifyFiles()` revisa todos los registros activos de Media y confirma que `filePath`, `thumbnail` y `fallback` existan realmente en disco. Retorna un resumen con conteos de archivos presentes/faltantes y detalle por registro.
- **Limpieza de archivos huérfanos**: `cleanupOrphans()` escanea `media/files/` y `media/thumbnails/`, compara contra todos los registros de la DB (incluyendo soft-delete), y elimina:
  - Archivos en disco sin registro en DB (huérfanos)
  - Archivos en disco cuyo registro DB tiene `deletedAt != null`
  - Thumbnails/fallbacks sin referencia en ningún registro
  - Retorna resumen con conteos y bytes liberados.

## Flujo de importación PDF
1. Usuario carga PDF → `media.importPdf` o `media.importFile` (multipart HTTP con fieldName `file`)
2. `MediaController` → `MediaService.importPdfFromMulter`
3. `MediaService` → `media.storage.importPdfPages` → `pdfConverter.pdfToPngBuffers` (pdfjs-dist v3 + @napi-rs/canvas)
4. Cada página PNG se guarda en carpeta oculta `__pdf/<name>/` vía `importMediaFromSourcePath`
5. Se crea un `Presentation` con una slide por página (tipo MEDIA apuntando a cada IMAGE page)
6. Se crea un solo `Media` record con `type: PDF`, `format: 'pdf'`, `presentationId` apuntando a la Presentation
7. `findAll` filtra items con `folder` que empieza con `__pdf/` (páginas ocultas)
8. `importFile` auto-detecta `.pdf` y devuelve `[singleMediaDto]`

## Flujo de importación PPTX
1. Usuario carga PPTX → `media.importPptx` o `media.importFile` (multipart), o el diálogo nativo vía IPC `media:import-pptx-file`. Las tres rutas acaban en el mismo método.
2. `MediaController` → `MediaService.importPptxFromMulter`
3. `MediaService` → `documentImport.getPptxRasterizer()` → `electron/main/pptxRenderer/pptxToPngBuffers`, que rasteriza cada diapositiva a PNG en una ventana offscreen. Ver [`pptxRenderer/agents.md`](../../../../desktop/electron/main/pptxRenderer/agents.md).
4. `documentImport.createDocumentPresentation` guarda las imágenes en `__pptx/<name>/`, crea la `Presentation` (una slide MEDIA por diapositiva) y el `Media` envoltorio con `type: PPTX` y `presentationId`.
5. Se conserva una copia del `.pptx` original en `__pptx/<name>/<name>.pptx`, para poder re-rasterizar a mayor escala más adelante sin volver a pedir el archivo.

> **El rasterizador se inyecta, no se importa.** Necesita `BrowserWindow`, así que la capa de API no puede llamarlo: el proceso principal lo registra al arrancar con `setPptxRasterizer()` (mismo patrón que `setOnMediaChangeCallback` en `prisma-init.ts`). Sin registro, importar un PPTX falla con un mensaje explícito en vez de producir diapositivas en blanco.

> **Antes no se renderizaba nada.** El `pptxConverter.ts` original sacaba los `<a:t>` con una regex y extraía las imágenes embebidas, perdiendo formas, fondos del layout/master, degradados y tipografías: las diapositivas se veían casi en blanco.

## Ocultado de las carpetas internas

`findAll()` esconde las imágenes de `__pdf/` y `__pptx/` salvo que se pida `type: 'PDF'` o `'PPTX'`. Las dos condiciones `NOT startsWith` van en **AND**: en OR la expresión es una tautología (una carpeta `__pdf/x` incumple la primera pero cumple la segunda) y no se oculta nada. El `folder: null` sí va en OR, porque `NOT startsWith` sobre columna nullable descarta los nulos por la lógica ternaria de SQL. Hay test de regresión en `apps/desktop/tests/media-hidden-folders.test.ts`.

## Borrado de PDF/PPTX

- `deleteFile()` hace soft-delete del Media **y de la `Presentation` vinculada** cuando el registro tiene `presentationId`. La presentación pertenece al Media importado; sin ese borrado quedaría viva para siempre.
- Es obligatorio: `OplogPurgeService.purgeSoftDeleted()` hace **hard delete** del Media tras el retention (30 días). Si la presentación no se borró, al desaparecer el Media queda huérfana (`pdfMedia: null`) y reaparece en la biblioteca de presentaciones.
- El título de esas presentaciones lleva el prefijo `__pdf_` / `__pptx_` (`presentations/importedPresentationTitle.ts`), único marcador que sobrevive a la purga y por el que `getPresentations()` filtra como segunda barrera.

## Archivos
- `media.controller.ts` — endpoints IPC/multipart: `create`, `findAll`, `findOne`, `findByFilePath`, `importFile`, `importClipboardImage`, `importPdf`, `createFolder`, `deleteFolder`, `renamePath`, `listFolders`, `movePath`, `copyFile`, `extractZipMp4`, `cleanupTempPath`, `update`, `deleteFile`, `getMediaByIds`, `verifyFiles`, `cleanupOrphans`
- `media.service.ts` — lógica de negocio, `importPdfFromMulter()` e `importPptxFromMulter()` crean Presentation + Media envoltorio con `presentationId`; `findAll()` filtra `__pdf/` y `__pptx/`
- `documentImport.ts` — tronco común de PDF y PPTX (`createDocumentPresentation`) y registro del rasterizador de PPTX (`setPptxRasterizer` / `getPptxRasterizer`)
- `media.storage.ts` — operaciones de archivo: `importMediaFromSourcePath`, `importClipboardImage`, `importPdfPages`, `extractZipMp4`, `deleteFile`, `createMediaFolder`, etc.
- `media.dto.d.ts` — DTOs: `CreateMediaDto`, `UpdateMediaDto`, `MediaDto`, `MediaFilterDto`, `VerifyMediaResult`

## Dependencias
- `pdfjs-dist` (v3.11.174) — renderizado de PDF a canvas en Node.js
- `@napi-rs/canvas` (^1.0.1) — canvas nativo para Node.js (sin node-canvas)
- `@aiden0z/pptx-renderer` — renderizado de PPTX; vive en `@ecclesia/desktop` porque pinta a DOM y necesita una ventana de Electron

## Ubicación
`apps/api/src/controllers/media/`
