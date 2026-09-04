export function getMonthRange(
  year: number,
  month: number,
): { startDate: Date; endDate: Date } {
  const startDate = new Date(year, month - 1, 1, 0, 0, 0, 0)
  const endDate = new Date(year, month, 0, 23, 59, 59, 999)

  return { startDate, endDate }
}

export function getCurrentMonthRange(): { startDate: Date; endDate: Date } {
  const now = new Date()

  const startDate = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0)
  const endDate = new Date(
    now.getFullYear(),
    now.getMonth() + 1,
    0,
    23,
    59,
    59,
    999,
  )

  return { startDate, endDate }
}
