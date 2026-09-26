import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
const { sendMock, setData } = vi.hoisted(() => ({ sendMock: vi.fn(), setData: vi.fn() }))
vi.mock('./api', () => ({
  send: sendMock,
  APIError: class extends Error {
    constructor(
      message: string,
      public status: number,
    ) {
      super(message)
    }
  },
}))
vi.mock('./query', () => ({ queryClient: { setQueryData: setData } }))
beforeEach(() => {
  vi.resetModules()
  vi.useFakeTimers()
  sendMock.mockReset()
  setData.mockReset()
  const values = new Map<string, string>()
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
  })
  vi.stubGlobal('window', new EventTarget())
  vi.stubGlobal('navigator', { onLine: true })
})
afterEach(() => {
  vi.clearAllTimers()
  vi.useRealTimers()
  vi.unstubAllGlobals()
})
describe('durable workout mutations', () => {
  it('retains a newer edit made while the previous request is in flight', async () => {
    const queue = await import('./offline')
    await queue.flushQueue()
    let release!: (value: object) => void
    sendMock
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            release = resolve
          }),
      )
      .mockResolvedValueOnce({ id: 'set', weight_kg: 85 })
    queue.queueSet('session', 'set', { weight_kg: 80 })
    const flushing = queue.flushQueue()
    queue.queueSet('session', 'set', { weight_kg: 85, reps: 10 })
    release({ id: 'set', weight_kg: 80 })
    await flushing
    expect(sendMock).toHaveBeenCalledTimes(2)
    expect(sendMock.mock.calls[1][2]).toEqual({ weight_kg: 85, reps: 10 })
    expect(queue.pendingFor('session')).toHaveLength(0)
  })
  it('restores offline edits and incomplete input after an application reload', async () => {
    vi.stubGlobal('navigator', { onLine: false })
    let queue = await import('./offline')
    queue.queueSet('session', 'set', { weight_kg: 82.5 })
    queue.setDraft('set', 'reps', '')
    expect(JSON.parse(localStorage.getItem('feetwork-drafts-v1')!)).toEqual({ set: { reps: '' } })
    vi.resetModules()
    queue = await import('./offline')
    expect(queue.pendingFor('session')[0].patch.weight_kg).toBe(82.5)
    expect(sendMock).not.toHaveBeenCalled()
  })
  it('retains failed network requests until reconnection', async () => {
    const queue = await import('./offline')
    await queue.flushQueue()
    sendMock.mockRejectedValueOnce(new TypeError('Failed to fetch'))
    queue.queueSet('session', 'set', { reps: 12 })
    await queue.flushQueue()
    expect(queue.pendingFor('session')).toHaveLength(1)
    sendMock.mockResolvedValueOnce({ id: 'set', reps: 12 })
    await queue.flushQueue()
    expect(queue.pendingFor('session')).toHaveLength(0)
  })
})
