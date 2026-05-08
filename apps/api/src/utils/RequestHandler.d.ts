import e from 'express'

export type RequestHandler<T, F = unknown> = {
  body: T
  file?: F
  files?: F[]
  req: e.Request
  res: e.Response
}
