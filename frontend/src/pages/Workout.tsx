import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { ArrowLeft, ArrowUpRight, Check, CheckCircle2 as CloudCheck, Plus } from 'lucide-react'
import { Link, useParams } from 'react-router-dom'
import { usePrevious, useWorkout } from '../hooks/queries'
import { useClock } from '../hooks/useClock'
import { send } from '../lib/api'
import { queryClient } from '../lib/query'
import {
  clearSetLocal,
  flushQueue,
  overlay,
  pendingFor,
  queueSet,
  useSyncState,
  wasSetEdited,
} from '../lib/offline'
import { dateLabel, duration } from '../lib/format'
import { ErrorState, ExerciseImage, Loading, Modal } from '../components/UI'
import { SetRow } from '../components/SetRow'
import { parseInput } from '../lib/input'
import { RestTimer } from '../components/RestTimer'
import { WorkoutSummary } from '../components/WorkoutSummary'
import type { Session, SessionExercise, WorkoutSet } from '../types'

function ActiveExercise({
  exercise,
  sessionId,
  onRest,
}: {
  exercise: SessionExercise
  sessionId: string
  onRest: (seconds: number) => void
}) {
  const previous = usePrevious(exercise.exercise_id)
  const sync = useSyncState()
  const [selected, setSelected] = useState<string | null>(null)
  const focused =
    selected && exercise.sets.some((s) => s.id === selected)
      ? selected
      : (exercise.sets.find((s) => !s.completed)?.id ?? exercise.sets.at(-1)?.id)
  const [removeId, setRemoveId] = useState<string | null>(null)
  const add = useMutation({
    mutationFn: async () => {
      await flushQueue()
      if (pendingFor(sessionId).length) throw new Error('Сначала дождитесь сохранения подходов')
      const key = `feetwork-add:${exercise.id}`
      const id = localStorage.getItem(key) ?? crypto.randomUUID()
      localStorage.setItem(key, id)
      return send<WorkoutSet>(`/session-exercises/${exercise.id}/sets`, 'POST', { id })
    },
    onSuccess: (set) => {
      localStorage.removeItem(`feetwork-add:${exercise.id}`)
      queryClient.setQueryData<Session>(['workout', sessionId], (old) =>
        old
          ? {
              ...old,
              exercises: old.exercises.map((ex) =>
                ex.id === exercise.id
                  ? { ...ex, sets: [...ex.sets.filter((s) => s.id !== set.id), set] }
                  : ex,
              ),
            }
          : old,
      )
      setSelected(set.id)
    },
  })
  const remove = useMutation({
    mutationFn: (id: string) => send(`/sets/${id}`, 'DELETE'),
    onSuccess: (_, id) => {
      clearSetLocal(id)
      queryClient.setQueryData<Session>(['workout', sessionId], (old) =>
        old
          ? {
              ...old,
              exercises: old.exercises.map((ex) => ({
                ...ex,
                sets: ex.sets.filter((s) => s.id !== id),
              })),
            }
          : old,
      )
      setRemoveId(null)
    },
  })
  function complete(set: WorkoutSet) {
    const completed = !set.completed
    queueSet(sessionId, set.id, { completed })
    if (completed) {
      onRest(exercise.rest_seconds)
      const next = exercise.sets.find((s) => s.set_number > set.set_number && !s.completed)
      if (next) {
        // Do not overwrite a next set the user has already edited.
        if (!sync.drafts[next.id] && !sync.queue[next.id] && !wasSetEdited(next.id))
          queueSet(sessionId, next.id, { weight_kg: set.weight_kg, reps: set.reps })
        setSelected(next.id)
      }
    } else setSelected(set.id)
  }
  const done = exercise.sets.filter((s) => s.completed).length
  return (
    <section className="card active-exercise">
      <header className="active-exercise-header">
        <ExerciseImage exercise={exercise.exercise} />
        <div>
          <Link to={`/exercises/${exercise.exercise_id}`}>
            <h2>
              {exercise.exercise.name}
              <ArrowUpRight size={16} />
            </h2>
          </Link>
          <p>
            {exercise.target_reps_min}–{exercise.target_reps_max} повторений{' '}
            <span className="dot">·</span> отдых {exercise.rest_seconds} с
          </p>
        </div>
        <span
          className={`completion-badge ${done === exercise.sets.length && done > 0 ? 'all-done' : ''}`}
        >
          {done === exercise.sets.length && done > 0 ? (
            <Check size={16} />
          ) : (
            `${done}/${exercise.sets.length}`
          )}
        </span>
      </header>
      <div className="previous-caption">
        {previous.data?.date
          ? `Предыдущая тренировка · ${dateLabel(previous.data.date)}`
          : 'Первая тренировка этого упражнения'}
      </div>
      <div className="set-table-head">
        <span>№</span>
        <span>Прошлый</span>
        <span>Вес, кг</span>
        <span>Повторы</span>
        <Check size={17} />
      </div>
      {exercise.sets.map((set) => (
        <SetRow
          key={set.id}
          set={set}
          previous={previous.data?.sets.find((s) => s.set_number === set.set_number)}
          sessionId={sessionId}
          active={focused === set.id}
          onFocus={() => setSelected(set.id)}
          onComplete={() => complete(set)}
          onDelete={() => setRemoveId(set.id)}
          disabledDelete={!sync.online || Object.keys(sync.queue).length > 0 || remove.isPending}
        />
      ))}
      <button
        className="add-set-button"
        onClick={() => add.mutate()}
        disabled={!sync.online || add.isPending || exercise.sets.length >= 30}
      >
        <Plus size={17} />
        {add.isPending ? 'Добавляем…' : 'Добавить подход'}
      </button>
      {add.isError && <ErrorState error={add.error} />}
      {removeId && (
        <Modal title="Удалить подход?" onClose={() => setRemoveId(null)}>
          <p>Запись этого подхода будет удалена из текущей тренировки.</p>
          {remove.isError && <ErrorState error={remove.error} />}
          <div className="modal-actions">
            <button className="button secondary" onClick={() => setRemoveId(null)}>
              Отмена
            </button>
            <button
              className="button danger"
              disabled={remove.isPending}
              onClick={() => remove.mutate(removeId)}
            >
              Удалить
            </button>
          </div>
        </Modal>
      )}
    </section>
  )
}
function ActiveWorkout({ session }: { session: Session }) {
  const now = useClock()
  const sync = useSyncState()
  const [confirm, setConfirm] = useState(false)
  const [notes, setNotes] = useState(
    () => localStorage.getItem(`feetwork-notes:${session.id}`) ?? session.notes,
  )
  const [deadline, setDeadline] = useState(() =>
    Number(localStorage.getItem(`feetwork-rest:${session.id}`) ?? 0),
  )
  function rest(value: number) {
    setDeadline(value)
    localStorage.setItem(`feetwork-rest:${session.id}`, String(value))
  }
  const sets = session.exercises.flatMap((e) => e.sets)
  const done = sets.filter((s) => s.completed).length
  const invalidDrafts = sets.some((set) =>
    Object.entries(sync.drafts[set.id] ?? {}).some(([key, raw]) => {
      if ((key === 'rir' || key === 'rpe') && raw === '') return false
      return (
        parseInput(
          raw,
          key === 'reps' || key === 'rpe' ? 1 : 0,
          key === 'weight_kg' ? 1000 : key === 'reps' ? 100 : 10,
          key === 'reps',
        ) === null
      )
    }),
  )
  const finish = useMutation({
    mutationFn: async () => {
      if (!navigator.onLine)
        throw new Error('Для завершения подключитесь к сети. Все подходы сохранены на устройстве.')
      if (invalidDrafts)
        throw new Error('Исправьте незаполненные или некорректные значения подходов.')
      await flushQueue()
      if (pendingFor(session.id).length)
        throw new Error('Ещё есть несохранённые подходы. Дождитесь синхронизации и повторите.')
      await send(`/workouts/${session.id}`, 'PATCH', { notes })
      return send<Session>(`/workouts/${session.id}/finish`, 'POST')
    },
    onSuccess: (saved) => {
      sets.forEach((set) => clearSetLocal(set.id))
      queryClient.setQueryData(['workout', session.id], saved)
      queryClient.setQueryData(['active'], null)
      localStorage.removeItem(`feetwork-rest:${session.id}`)
      localStorage.removeItem(`feetwork-notes:${session.id}`)
      for (const key of ['history', 'overview', 'previous', 'exercise-stats'])
        void queryClient.invalidateQueries({ queryKey: [key] })
    },
  })
  return (
    <>
      <header className="workout-sticky">
        <div>
          <Link to="/" className="back-link">
            <ArrowLeft size={15} />
            Сегодня
          </Link>
          <h1>{session.name}</h1>
          <div className="live-clock">
            <span className="status-dot" />
            {duration((now - Date.parse(session.started_at)) / 1000, true)}
            <span className="muted">
              {done} / {sets.length} подходов
            </span>
          </div>
        </div>
        <button className="button" onClick={() => setConfirm(true)}>
          Завершить
          <Check size={18} />
        </button>
      </header>
      <div className="workout-progress-track">
        <span style={{ width: `${sets.length ? (done / sets.length) * 100 : 0}%` }} />
      </div>
      <div className="workout-layout">
        <div className="workout-exercises">
          {session.exercises.map((exercise) => (
            <ActiveExercise
              key={exercise.id}
              exercise={exercise}
              sessionId={session.id}
              onRest={(seconds) => rest(seconds ? Date.now() + seconds * 1000 : 0)}
            />
          ))}
          <section className="card form-card">
            <label>
              Заметки о тренировке
              <textarea
                value={notes}
                onChange={(e) => {
                  setNotes(e.target.value)
                  localStorage.setItem(`feetwork-notes:${session.id}`, e.target.value)
                }}
                placeholder="Как самочувствие? Что получилось особенно хорошо?"
                rows={3}
                maxLength={4000}
              />
            </label>
            <small className="muted">
              Сохраняются на устройстве; отправятся вместе с завершением тренировки.
            </small>
          </section>
        </div>
        <aside className="workout-aside">
          <div className="card session-status">
            <span className="eyebrow">ШАГ ЗА ШАГОМ</span>
            <strong>
              {done}
              <small> / {sets.length}</small>
            </strong>
            <p>подходов выполнено</p>
            <div className="status-message">
              <CloudCheck size={19} />
              {pendingFor(session.id).length ? 'Синхронизация…' : 'Все подходы сохранены'}
            </div>
          </div>
          <div className="quiet-note">
            <p>
              Не спешите.
              <br />
              <span>Качество важнее количества.</span>
            </p>
          </div>
        </aside>
      </div>
      {deadline > 0 && <RestTimer deadline={deadline} onChange={rest} />}
      {confirm && (
        <Modal
          title="Завершить тренировку?"
          onClose={() => {
            if (!finish.isPending) setConfirm(false)
          }}
        >
          <p>
            Выполнено{' '}
            <strong>
              {done} из {sets.length}
            </strong>{' '}
            подходов.
            {done < sets.length
              ? ' Незавершённые подходы останутся в истории, но не попадут в статистику.'
              : ' Всё готово — пора отдохнуть.'}
          </p>
          {invalidDrafts && (
            <p className="field-error">Проверьте поля подходов: есть некорректные значения.</p>
          )}
          {finish.isError && <ErrorState error={finish.error} />}
          <div className="modal-actions">
            <button
              className="button secondary"
              disabled={finish.isPending}
              onClick={() => setConfirm(false)}
            >
              Продолжить
            </button>
            <button
              className="button"
              disabled={finish.isPending || invalidDrafts}
              onClick={() => finish.mutate()}
            >
              {finish.isPending ? 'Сохраняем…' : 'Завершить тренировку'}
            </button>
          </div>
        </Modal>
      )}
    </>
  )
}
export function Workout() {
  const { id = '' } = useParams()
  const query = useWorkout(id)
  useSyncState()
  if (query.isPending) return <Loading label="Подготавливаем тренировку…" />
  if (query.isError && !query.data)
    return <ErrorState error={query.error} retry={() => void query.refetch()} />
  if (!query.data) return null
  const session = overlay(query.data)
  return session.finished_at ? (
    <WorkoutSummary session={session} />
  ) : (
    <ActiveWorkout key={session.id} session={session} />
  )
}
