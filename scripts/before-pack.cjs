const { spawnSync } = require('node:child_process')
const { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } = require('node:fs')
const path = require('node:path')

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    stdio: 'inherit',
    env: process.env,
    ...options
  })

  if (result.status !== 0) {
    throw new Error(`Command failed: ${command} ${args.join(' ')}`)
  }
}

async function beforePack() {
  const projectRoot = path.resolve(__dirname, '..')
  const prismaDir = path.join(projectRoot, 'prisma')
  const outputDbPath = path.join(prismaDir, 'empty-prod.db')
  const sourceSchemaPath = path.join(prismaDir, 'schema.prisma')
  const tempSchemaPath = path.join(prismaDir, 'schema.build-temp.prisma')
  const prismaBin = process.platform === 'win32' ? 'prisma.cmd' : 'prisma'
  const prismaPath = path.join(projectRoot, 'node_modules', '.bin', prismaBin)

  if (!existsSync(prismaPath)) {
    throw new Error(`Prisma CLI not found at ${prismaPath}`)
  }

  mkdirSync(prismaDir, { recursive: true })
  rmSync(outputDbPath, { force: true })
  rmSync(`${outputDbPath}-journal`, { force: true })

  const schemaSource = readFileSync(sourceSchemaPath, 'utf8')
  const schemaForBuild = schemaSource.replace(
    /url\s*=\s*"file:\.\/dev\.db"/,
    'url      = "file:./empty-prod.db"'
  )
  writeFileSync(tempSchemaPath, schemaForBuild, 'utf8')

  console.log(`Preparing empty production DB template at ${outputDbPath}`)

  try {
    run(prismaPath, ['migrate', 'deploy', '--schema', tempSchemaPath], {
      cwd: projectRoot,
      env: {
        ...process.env,
        PRISMA_SKIP_POSTINSTALL_GENERATE: '1'
      }
    })
  } finally {
    rmSync(tempSchemaPath, { force: true })
  }

  if (!existsSync(outputDbPath)) {
    throw new Error(`Failed to generate DB template at ${outputDbPath}`)
  }

  console.log('Empty production DB template generated successfully')
}

exports.default = beforePack

if (require.main === module) {
  beforePack().catch((error) => {
    console.error(error)
    process.exit(1)
  })
}
