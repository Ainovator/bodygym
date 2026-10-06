import catalog from './machines.json'

export interface Machine {
  id: string
  name: string
  brand: string
  model: string
  category: string
  groups: string[]
  muscles: string[]
  description: string
  recognition: string
  exerciseSlugs: string[]
  image: string
  sourceUrl: string
}

export const machines: Machine[] = catalog
export const machineBrands = [...new Set(machines.map(m => m.brand))].sort()
export const machineCategories = ['Силовые', 'Кардио', 'Скамьи и стойки', 'Растяжка']
export const machineGroups = ['Грудь', 'Спина', 'Плечи', 'Руки', 'Ноги', 'Корпус', 'Шея']
