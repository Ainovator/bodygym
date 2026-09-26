import { test, expect } from '@playwright/test'
import { mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'
const runId = Date.now().toString(36)
const cleanupFile = resolve('../artifacts/e2e-created.json')
function track(type: 'sessions' | 'templates' | 'weights', id: string) {
  mkdirSync(resolve('../artifacts'), { recursive: true })
  const data = existsSync(cleanupFile)
    ? JSON.parse(readFileSync(cleanupFile, 'utf8'))
    : { sessions: [], templates: [], weights: [] }
  data[type].push(id)
  writeFileSync(cleanupFile, JSON.stringify(data))
}
test('desktop and mobile navigation, real charts, themes, and no horizontal overflow', async ({
  page,
}) => {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Сегодня', exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Начать тренировку' })).toBeVisible()
  await expect(page.locator('.exercise-row')).toHaveCount(6)
  await page.screenshot({ path: '../artifacts/today-desktop.png', fullPage: true })
  await page.getByRole('link', { name: 'Прогресс', exact: true }).filter({ visible: true }).click()
  await expect(page.locator('.recharts-surface').first()).toBeVisible()
  await page.screenshot({ path: '../artifacts/progress-desktop.png', fullPage: true })
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/')
  await expect(page.locator('.bottom-nav')).toBeVisible()
  await page.screenshot({ path: '../artifacts/today-mobile.png', fullPage: true })
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy()
  await page.getByRole('button', { name: 'Переключить тему' }).click()
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
  expect(await page.evaluate(() => getComputedStyle(document.body).color)).toBe('rgb(237, 243, 236)')
  await page.screenshot({ path: '../artifacts/today-dark-mobile.png', fullPage: true })
  await page.locator('.exercise-row').first().click()
  await expect(page.getByRole('heading', { name: 'Техника выполнения' })).toBeVisible()
  expect(errors).toEqual([])
})
test('template editor creates, reorders, updates and deletes a program', async ({
  page,
  request,
}) => {
  await page.goto('/programs/new')
  await page.getByLabel('Название', { exact: true }).fill(`E2E editor ${runId}`)
  await page.getByLabel('Описание', { exact: true }).fill('Проверка программы')
  await page.getByRole('button', { name: 'Добавить', exact: true }).click()
  await page.getByLabel('Поиск упражнения').fill('жим штанги')
  await page.locator('.picker-item').first().click()
  await page.getByRole('button', { name: 'Добавить', exact: true }).click()
  await page.getByLabel('Поиск упражнения').fill('hammer')
  await page.locator('.picker-item').first().click()
  await page.getByRole('button', { name: 'Переместить вверх' }).nth(1).click()
  const saved = page.waitForResponse(
    (r) => r.url().endsWith('/workout-templates') && r.request().method() === 'POST',
  )
  await page.getByRole('button', { name: 'Сохранить программу' }).click()
  const response = await saved
  expect(response.status()).toBe(201)
  const program = await response.json()
  track('templates', program.id)
  expect(program.exercises[0].exercise.slug).toBe('hammer-curl')
  await page.goto(`/programs/${program.id}/edit`)
  await expect(page.getByLabel('Название', { exact: true })).toHaveValue(`E2E editor ${runId}`)
  await page.getByLabel('Название', { exact: true }).fill(`E2E updated ${runId}`)
  await page.getByRole('button', { name: 'Сохранить программу' }).click()
  await expect(page.getByRole('heading', { name: `E2E updated ${runId}` })).toBeVisible()
  await page.getByRole('button', { name: `Удалить E2E updated ${runId}` }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Удалить программу' }).click()
  await expect(page.getByRole('heading', { name: `E2E updated ${runId}` })).toHaveCount(0)
  expect((await request.get(`/api/v1/workout-templates/${program.id}`)).status()).toBe(404)
})
test('mobile workout survives offline reload, syncs, finishes and appears in history', async ({
  page,
  context,
  request,
}) => {
  const catalog = await (await request.get('/api/v1/exercises')).json()
  const ex = catalog.find((e: { slug: string }) => e.slug === 'barbell-bench-press')
  const template = await (
    await request.post('/api/v1/workout-templates', {
      data: {
        name: `E2E workout ${runId}`,
        description: 'Offline journey',
        exercises: [
          {
            exercise_id: ex.id,
            target_sets: 3,
            target_reps_min: 8,
            target_reps_max: 12,
            rest_seconds: 90,
          },
        ],
      },
    })
  ).json()
  track('templates', template.id)
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/')
  await page.getByLabel('Выбрать программу').selectOption(template.id)
  const starting = page.waitForResponse((r) => r.url().endsWith('/workouts/start'))
  await page.getByRole('button', { name: 'Начать тренировку' }).click()
  const session = await (await starting).json()
  track('sessions', session.id)
  await expect(page.getByRole('heading', { name: template.name })).toBeVisible()
  await page.getByLabel('Вес, кг, подход 1', { exact: true }).fill('82,5')
  await page.getByLabel('Повторы, подход 1', { exact: true }).fill('10')
  await page.getByRole('checkbox', { name: 'Отметить подход 1', exact: true }).click()
  await expect(page.getByRole('timer')).toBeVisible()
  await expect(page.getByLabel('Вес, кг, подход 2', { exact: true })).toHaveValue('82.5')
  await page.getByRole('button', { name: '+30 с', exact: true }).click()
  await page.screenshot({ path: '../artifacts/workout-mobile.png', fullPage: true })
  await expect
    .poll(
      async () =>
        Object.keys(
          JSON.parse(
            await page.evaluate(() => localStorage.getItem('feetwork-pending-v1') ?? '{}'),
          ),
        ).length,
    )
    .toBe(0)
  await page.evaluate(() => navigator.serviceWorker.ready)
  await page.waitForFunction(() => !!navigator.serviceWorker.controller)
  await expect
    .poll(async () =>
      JSON.parse(
        await page.evaluate(() => localStorage.getItem('feetwork-query-v1') ?? '{}'),
      ).clientState?.queries?.some((q: { queryKey: string[] }) => q.queryKey[0] === 'workout'),
    )
    .toBeTruthy()
  await context.setOffline(true)
  await page.getByLabel('Вес, кг, подход 2', { exact: true }).fill('85')
  await page.getByLabel('Повторы, подход 2', { exact: true }).fill('')
  await page.reload()
  await expect(page.getByLabel('Вес, кг, подход 2', { exact: true })).toHaveValue('85')
  await expect(page.getByLabel('Повторы, подход 2', { exact: true })).toHaveValue('')
  await expect(page.getByRole('timer')).toBeVisible()
  await page.getByLabel('Вес, кг, подход 3', { exact: true }).fill('90')
  await page.getByLabel('Повторы, подход 2', { exact: true }).focus()
  await page.getByRole('button', { name: 'Дополнительно' }).click()
  await page.getByLabel('RIR, подход 2', { exact: true }).fill('2')
  await page.getByLabel('RPE, подход 2', { exact: true }).fill('8')
  await page.getByLabel('Повторы, подход 2', { exact: true }).fill('8')
  await page.getByRole('checkbox', { name: 'Отметить подход 2', exact: true }).click()
  await expect(page.getByLabel('Вес, кг, подход 3', { exact: true })).toHaveValue('90')
  await context.setOffline(false)
  await expect
    .poll(
      async () =>
        (await (await request.get(`/api/v1/workouts/${session.id}`)).json()).exercises[0].sets[1]
          .weight_kg,
    )
    .toBe(85)
  await expect
    .poll(
      async () =>
        (await (await request.get(`/api/v1/workouts/${session.id}`)).json()).exercises[0].sets[1]
          .completed,
    )
    .toBe(true)
  await page.getByRole('button', { name: 'Добавить подход' }).click()
  await expect(page.getByRole('checkbox')).toHaveCount(4)
  await page.getByRole('button', { name: 'Удалить подход 4' }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Удалить', exact: true }).click()
  await expect(page.getByRole('checkbox')).toHaveCount(3)
  await page.getByLabel('Заметки о тренировке').fill('E2E: техника под контролем')
  await page.getByRole('button', { name: 'Завершить', exact: true }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Завершить тренировку' }).click()
  await expect(page.getByRole('heading', { name: 'Тренировка завершена' })).toBeVisible()
  const finished = await (await request.get(`/api/v1/workouts/${session.id}`)).json()
  expect(finished.summary.set_count).toBe(2)
  expect(finished.summary.total_volume).toBe(1505)
  expect(finished.exercises[0].sets[1].rir).toBe(2)
  expect(finished.exercises[0].sets[1].rpe).toBe(8)
  expect(finished.notes).toBe('E2E: техника под контролем')
  await page.goto('/history')
  await expect(page.getByRole('heading', { name: template.name })).toBeVisible()
  await request.delete(`/api/v1/workout-templates/${template.id}`)
})
test('API validation, previous results, stats and backdated body weight', async ({ request }) => {
  expect((await request.get('/api/v1/history?page=-1')).status()).toBe(422)
  expect((await request.get('/api/v1/exercises/bad')).status()).toBe(422)
  expect(
    (
      await request.post('/api/v1/workout-templates', { data: { name: '', exercises: [] } })
    ).status(),
  ).toBe(422)
  const catalog = await (await request.get('/api/v1/exercises')).json()
  expect(catalog.length).toBeGreaterThanOrEqual(20)
  for (const ex of catalog) {
    expect(ex.instructions.length).toBeGreaterThanOrEqual(3)
    expect(ex.common_mistakes.length).toBeGreaterThan(0)
  }
  const ex = catalog.find((e: { slug: string }) => e.slug === 'barbell-bench-press')
  const previous = await (await request.get(`/api/v1/exercises/${ex.id}/previous`)).json()
  expect(previous.sets.length).toBeGreaterThan(0)
  const stats = await (await request.get(`/api/v1/stats/exercises/${ex.id}`)).json()
  expect(stats.series.length).toBeGreaterThan(0)
  expect(stats.estimated_1rm).toBeGreaterThan(0)
  const profile = await (await request.get('/api/v1/me')).json()
  const entry = await request.post('/api/v1/body-weight', {
    data: { weight_kg: 86.45, measured_at: '2001-01-01T12:00:00Z' },
  })
  expect(entry.status()).toBe(201)
  track('weights', (await entry.json()).id)
  expect((await (await request.get('/api/v1/me')).json()).weight_kg).toBe(profile.weight_kg)
  expect((await request.post('/api/v1/body-weight', { data: { weight_kg: 1 } })).status()).toBe(422)
  const head = await request.get('/')
  expect(head.headers()['content-security-policy']).toContain("frame-ancestors 'none'")
})
