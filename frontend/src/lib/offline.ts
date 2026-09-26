import { useSyncExternalStore } from 'react'
import { APIError, send } from './api'
import { queryClient } from './query'
import type { Session, SetPatch, WorkoutSet } from '../types'

interface Pending {
  sessionId: string
  patch: SetPatch
  revision: number
  error?: string
}
type Queue = Record<string, Pending>
type Drafts = Record<string, Record<string, string>>
function load<T>(key: string, fallback: T): T {
  try {
    return (JSON.parse(localStorage.getItem(key) ?? 'null') as T) ?? fallback
  } catch {
    return fallback
  }
}
let queue = load<Queue>('feetwork-pending-v1', {})
let drafts = load<Drafts>('feetwork-drafts-v1', {})
let edited = load<Record<string, boolean>>('feetwork-edited-v1', {})
let running: Promise<void> | undefined
let timer: ReturnType<typeof setTimeout> | undefined
let storageError = ''
const listeners = new Set<() => void>()
let snapshot = { queue, drafts, online: navigator.onLine, storageError }
function emit() {
  snapshot = { queue, drafts, online: navigator.onLine, storageError }
  listeners.forEach((fn) => fn())
}
function persist() {
  try {
    localStorage.setItem('feetwork-pending-v1', JSON.stringify(queue))
    localStorage.setItem('feetwork-drafts-v1', JSON.stringify(drafts))
    localStorage.setItem('feetwork-edited-v1', JSON.stringify(edited))
    storageError = ''
  } catch {
    storageError = 'Хранилище устройства заполнено. Не закрывайте приложение до синхронизации.'
  }
  emit()
}
export const useSyncState = () =>
  useSyncExternalStore(
    (fn) => {
      listeners.add(fn)
      return () => {
        listeners.delete(fn)
      }
    },
    () => snapshot,
  )
export function overlay(session: Session): Session {
  return {
    ...session,
    exercises: session.exercises.map((ex) => ({
      ...ex,
      sets: ex.sets.map((set) => ({ ...set, ...(queue[set.id]?.patch ?? {}) })),
    })),
  }
}
export function queueSet(sessionId: string, id: string, patch: SetPatch) {
  queue = {
    ...queue,
    [id]: {
      sessionId,
      patch: { ...queue[id]?.patch, ...patch },
      revision: (queue[id]?.revision ?? 0) + 1,
    },
  }
  // Persist before attempting the request. A reload never discards pending input.
  persist()
  queryClient.setQueryData<Session>(['workout', sessionId], (old) => (old ? overlay(old) : old))
  clearTimeout(timer)
  timer = setTimeout(() => {
    void flushQueue()
  }, 450)
}
export function setDraft(id: string, key: string, value: string | null) {
  const fields = { ...drafts[id] }
  if (value === null) delete fields[key]
  else fields[key] = value
  drafts = { ...drafts, [id]: fields }
  if (!Object.keys(fields).length) delete drafts[id]
  persist()
}
export function markSetEdited(id: string) {
  edited = { ...edited, [id]: true }
  persist()
}
export function wasSetEdited(id: string) {
  return edited[id] === true
}
export function clearSetLocal(id: string) {
  queue = { ...queue }
  drafts = { ...drafts }
  edited = { ...edited }
  delete queue[id]
  delete drafts[id]
  delete edited[id]
  persist()
}
export async function flushQueue(): Promise<void> {
  if (running) return running
  running = (async () => {
    while (navigator.onLine) {
      const next = Object.entries(queue).find(([, item]) => !item.error)
      if (!next) break
      const [id, item] = next
      try {
        const saved = await send<WorkoutSet>(`/sets/${id}`, 'PATCH', item.patch)
        if (queue[id]?.revision === item.revision) {
          queue = { ...queue }
          delete queue[id]
          persist()
          queryClient.setQueryData<Session>(['workout', item.sessionId], (old) =>
            old
              ? {
                  ...old,
                  exercises: old.exercises.map((ex) => ({
                    ...ex,
                    sets: ex.sets.map((set) => (set.id === id ? saved : set)),
                  })),
                }
              : old,
          )
        }
      } catch (error) {
        if (error instanceof APIError && error.status >= 400 && error.status < 500) {
          if (queue[id]?.revision === item.revision) {
            queue = { ...queue, [id]: { ...item, error: error.message } }
            persist()
          }
        }
        break
      }
    }
  })().finally(() => {
    running = undefined
    emit()
  })
  return running
}
export function pendingFor(sessionId: string) {
  return Object.values(queue).filter((item) => item.sessionId === sessionId)
}
export function retrySync() {
  queue = Object.fromEntries(
    Object.entries(queue).map(([id, item]) => [id, { ...item, error: undefined }]),
  )
  persist()
  void flushQueue()
}
window.addEventListener('online', () => {
  emit()
  void flushQueue()
})
window.addEventListener('offline', emit)
setInterval(() => {
  if (Object.keys(queue).length) void flushQueue()
}, 15000)
void flushQueue()
