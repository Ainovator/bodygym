import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import {
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  CalendarDays,
  Check,
  Clock3,
  Dumbbell,
  Flame,
  Play,
  Sparkles,
  TrendingUp,
} from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import { useActive, useHistory, useOverview, useProfile, useTemplates } from '../hooks/queries'
import { send } from '../lib/api'
import { queryClient } from '../lib/query'
import { currentMonth, dateLabel, duration, kcal, monthRange, number } from '../lib/format'
import { Empty, ErrorState, Loading, PageHeader } from '../components/UI'
import { ExerciseRow } from '../components/ExerciseRow'
import type { Session } from '../types'

export function Today() {
  const templates = useTemplates()
  const active = useActive()
  const profile = useProfile()
  const overview = useOverview(monthRange(currentMonth()))
  const history = useHistory('limit=100')
  const [choice, setChoice] = useState(() => localStorage.getItem('feetwork-template') ?? '')
  const navigate = useNavigate()
  const program = templates.data?.find((item) => item.id === choice) ?? templates.data?.[0]
  const start = useMutation({
    mutationFn: (id: string) => send<Session>('/workouts/start', 'POST', { template_id: id }),
    onSuccess: (session) => {
      queryClient.setQueryData(['workout', session.id], session)
      queryClient.setQueryData(['active'], session)
      navigate(`/workouts/${session.id}`)
    },
  })
  const today = new Date()
  const monday = new Date(today)
  monday.setDate(today.getDate() - ((today.getDay() + 6) % 7))
  const days = Array.from({ length: 7 }, (_, i) => {
    const date = new Date(monday)
    date.setDate(monday.getDate() + i)
    return date
  })
  const trainedDays = new Set(
    history.data?.items.map((item) => new Date(item.started_at).toDateString()) ?? [],
  )
  if (templates.isPending) return <Loading />
  if (templates.isError && !templates.data)
    return <ErrorState error={templates.error} retry={() => void templates.refetch()} />
  const totalSets = program?.exercises.reduce((sum, e) => sum + e.target_sets, 0) ?? 0
  const minutes = Math.round(
    (program?.exercises.reduce((sum, e) => sum + e.target_sets * (40 + e.rest_seconds), 0) ?? 0) /
      60 +
      7,
  )
  const last = history.data?.items[0]
  return (
    <>
      <PageHeader
        eyebrow={`С возвращением${profile.data ? `, ${profile.data.name}` : ''}`}
        title="Сегодня"
      >
        <span className="date-pill">
          <CalendarDays size={16} />
          {dateLabel(today.toISOString(), { day: 'numeric', month: 'long', year: 'numeric' })}
        </span>
      </PageHeader>
      <div className="week-strip">
        {days.map((date) => {
          const isToday = date.toDateString() === today.toDateString()
          const done = trainedDays.has(date.toDateString())
          return (
            <div
              className={`week-day ${isToday ? 'today' : ''}`}
              key={date.toISOString()}
              aria-current={isToday ? 'date' : undefined}
            >
              <span>{dateLabel(date.toISOString(), { weekday: 'short' })}</span>
              <strong>{date.getDate()}</strong>
              <span className={`day-indicator ${done ? 'done' : ''}`}>
                {done ? <Check size={11} /> : isToday ? <span /> : '·'}
              </span>
            </div>
          )
        })}
        <div className="week-message">
          <span className="mini-icon">
            <TrendingUp size={21} />
          </span>
          <div>
            <strong>Каждый подход имеет значение</strong>
            <p>Ваш темп. Ваш прогресс.</p>
          </div>
        </div>
      </div>
      <div className="today-grid">
        <div className="main-column">
          {program ? (
            <section className="workout-hero">
              <div className="hero-copy">
                <span className="hero-label">
                  <span className="status-dot" />{' '}
                  {active.data ? 'ТРЕНИРОВКА В ПРОЦЕССЕ' : 'ВАША СЛЕДУЮЩАЯ ТРЕНИРОВКА'}
                </span>
                <h2>{active.data?.name ?? program.name}</h2>
                <p>{program.description}</p>
                <div className="hero-meta">
                  <span>
                    <Dumbbell size={16} />
                    {program.exercises.length} упражнений
                  </span>
                  <span>
                    <Clock3 size={16} />~{minutes} мин
                  </span>
                  <span>{totalSets} подходов</span>
                </div>
                <button
                  className="button hero-button"
                  disabled={start.isPending}
                  onClick={() =>
                    active.data ? navigate(`/workouts/${active.data.id}`) : start.mutate(program.id)
                  }
                >
                  <Play size={17} fill="currentColor" />
                  {start.isPending
                    ? 'Подготавливаем…'
                    : active.data
                      ? 'Продолжить тренировку'
                      : 'Начать тренировку'}
                  <ArrowRight size={18} />
                </button>
              </div>
              <div className="hero-art" aria-hidden="true">
                <div className="orbit orbit-one" />
                <div className="orbit orbit-two" />
                <Dumbbell />
                <span className="hero-art-label">ONE MORE REP.</span>
                <span className="art-cross">+</span>
              </div>
            </section>
          ) : (
            <Empty title="Создайте свою первую программу">
              <Link className="button" to="/programs/new">
                Создать программу
              </Link>
            </Empty>
          )}
          {start.isError && <ErrorState error={start.error} />}
          <section className="card exercise-list">
            <header className="section-heading">
              <div>
                <h2>
                  План тренировки{' '}
                  <span className="count-badge">{program?.exercises.length ?? 0}</span>
                </h2>
                <p className="muted">Сосредоточьтесь на движении. Мы запомним остальное.</p>
              </div>
              {templates.data && templates.data.length > 1 && (
                <label className="select-label">
                  <span className="sr-only">Выбрать программу</span>
                  <select
                    value={program?.id ?? ''}
                    onChange={(e) => {
                      setChoice(e.target.value)
                      localStorage.setItem('feetwork-template', e.target.value)
                    }}
                  >
                    {templates.data.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
                  </select>
                </label>
              )}
            </header>
            {program?.exercises.map((item, i) => (
              <ExerciseRow key={item.id} item={item} index={i} />
            ))}
            <div className="card-foot">
              <Sparkles size={16} />
              <span>Коснитесь упражнения, чтобы посмотреть технику</span>
            </div>
          </section>
        </div>
        <aside className="right-column">
          <section className="card month-card">
            <header className="section-heading">
              <h2>Ваш месяц</h2>
              <span className="subtle-tag">
                {dateLabel(today.toISOString(), { month: 'short' }).replace('.', '')}
              </span>
            </header>
            {overview.data ? (
              <>
                <div className="month-number">
                  {overview.data.training_count}
                  <span>тренировок</span>
                  <span className="stat-icon">
                    <TrendingUp size={21} />
                  </span>
                </div>
                <div className="mini-bars" aria-label="Объём по неделям">
                  {overview.data.weeks.map((week) => (
                    <div key={week.date}>
                      <span
                        style={{
                          height: `${Math.max(5, (week.total_volume / Math.max(...overview.data!.weeks.map((w) => w.total_volume), 1)) * 72)}px`,
                        }}
                      />
                      <small>{dateLabel(week.date, { day: 'numeric', month: 'numeric' })}</small>
                    </div>
                  ))}
                </div>
                <div className="stat-line">
                  <span>
                    <Clock3 size={16} />
                    Время в движении
                  </span>
                  <strong>{duration(overview.data.training_duration)}</strong>
                </div>
                <div className="stat-line">
                  <span>
                    <Dumbbell size={16} />
                    Общий объём
                  </span>
                  <strong>
                    {number(overview.data.total_volume)} <small>кг</small>
                  </strong>
                </div>
                <div className="stat-line">
                  <span>
                    <Flame size={16} />
                    Энергия
                  </span>
                  <strong>
                    {kcal(overview.data.estimated_calories)} <small>ккал</small>
                  </strong>
                </div>
              </>
            ) : overview.isError ? (
              <p className="muted">Статистика временно недоступна</p>
            ) : (
              <Loading />
            )}
            <Link className="text-link" to="/progress">
              Весь прогресс <ArrowUpRight size={17} />
            </Link>
          </section>
          {last && (
            <Link to={`/workouts/${last.id}`} className="card last-workout">
              <div className="section-heading">
                <span className="eyebrow">ПОСЛЕДНЯЯ ТРЕНИРОВКА</span>
                <ArrowUpRight size={19} />
              </div>
              <h3>{last.name}</h3>
              <p className="muted">{dateLabel(last.started_at)}</p>
              <div className="last-stats">
                <span>
                  {last.set_count}
                  <small>подходов</small>
                </span>
                <span>
                  {number(last.total_volume)}
                  <small>кг объёма</small>
                </span>
              </div>
            </Link>
          )}
          <div className="quiet-note">
            <ArrowDownRight size={25} />
            <p>
              Сильнее, чем вчера.
              <br />
              <span>И это уже хороший план.</span>
            </p>
          </div>
        </aside>
      </div>
    </>
  )
}
