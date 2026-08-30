const SUFFIX_TO_SECONDS: Record<string, number> = {
  s: 1,
  m: 60,
  h: 3600,
  d: 86400,
}

export function parseDurationToSeconds(value: string): number {
  const match = /^(\d+)([smhd])$/.exec(value)

  if (!match) {
    throw new Error(
      `Invalid duration format: "${value}". Expected format: <number><s|m|h|d>`,
    )
  }

  const amount = parseInt(match[1]!, 10)
  const unit = match[2]!
  const multiplier = SUFFIX_TO_SECONDS[unit]!

  return amount * multiplier
}
