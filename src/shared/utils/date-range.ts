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
