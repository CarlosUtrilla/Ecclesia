type LogFn = (...args: unknown[]) => void
interface Logger {
  info: LogFn
  warn: LogFn
  error: LogFn
  debug: LogFn
  log: LogFn
}

function formatArgs(args: unknown[]): string {
  return args.map((a) => (typeof a === 'object' ? (a instanceof Error ? a.stack || a.message : JSON.stringify(a)) : String(a))).join(' ')
}

const log: Logger = {
  info: (...args) => console.log(`\x1b[36m[info]\x1b[0m ${formatArgs(args)}`),
  warn: (...args) => console.warn(`\x1b[33m[warn]\x1b[0m ${formatArgs(args)}`),
  error: (...args) => console.error(`\x1b[31m[error]\x1b[0m ${formatArgs(args)}`),
  debug: (...args) => console.debug(`\x1b[90m[debug]\x1b[0m ${formatArgs(args)}`),
  log: (...args) => console.log(formatArgs(args))
}

export { log }
