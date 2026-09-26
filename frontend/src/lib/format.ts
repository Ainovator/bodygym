export const number = (value: number, digits = 0) =>
  new Intl.NumberFormat('ru-RU', { maximumFractionDigits: digits }).format(value)
export const kcal = (value: number) => `≈ ${number(Math.round(value / 10) * 10)}`
export const dateLabel = (
  value: string,
  options: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'long' },
) =>
  new Date(value.length === 10 ? `${value}T12:00:00` : value).toLocaleDateString('ru-RU', options)
export function duration(seconds: number, full = false) {
  const value = Math.max(0, Math.floor(seconds))
  const h = Math.floor(value / 3600)
  const m = Math.floor(value / 60) % 60
  const s = value % 60
  return full
    ? `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
    : h
      ? `${h} ч ${m} мин`
      : `${m} мин`
}
export function monthRange(month: string) {
  const [year, m] = month.split('-').map(Number)
  const end = new Date(Date.UTC(year, m, 0)).toISOString().slice(0, 10)
  return `from=${month}-01&to=${end}`
}
export const currentMonth = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}
