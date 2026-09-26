import { Clock3, Dumbbell, Info } from 'lucide-react'
import { Link, useParams } from 'react-router-dom'
import { useExercises, usePrevious } from '../hooks/queries'
import { dateLabel, number } from '../lib/format'
import { Empty, ErrorState, ExerciseImage, Loading, PageHeader } from '../components/UI'
export function ExerciseDetail() {
  const { id = '' } = useParams()
  const query = useExercises()
  const previous = usePrevious(id)
  const exercise = query.data?.find((e) => e.id === id)
  if (query.isPending) return <Loading />
  if (query.isError && !query.data)
    return <ErrorState error={query.error} retry={() => void query.refetch()} />
  if (!exercise) return <Empty title="Упражнение не найдено" />
  return (
    <>
      <PageHeader
        back="/"
        eyebrow={`${exercise.category} · ${exercise.equipment}`}
        title={exercise.name}
      />
      <div className="detail-grid">
        <div>
          <section className="card exercise-visual">
            <ExerciseImage exercise={exercise} large />
            <span>
              {exercise.media.some((media) =>
                media.url.endsWith('/anatomy/barbell-bench-press-v1.webp'),
              )
                ? 'Грудные мышцы выделены красным'
                : 'Схематичная иллюстрация · не инструкция движения'}
            </span>
          </section>
          <div className="detail-badges">
            <span>
              <Clock3 size={18} />
              Отдых {exercise.default_rest_seconds} с
            </span>
            <span>
              <Dumbbell size={18} />
              Обычно 8–12 повторений
            </span>
          </div>
          <p className="muted">Диапазон повторений задаётся в программе под вашу задачу.</p>
          <section className="card muscle-card">
            <h2>Мышцы в работе</h2>
            <p className="eyebrow">ОСНОВНЫЕ</p>
            <div className="muscle-tags">
              {exercise.primary_muscles.map((m) => (
                <span key={m}>{m}</span>
              ))}
            </div>
            <p className="eyebrow">ДОПОЛНИТЕЛЬНЫЕ</p>
            <div className="muscle-tags secondary-tags">
              {exercise.secondary_muscles.map((m) => (
                <span key={m}>{m}</span>
              ))}
            </div>
          </section>
        </div>
        <div className="detail-copy">
          <p className="description">{exercise.description}</p>
          <section className="card technique">
            <h2>Техника выполнения</h2>
            <ol>
              {exercise.instructions.map((step, i) => (
                <li key={step}>
                  <span>{String(i + 1).padStart(2, '0')}</span>
                  <p>{step}</p>
                </li>
              ))}
            </ol>
          </section>
          <section className="card mistakes">
            <h2>На что обратить внимание</h2>
            <ul>
              {exercise.common_mistakes.map((m) => (
                <li key={m}>{m}</li>
              ))}
            </ul>
          </section>
          <p className="fine-print">
            <Info size={16} />
            Выбирайте комфортную амплитуду и контролируемый вес. Описание не заменяет персональную
            оценку техники.
          </p>
          {previous.data?.date && (
            <section className="card previous-detail">
              <div className="section-heading">
                <h2>В прошлый раз</h2>
                <span className="muted">{dateLabel(previous.data.date)}</span>
              </div>
              <div className="past-set-chips">
                {previous.data.sets.map((s) => (
                  <span key={s.id}>
                    {number(s.weight_kg, 1)} кг × {s.reps}
                  </span>
                ))}
              </div>
              <Link className="text-link" to={`/progress?exercise=${id}`}>
                Посмотреть прогресс ↗
              </Link>
            </section>
          )}
        </div>
      </div>
    </>
  )
}
