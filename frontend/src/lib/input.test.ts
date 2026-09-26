import { describe, expect, it } from 'vitest'
import { parseInput } from './input'
describe('numeric workout input', () => {
  it('accepts comma decimals without turning an unfinished input into zero', () => {
    expect(parseInput('82,5', 0, 1000)).toBe(82.5)
    expect(parseInput('82.5', 0, 1000)).toBe(82.5)
    expect(parseInput('', 0, 1000)).toBeNull()
    expect(parseInput('82,', 0, 1000)).toBeNull()
    expect(parseInput('0', 0, 1000)).toBe(0)
  })
  it('enforces ranges and whole repetitions', () => {
    for (const value of ['-1', '1001', 'Infinity', '1e3', '1.123'])
      expect(parseInput(value, 0, 1000)).toBeNull()
    expect(parseInput('2.5', 1, 100, true)).toBeNull()
    expect(parseInput('100', 1, 100, true)).toBe(100)
  })
})
