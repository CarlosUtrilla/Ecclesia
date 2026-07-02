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

## Archivos
- `media.controller.ts` — endpoints IPC/multipart: `create`, `findAll`, `findOne`, `findByFilePath`, `importFile`, `importClipboardImage`, `importPdf`, `createFolder`, `deleteFolder`, `renamePath`, `listFolders`, `movePath`, `copyFile`, `extractZipMp4`, `cleanupTempPath`, `update`, `deleteFile`, `getMediaByIds`, `verifyFiles`, `cleanupOrphans`
- `media.service.ts` — lógica de negocio, `importPdfFromMulter()` crea Presentation + PDF Media con `presentationId`; `findAll()` filtra `__pdf/`
- `media.storage.ts` — operaciones de archivo: `importMediaFromSourcePath`, `importClipboardImage`, `importPdfPages`, `extractZipMp4`, `deleteFile`, `createMediaFolder`, etc.
- `media.dto.d.ts` — DTOs: `CreateMediaDto`, `UpdateMediaDto`, `MediaDto`, `MediaFilterDto`, `VerifyMediaResult`

## Dependencias
- `pdfjs-dist` (v3.11.174) — renderizado de PDF a canvas en Node.js
- `@napi-rs/canvas` (^1.0.1) — canvas nativo para Node.js (sin node-canvas)

## Ubicación
`apps/api/src/controllers/media/`
