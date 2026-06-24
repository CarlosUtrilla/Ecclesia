import * as esbuild from 'esbuild'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, '..')

await esbuild.build({
  entryPoints: [path.join(root, 'src', 'standalone.ts')],
  bundle: true,
  platform: 'node',
  target: 'node22',
  outfile: path.join(root, 'dist', 'sidecar.js'),
  external: [
    'better-sqlite3',
    'sharp',
    '@prisma/client',
    '@prisma/engines',
    '@ffmpeg-installer/ffmpeg',
    'bufferutil',
    'utf-8-validate',
    'font-list',
  ],
  format: 'cjs',
  sourcemap: true,
  minify: false,
  keepNames: true,
  tsconfig: path.join(root, 'tsconfig.json'),
}).catch(() => process.exit(1))
