import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import {
  Activity,
  ArrowUpRight,
  CalendarDays,
  Check,
  Clock3,
  Dumbbell,
  Flame,
  Scale,
  Trophy,
} from 'lucide-react'
import { useSearchParams } from 'react-router-dom'
import {
  useBodyWeights,
  useExercises,
  useExerciseStats,
  useOverview,
  useProfile,
} from '../hooks/queries'
import { Chart } from '../components/Charts'
import { Empty, ErrorState, Loading, PageHeader } from '../components/UI'
import { currentMonth, dateLabel, duration, kcal, monthRange, number } from '../lib/format'
import { send } from '../lib/api'
import { queryClient } from '../lib/query'
import { parseInput } from '../lib/input'

function ExerciseProgress({ id }: { id: string }) {
  const query = useExerciseStats(id)
  if (!id) return null
  if (query.isPending) return <Loading />
  if (query.isError && !query.data)
    return <ErrorState error={query.error} retry={() => void query.refetch()} />
  const stats = query.data!
  if (!stats.series.length)
    return (
      <Empty title="Здесь начнётся ваш прогресс">
        <p>Завершите тренировку с этим упражнением, чтобы увидеть график.</p>
      </Empty>
    )
  const series = (key: 'max_weight' | 'estimated_1rm' | 'volume') =>
    stats.series.map((p) => ({
      label: dateLabel(p.date, { day: 'numeric', month: 'short' }),
      value: p[key],
    }))
  return (
    <>
      <div className="exercise-records">
        <div>
          <span>
            <Trophy size={17} />
            Максимальный вес
          </span>
          <strong>
            {number(stats.max_weight, 1)} <small>кг</small>
          </strong>
        </div>
        <div>
          <span>Расчётный 1RM</span>
          <strong>
            {stats.estimated_1rm ? `≈ ${number(stats.estimated_1rm, 1)}` : '—'} <small>кг</small>
          </strong>
        </div>
        <div>
          <span>К предыдущему максимуму</span>
          <strong className="accent-text">
            {stats.monthly_weight_change > 0 ? '+' : ''}
            {number(stats.monthly_weight_change, 1)} <small>кг в этом месяце</small>
          </strong>
        </div>
      </div>
      <div className="charts-grid three-charts">
        <section className="card chart-card">
          <h3>Рабочий вес</h3>
          <p className="muted">Максимальный вес за день · кг</p>
          <Chart data={series('max_weight')} unit="кг" />
        </section>
        <section className="card chart-card">
          <h3>Расчётный 1RM</h3>
          <p className="muted">Приблизительный максимум · кг</p>
          <Chart data={series('estimated_1rm')} unit="кг" color="var(--chart-blue)" />
        </section>
        <section className="card chart-card">
          <h3>Объём упражнения</h3>
          <p className="muted">Вес × повторы за день · кг</p>
          <Chart data={series('volume')} unit="кг" bars color="var(--chart-gold)" />
        </section>
      </div>
      <p className="fine-print">{stats.estimate_note}</p>
      <details className="data-details">
        <summary>Лучшие повторы на каждом весе</summary>
        <div className="past-set-chips">
          {stats.best_reps_at_weight.map((record) => (
            <span key={record.weight_kg}>
              {number(record.weight_kg, 1)} кг × {record.reps}
            </span>
          ))}
        </div>
      </details>
    </>
  )
}
export default function Progress() {
  const [month, setMonth] = useState(currentMonth)
  const overview = useOverview(monthRange(month))
  const weights = useBodyWeights()
  const exercises = useExercises()
  const profile = useProfile()
  const [params, setParams] = useSearchParams()
  const exerciseId =
    params.get('exercise') ??
    exercises.data?.find((e) => e.slug === 'barbell-bench-press')?.id ??
    ''
  const [weight, setWeight] = useState('')
  const [weightDate, setWeightDate] = useState('')
  const saveWeight = useMutation({
    mutationFn: () => {
      const value = parseInput(weight, 20, 500)
      if (value === null) throw new Error('Укажите массу тела от 20 до 500 кг')
      return send('/body-weight', 'POST', {
        weight_kg: value,
        ...(weightDate ? { measured_at: new Date(`${weightDate}T12:00:00`).toISOString() } : {}),
      })
    },
    onSuccess: () => {
      setWeight('')
      void queryClient.invalidateQueries({ queryKey: ['body-weights'] })
      void queryClient.invalidateQueries({ queryKey: ['profile'] })
    },
  })
  const weekData = (key: 'training_count' | 'total_volume' | 'estimated_calories') =>
    overview.data?.weeks.map((p) => ({
      label: dateLabel(p.date, { day: 'numeric', month: 'short' }),
      value: p[key],
    })) ?? []
  return (
    <>
      <PageHeader eyebrow="Посмотрите, как далеко вы продвинулись" title="Прогресс">
        <label className="month-picker">
          <CalendarDays size={18} />
          <span className="sr-only">Месяц статистики</span>
          <input
            aria-label="Месяц статистики"
            type="month"
            value={month}
            onChange={(e) => {
              if (e.target.value) setMonth(e.target.value)
            }}
          />
        </label>
      </PageHeader>
      {overview.isPending ? (
        <Loading />
      ) : overview.isError && !overview.data ? (
        <ErrorState error={overview.error} retry={() => void overview.refetch()} />
      ) : (
        overview.data && (
          <>
            <div className="overview-metrics">
              <div className="card metric featured">
                <Activity size={20} />
                <strong>{overview.data.training_count}</strong>
                <span>Тренировок</span>
              </div>
              <div className="card metric">
                <Clock3 size={20} />
                <strong>{duration(overview.data.training_duration)}</strong>
                <span>Общее время</span>
              </div>
              <div className="card metric">
                <Dumbbell size={20} />
                <strong>{overview.data.set_count}</strong>
                <span>Рабочих подходов</span>
              </div>
              <div className="card metric">
                <ArrowUpRight size={20} />
                <strong>
                  {number(overview.data.total_volume)} <small>кг</small>
                </strong>
                <span>Общий объём</span>
              </div>
              <div className="card metric">
                <Flame size={20} />
                <strong>{kcal(overview.data.estimated_calories)}</strong>
                <span>Ккал · оценка</span>
              </div>
            </div>
            {overview.data.training_count ? (
              <div className="charts-grid three-charts">
                <section className="card chart-card">
                  <h3>Регулярность</h3>
                  <p className="muted">Тренировок по неделям</p>
                  <Chart data={weekData('training_count')} unit="трен." bars />
                </section>
                <section className="card chart-card">
                  <h3>Суммарный объём</h3>
                  <p className="muted">Килограммов по неделям</p>
                  <Chart data={weekData('total_volume')} unit="кг" />
                </section>
                <section className="card chart-card">
                  <h3>Расход энергии</h3>
                  <p className="muted">Приблизительно · ккал по неделям</p>
                  <Chart
                    data={weekData('estimated_calories')}
                    unit="ккал"
                    bars
                    color="var(--chart-gold)"
                  />
                </section>
              </div>
            ) : (
              <Empty title="Новый месяц — новые возможности">
                <p>В выбранном месяце пока нет завершённых тренировок.</p>
              </Empty>
            )}
            <p className="fine-print">
              Калории рассчитаны по MET с учётом отдыха и массы тела. Ориентировочный диапазон за
              период: {number(Math.round(overview.data.calories_low / 10) * 10)}–
              {number(Math.round(overview.data.calories_high / 10) * 10)} ккал. Дни и недели
              статистики сгруппированы по UTC.
            </p>
          </>
        )
      )}
      <section className="progress-section">
        <header className="section-heading">
          <div>
            <p className="eyebrow">СИЛА В ДЕТАЛЯХ</p>
            <h2>Прогресс упражнения</h2>
          </div>
          <select
            aria-label="Упражнение для статистики"
            value={exerciseId}
            onChange={(e) => setParams({ exercise: e.target.value })}
          >
            {exercises.data?.map((ex) => (
              <option key={ex.id} value={ex.id}>
                {ex.name}
              </option>
            ))}
          </select>
        </header>
        {exercises.isError ? (
          <ErrorState error={exercises.error} retry={() => void exercises.refetch()} />
        ) : (
          <ExerciseProgress id={exerciseId} />
        )}
      </section>
      <section className="progress-section">
        <header className="section-heading">
          <div>
            <p className="eyebrow">ЕЩЁ ОДИН ОРИЕНТИР</p>
            <h2>Масса тела</h2>
          </div>
          <Scale size={24} className="muted" />
        </header>
        <div className="body-weight-grid">
          <section className="card chart-card">
            <div className="section-heading">
              <div>
                <strong className="body-weight-number">
                  {number(profile.data?.weight_kg ?? 0, 1)}
                  <small> кг</small>
                </strong>
                <p className="muted">Последнее измерение</p>
              </div>
              <span className="subtle-tag">Вся история</span>
            </div>
            {weights.isPending ? (
              <Loading />
            ) : weights.isError && !weights.data ? (
              <ErrorState error={weights.error} retry={() => void weights.refetch()} />
            ) : !weights.data?.length ? (
              <Empty title="Добавьте первое измерение" />
            ) : (
              <Chart
                data={weights.data.map((w) => ({
                  label: dateLabel(w.measured_at, { day: 'numeric', month: 'short' }),
                  value: w.weight_kg,
                }))}
                unit="кг"
                color="var(--chart-blue)"
              />
            )}
          </section>
          <form
            className="card form-card weight-form"
            onSubmit={(e) => {
              e.preventDefault()
              saveWeight.mutate()
            }}
          >
            <h3>Новая отметка</h3>
            <p className="muted">
              Используется для оценки расхода энергии в следующих тренировках.
            </p>
            <label>
              Вес, кг
              <input
                aria-label="Масса тела, кг"
                value={weight}
                onChange={(e) => setWeight(e.target.value)}
                inputMode="decimal"
                placeholder={String(profile.data?.weight_kg ?? '86.4')}
                required
              />
            </label>
            <label>
              Дата <span className="muted">· сегодня по умолчанию</span>
              <input
                type="date"
                value={weightDate}
                max={new Date().toLocaleDateString('en-CA')}
                onChange={(e) => setWeightDate(e.target.value)}
              />
            </label>
            {saveWeight.isError && <ErrorState error={saveWeight.error} />}
            {saveWeight.isSuccess && (
              <span className="success-message">
                <Check size={16} />
                Измерение сохранено
              </span>
            )}
            <button className="button" disabled={saveWeight.isPending}>
              {saveWeight.isPending ? 'Сохраняем…' : 'Сохранить вес'}
              <PlusIcon />
            </button>
          </form>
        </div>
      </section>
    </>
  )
}
function PlusIcon() {
  return <span aria-hidden="true">+</span>
}
