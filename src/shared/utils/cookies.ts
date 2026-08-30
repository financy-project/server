type SerializeCookieOptions = {
  httpOnly?: boolean
  secure?: boolean
  sameSite?: 'lax' | 'strict' | 'none'
  path?: string
  maxAgeSeconds?: number
}

export function parseCookies(
  header: string | undefined,
): Record<string, string> {
  if (!header) {
    return {}
  }

  return header
    .split(';')
    .map((pair) => pair.trim())
    .filter(Boolean)
    .reduce<Record<string, string>>((acc, pair) => {
      const eqIndex = pair.indexOf('=')
      if (eqIndex === -1) return acc

      const key = pair.slice(0, eqIndex).trim()
      const value = pair.slice(eqIndex + 1).trim()

      if (key) {
        acc[key] = value
      }

      return acc
    }, {})
}

export function serializeCookie(
  name: string,
  value: string,
  options: SerializeCookieOptions,
): string {
  const parts: string[] = [`${name}=${value}`]

  if (options.httpOnly === true) {
    parts.push('HttpOnly')
  }

  if (options.secure === true) {
    parts.push('Secure')
  }

  if (options.sameSite !== undefined) {
    parts.push(`SameSite=${options.sameSite}`)
  }

  if (options.path !== undefined) {
    parts.push(`Path=${options.path}`)
  }

  if (options.maxAgeSeconds !== undefined) {
    parts.push(`Max-Age=${options.maxAgeSeconds}`)
  }

  return parts.join('; ')
}
