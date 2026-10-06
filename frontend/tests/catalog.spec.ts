import { test, expect } from '@playwright/test'
import { readFileSync } from 'node:fs'
import type { Exercise } from '../src/types'
import type { Machine } from '../src/data/machines'

const machines: Machine[] = JSON.parse(readFileSync(new URL('../src/data/machines.json', import.meta.url), 'utf8'))
const pageSize = 24

test('every exercise has its own available anatomical image', async ({ request }) => {
  const response = await request.get('/api/v1/exercises')
  expect(response.ok()).toBeTruthy()
  const exercises: Exercise[] = await response.json()
  expect(exercises).toHaveLength(24)
  const sources = exercises.map(exercise => {
    const source = exercise.media.find(media => media.type === 'image')?.url
    expect(source).toBe(`/illustrations/anatomy/${exercise.slug}-v1.webp`)
    return source!
  })
  expect(new Set(sources).size).toBe(exercises.length)
  for (const source of sources) {
    const image = await request.get(source)
    expect(image.ok(), source).toBeTruthy()
    expect(image.headers()['content-type']).toContain('image/webp')
    expect((await image.body()).length).toBeGreaterThan(10000)
  }
})

test('catalog search, filters, detail links and manufacturer photos work', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  await page.goto('/catalog')
  await expect(page).toHaveURL(/\/catalog\/exercises$/)
  await expect(page.locator('.catalog-card')).toHaveCount(24)
  await page.getByRole('searchbox', { name: 'Поиск упражнений' }).fill('жим штанги лежа')
  await expect(page.locator('.catalog-card')).toHaveCount(1)
  await page.locator('.catalog-card').click()
  await expect(page.getByRole('heading', { name: 'Жим штанги лёжа', exact: true })).toBeVisible()
  await expect(page.getByText('Основные работающие мышцы выделены красным')).toBeVisible()
  await page.getByRole('link', { name: 'Назад', exact: true }).click()
  await expect(page.getByRole('searchbox', { name: 'Поиск упражнений' })).toHaveValue('жим штанги лежа')
  await page.getByRole('button', { name: 'Сбросить' }).click()
  await page.getByRole('combobox', { name: 'Группа мышц' }).selectOption('плечи')
  await expect(page.locator('.catalog-card')).toHaveCount(3)
  await page.getByRole('searchbox', { name: 'Поиск упражнений' }).fill('несуществующее')
  await expect(page.getByText('Ничего не найдено')).toBeVisible()
  await page.getByRole('link', { name: `Тренажёры ${machines.length}`, exact: true }).click()
  await expect(page.locator('.catalog-card')).toHaveCount(pageSize)
  for (const img of await page.locator('.machine-photo img').all()) {
    await img.scrollIntoViewIfNeeded()
    await expect.poll(() => img.evaluate((el: HTMLImageElement) => el.complete && el.naturalWidth > 0)).toBeTruthy()
  }
  await page.getByRole('combobox', { name: 'Группа мышц' }).selectOption('Ноги')
  await page.getByRole('combobox', { name: 'Производитель' }).selectOption('Life Fitness')
  await page.getByRole('combobox', { name: 'Вид оборудования' }).selectOption('Силовые')
  await page.getByRole('searchbox', { name: 'Поиск тренажёров' }).fill('insignia разгибание ног')
  await expect(page.locator('.catalog-card')).toHaveCount(1)
  await page.locator('.catalog-card').click()
  await expect(page.getByRole('heading', { name: 'Разгибание ног', exact: true })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Страница производителя' })).toHaveAttribute('href', 'https://shop.lifefitness.com/products/insignia-series-leg-extension')
  await page.getByRole('link', { name: 'Назад', exact: true }).click()
  await expect(page.getByRole('combobox', { name: 'Группа мышц' })).toHaveValue('Ноги')
  await expect(page.getByRole('searchbox', { name: 'Поиск тренажёров' })).toHaveValue('insignia разгибание ног')
  await expect(page.getByRole('combobox', { name: 'Производитель' })).toHaveValue('Life Fitness')
  await expect(page.getByRole('combobox', { name: 'Вид оборудования' })).toHaveValue('Силовые')
  expect(errors).toEqual([])
})

test('catalog fits narrow screens and photos remain available offline', async ({ page, context }) => {
  for (const width of [1440, 390, 320]) {
    await page.setViewportSize({ width, height: 900 })
    for (const path of ['/catalog/exercises', '/catalog/machines', '/catalog/machines/life-fitness-adjustable-cable-crossover']) {
      await page.goto(path)
      await expect(page.locator('.catalog-tabs, .machine-detail').first()).toBeVisible()
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${path} at ${width}px`).toBeTruthy()
    }
  }
  await page.goto('/catalog/exercises')
  await expect(page.locator('.catalog-card')).toHaveCount(24)
  await page.evaluate(() => navigator.serviceWorker.ready)
  await page.waitForFunction(() => !!navigator.serviceWorker.controller)
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('feetwork-query-v1') ?? '{}').clientState?.queries?.some((q: { queryKey: string[] }) => q.queryKey[0] === 'exercises'))).toBeTruthy()
  await context.setOffline(true)
  await page.reload()
  await expect(page.locator('.catalog-card')).toHaveCount(24)
  await expect.poll(() => page.locator('.catalog-card img').first().evaluate((el: HTMLImageElement) => el.complete && el.naturalWidth > 0)).toBeTruthy()
  await page.getByRole('link', { name: `Тренажёры ${machines.length}`, exact: true }).click()
  await page.reload()
  await expect(page.locator('.catalog-card')).toHaveCount(pageSize)
  await expect.poll(() => page.locator('.machine-photo img').first().evaluate((el: HTMLImageElement) => el.complete && el.naturalWidth > 0)).toBeTruthy()
  // This brand and detail image have not been opened online in this context.
  await page.getByRole('combobox', { name: 'Производитель' }).selectOption('Concept2')
  await expect(page.locator('.catalog-card')).toHaveCount(3)
  await page.locator('.catalog-card').filter({ hasText: 'SkiErg' }).click()
  await expect(page.getByRole('heading', { name: 'Лыжный эргометр', exact: true })).toBeVisible()
  await expect.poll(() => page.locator('.machine-photo img').evaluate((el: HTMLImageElement) => el.complete && el.naturalWidth > 0)).toBeTruthy()
  await context.setOffline(false)
})

test('machine catalog pagination covers every model and preserves URL state', async ({ page, request }) => {
  test.setTimeout(90000)
  await page.goto('/catalog/machines')
  const pagination = page.getByRole('navigation', { name: 'Страницы каталога' })
  await expect(pagination.getByRole('button', { name: 'Назад' })).toBeDisabled()
  const links: string[] = []
  for (let index = 0; index < Math.ceil(machines.length / pageSize); index++) {
    const cards = page.locator('.catalog-card')
    await expect(cards).toHaveCount(Math.min(pageSize, machines.length - index * pageSize))
    links.push(...await cards.evaluateAll(elements => elements.map(e => e.getAttribute('href')!)))
    if (index + 1 < Math.ceil(machines.length / pageSize)) await pagination.getByRole('button', { name: 'Далее' }).click()
  }
  expect(new Set(links).size).toBe(machines.length)
  expect([...links].sort()).toEqual(machines.map(m => `/catalog/machines/${m.id}`).sort())
  await expect(pagination.getByRole('button', { name: 'Далее' })).toBeDisabled()
  const lastPage = page.url()
  await page.locator('.catalog-card').first().click()
  await page.getByRole('link', { name: 'Назад', exact: true }).click()
  await expect(page).toHaveURL(lastPage)
  await page.getByRole('combobox', { name: 'Производитель' }).selectOption('Matrix')
  await expect(page).not.toHaveURL(/page=/)
  await page.getByRole('combobox', { name: 'Вид оборудования' }).selectOption('Кардио')
  await expect(page.locator('.catalog-card')).toHaveCount(1)
  await expect(page.locator('.catalog-card')).toContainText('Endurance LED Stepper')
  await page.getByRole('combobox', { name: 'Группа мышц' }).selectOption('Грудь')
  await expect(page.getByText('Ничего не найдено')).toBeVisible()
  await page.getByRole('button', { name: 'Сбросить' }).click()
  await expect(page.locator('.catalog-card')).toHaveCount(pageSize)
  for (const badPage of ['NaN', '-2', '1.5']) {
    await page.goto(`/catalog/machines?page=${badPage}`)
    await expect(page.locator('.catalog-card').first()).toHaveAttribute('href', `/catalog/machines/${machines[0].id}`)
  }
  await page.goto('/catalog/machines?page=9999')
  await expect(pagination.getByRole('button', { name: 'Далее' })).toBeDisabled()
  // Every packaged model has a real, independently served image.
  for (const machine of machines) {
    const response = await request.get(machine.image)
    expect(response.ok(), machine.id).toBeTruthy()
    expect(response.headers()['content-type'], machine.id).toContain('image/webp')
    expect((await response.body()).length, machine.id).toBeGreaterThan(2000)
  }
})
