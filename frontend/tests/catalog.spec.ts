import { test, expect } from '@playwright/test'
import type { Exercise } from '../src/types'

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
  await page.getByRole('link', { name: /Тренажёры 10/ }).click()
  await expect(page.locator('.catalog-card')).toHaveCount(10)
  for (const img of await page.locator('.machine-photo img').all()) {
    await img.scrollIntoViewIfNeeded()
    await expect.poll(() => img.evaluate((el: HTMLImageElement) => el.complete && el.naturalWidth > 0)).toBeTruthy()
  }
  await page.getByRole('combobox', { name: 'Группа мышц' }).selectOption('Ноги')
  await expect(page.locator('.catalog-card')).toHaveCount(3)
  await page.getByRole('searchbox', { name: 'Поиск тренажёров' }).fill('разгибание')
  await expect(page.locator('.catalog-card')).toHaveCount(1)
  await page.locator('.catalog-card').click()
  await expect(page.getByRole('heading', { name: 'Разгибание ног', exact: true })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Страница производителя' })).toHaveAttribute('href', 'https://shop.lifefitness.com/products/insignia-series-leg-extension')
  await page.getByRole('link', { name: 'Назад', exact: true }).click()
  await expect(page.getByRole('combobox', { name: 'Группа мышц' })).toHaveValue('Ноги')
  await expect(page.getByRole('searchbox', { name: 'Поиск тренажёров' })).toHaveValue('разгибание')
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
  await page.getByRole('link', { name: /Тренажёры 10/ }).click()
  await page.reload()
  await expect(page.locator('.catalog-card')).toHaveCount(10)
  await expect.poll(() => page.locator('.machine-photo img').first().evaluate((el: HTMLImageElement) => el.complete && el.naturalWidth > 0)).toBeTruthy()
  await context.setOffline(false)
})
