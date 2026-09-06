/**
 * Comparación de heads de Automerge, en módulo aparte y sin dependencias para
 * poder testearla sin arrastrar Prisma ni el cliente de Drive.
 */
export function headsMatch(current: string[], stored: string[] | null | undefined): boolean {
  // Sin heads guardadas no se puede afirmar que lo local ya esté subido, así
  // que se asume que sí hay algo pendiente: es el lado seguro.
  if (!stored || stored.length !== current.length || current.length === 0) return false

  const a = [...current].sort()
  const b = [...stored].sort()
  return a.every((head, index) => head === b[index])
}
