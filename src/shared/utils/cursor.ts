export type Cursor = {
  date: Date
  id: string
}

type CursorPayload = {
  date: string
  id: string
}

export function encodeCursor(cursor: Cursor): string {
  const payload: CursorPayload = {
    date: cursor.date.toISOString(),
    id: cursor.id,
  }

  return Buffer.from(JSON.stringify(payload), 'utf-8').toString('base64')
}

export function decodeCursor(cursor: string): Cursor {
  try {
    const decoded = Buffer.from(cursor, 'base64').toString('utf-8')
    const payload = JSON.parse(decoded) as Partial<CursorPayload>

    if (typeof payload.date !== 'string' || typeof payload.id !== 'string') {
      throw new Error()
    }

    const date = new Date(payload.date)

    if (Number.isNaN(date.getTime())) {
      throw new Error()
    }

    return { date, id: payload.id }
  } catch {
    throw new Error(`Invalid cursor: "${cursor}"`)
  }
}
