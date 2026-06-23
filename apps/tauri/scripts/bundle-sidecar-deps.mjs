import { execSync } from 'child_process'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const API_DIR = path.resolve(__dirname, '..', '..', 'api')
const STAGING = path.resolve(__dirname, '..', 'src-tauri', 'sidecar-deps')

console.log('[Bundle] Preparando dependencias del sidecar...')

// Limpiar staging
if (fs.existsSync(STAGING)) {
  fs.rmSync(STAGING, { recursive: true, force: true })
}
fs.mkdirSync(STAGING, { recursive: true })

// Build sidecar
console.log('[Bundle] Compilando sidecar...')
execSync('node scripts/build-sidecar.mjs', { cwd: API_DIR, stdio: 'inherit' })
fs.copyFileSync(
  path.join(API_DIR, 'dist', 'sidecar.js'),
  path.join(STAGING, 'sidecar.js')
)

// Prisma schema y migraciones
console.log('[Bundle] Copiando Prisma...')
const prismaDest = path.join(STAGING, 'prisma')
fs.mkdirSync(prismaDest, { recursive: true })
fs.cpSync(path.join(API_DIR, 'prisma', 'schema.prisma'), path.join(prismaDest, 'schema.prisma'))
fs.cpSync(path.join(API_DIR, 'prisma', 'migrations'), path.join(prismaDest, 'migrations'), { recursive: true })

// Biblias
const biblesSrc = path.resolve(__dirname, '..', '..', 'desktop', 'resources', 'bibles')
if (fs.existsSync(biblesSrc)) {
  console.log('[Bundle] Copiando biblias...')
  const biblesDest = path.join(STAGING, 'bibles')
  fs.mkdirSync(biblesDest, { recursive: true })
  for (const f of fs.readdirSync(biblesSrc)) {
    if (f.endsWith('.ebbl')) {
      fs.copyFileSync(path.join(biblesSrc, f), path.join(biblesDest, f))
    }
  }
}

// .env
const envSrcs = [
  path.resolve(__dirname, '..', '..', '..', '..', '.env'),
  path.resolve(__dirname, '..', '..', '..', '.env'),
]
for (const envSrc of envSrcs) {
  if (fs.existsSync(envSrc)) {
    console.log(`[Bundle] Copiando .env desde ${envSrc}`)
    fs.copyFileSync(envSrc, path.join(STAGING, '.env'))
    break
  }
}

// Copiar node_modules nativos (resuelve symlinks con fs.cpSync dereference)
const NM = path.join(API_DIR, 'node_modules')
const NM_DEST = path.join(STAGING, 'node_modules')
fs.mkdirSync(NM_DEST, { recursive: true })

const deps = ['better-sqlite3', 'sharp']
for (const dep of deps) {
  const src = path.join(NM, dep)
  if (!fs.existsSync(src)) continue
  console.log(`[Bundle] Copiando ${dep}...`)
  const dest = path.join(NM_DEST, dep)
  fs.cpSync(src, dest, { recursive: true, dereference: true })
}

// @prisma y @ffmpeg-installer con scoped path
const scoped = ['@prisma/client', '@ffmpeg-installer/ffmpeg']
for (const dep of scoped) {
  const src = path.join(NM, dep)
  if (!fs.existsSync(src)) continue
  console.log(`[Bundle] Copiando ${dep}...`)
  const dest = path.join(NM_DEST, dep)
  fs.mkdirSync(path.dirname(dest), { recursive: true })
  fs.cpSync(src, dest, { recursive: true, dereference: true })
}

console.log('[Bundle] ✓ Dependencias preparadas')
