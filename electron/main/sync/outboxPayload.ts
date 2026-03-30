export function serializeOutboxPayload(payload: unknown): string {
  return JSON.stringify(payload, (_key, value) => {
    if (typeof value !== 'bigint') return value

    const asNumber = Number(value)
    return Number.isSafeInteger(asNumber) ? asNumber : value.toString()
  })
}
