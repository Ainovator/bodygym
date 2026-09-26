export function parseInput(raw: string, min: number, max: number, integer = false): number | null {
  if (!raw.trim() || !/^\d+(?:[.,]\d{1,2})?$/.test(raw)) return null
  const value = Number(raw.replace(',', '.'))
  return Number.isFinite(value) &&
    value >= min &&
    value <= max &&
    (!integer || Number.isInteger(value))
    ? value
    : null
}
