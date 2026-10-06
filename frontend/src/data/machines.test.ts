import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { machineBrands, machineCategories, machineGroups, machines } from './machines'

interface ImageSource {
  id: string
  image: string
  model: string
  brand: string
  sourceUrl: string
  imageUrl: string
  retrievedAt: string
  bytes: number
  width: number
  height: number
  sha256: string
}

const sources: ImageSource[] = JSON.parse(readFileSync(new URL('../../../docs/equipment-sources.json', import.meta.url), 'utf8'))

describe('equipment catalog integrity', () => {
  it('keeps distinct, searchable models with valid categories and muscle groups', () => {
    expect(machines.length).toBe(236)
    expect(machineBrands).toEqual(['Concept2', 'Hammer Strength', 'ICG', 'Life Fitness', 'Matrix', 'SCIFIT'])
    expect(new Set(machines.map(m => m.id)).size).toBe(machines.length)
    expect(new Set(machines.map(m => `${m.brand}:${m.model}`)).size).toBe(machines.length)
    for (const m of machines) {
      expect(m.id).toMatch(/^[a-z0-9-]+$/)
      expect(machineCategories).toContain(m.category)
      expect(m.groups.length).toBeGreaterThan(0)
      expect(m.groups.every(g => machineGroups.includes(g))).toBe(true)
      expect(m.muscles.length).toBeGreaterThan(0)
      expect(m.name.length).toBeGreaterThan(3)
      expect(m.description.length).toBeGreaterThan(20)
      expect(m.recognition.length).toBeGreaterThan(20)
    }
  })

  it('ships a unique local photo and auditable manufacturer source for every model', () => {
    expect(sources.length).toBe(machines.length)
    expect(new Set(sources.map(s => s.id)).size).toBe(machines.length)
    expect(new Set(sources.map(s => s.sha256)).size).toBe(machines.length)
    for (const m of machines) {
      const source = sources.find(s => s.id === m.id)!
      expect(source, m.id).toBeDefined()
      expect([source.model, source.brand, source.image, source.sourceUrl]).toEqual([m.model, m.brand, m.image, m.sourceUrl])
      expect(new URL(source.imageUrl).protocol).toBe('https:')
      expect(['shop.lifefitness.com', 'www.lifefitness.com.au', 'cpo.matrixfitness.com', 'www.concept2.com']).toContain(new URL(m.sourceUrl).hostname)
      expect(source.retrievedAt).toMatch(/^\d{4}-\d{2}-\d{2}$/)
      expect(Math.min(source.width, source.height)).toBeGreaterThanOrEqual(200)
      expect(m.image).toMatch(new RegExp(`^/equipment/${m.id}-v\\d+\\.webp$`))
      const buffer = readFileSync(new URL(`../../public${m.image}`, import.meta.url))
      expect(buffer.subarray(8, 12).toString()).toBe('WEBP')
      expect(buffer.length).toBe(source.bytes)
      expect(createHash('sha256').update(buffer).digest('hex')).toBe(source.sha256)
    }
  })
})
