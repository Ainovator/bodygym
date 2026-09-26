import { ArrowRight, Check, Clock3, Dumbbell, Flame, Trophy } from 'lucide-react'
import { Link } from 'react-router-dom'
import { dateLabel, duration, kcal, number } from '../lib/format'
import type { Session } from '../types'
import { ExerciseImage, PageHeader } from './UI'
const recordLabels: Record<string, string> = {
  max_weight: 'Максимальный вес',
  estimated_1rm: 'Расчётный 1RM',
  reps_at_weight: 'Повторы на весе',
}
export function WorkoutSummary({ session }: { session: Session }) {
  const summary = session.summary
  return (
    <>
      <PageHeader
        back="/history"
        eyebrow={dateLabel(session.started_at, { day: 'numeric', month: 'long', year: 'numeric' })}
        title="Тренировка завершена"
      />
      <section className="finish-hero">
        <span className="finish-check">
          <Check size={31} />
        </span>
        <div>
          <p className="eyebrow">ЕЩЁ ОДИН ШАГ ВПЕРЁД</p>
          <h2>{session.name}</h2>
          <p>Хорошая работа. Теперь — восстановление.</p>
        </div>
      </section>
      <div className="summary-grid">
        <div className="card metric">
          <Clock3 size={20} />
          <strong>{duration(summary.training_duration, true)}</strong>
          <span>Время тренировки</span>
        </div>
        <div className="card metric">
          <Dumbbell size={20} />
          <strong>{summary.set_count}</strong>
          <span>Рабочих подходов</span>
        </div>
        <div className="card metric">
          <span className="metric-symbol">↗</span>
          <strong>
            {number(summary.total_volume)} <small>кг</small>
          </strong>
          <span>Общий объём</span>
        </div>
        <div className="card metric">
          <Flame size={20} />
          <strong>
            {kcal(summary.estimated_calories)} <small>ккал</small>
          </strong>
          <span>Оценка расхода энергии</span>
        </div>
      </div>
      <p className="fine-print">
        Ориентировочный диапазон: {number(Math.round(summary.calories_low / 10) * 10)}–
        {number(Math.round(summary.calories_high / 10) * 10)} ккал. Это модельная оценка, а не
        измерение.
      </p>
      {session.personal_records.length > 0 && (
        <section className="card records-card">
          <header className="section-heading">
            <h2>
              <Trophy size={21} />
              Новые рекорды
            </h2>
            <span className="count-badge">{session.personal_records.length}</span>
          </header>
          {session.personal_records.map((record, i) => (
            <div className="record-row" key={i}>
              <div>
                <strong>{record.exercise_name}</strong>
                <small>
                  {recordLabels[record.kind]}
                  {record.weight_kg ? ` · ${number(record.weight_kg, 1)} кг` : ''}
                </small>
              </div>
              <span>
                {number(record.value, 1)} {record.kind === 'reps_at_weight' ? 'повт.' : 'кг'}
                <small>
                  {record.previous ? `было ${number(record.previous, 1)}` : 'Первая отметка'}
                </small>
              </span>
            </div>
          ))}
          <p className="fine-print">
            Расчётный 1RM приблизителен: Epley для 1–15 повторений, погрешность выше после 10.
          </p>
        </section>
      )}
      <section className="card summary-exercises">
        <header className="section-heading">
          <h2>Выполненные упражнения</h2>
        </header>
        {session.exercises.map((ex) => {
          const sets = ex.sets.filter((s) => s.completed)
          return (
            <div className="summary-exercise" key={ex.id}>
              <ExerciseImage exercise={ex.exercise} />
              <div>
                <Link to={`/exercises/${ex.exercise_id}`}>
                  <h3>{ex.exercise.name}</h3>
                </Link>
                <div className="past-set-chips">
                  {sets.map((set) => (
                    <span key={set.id}>
                      {number(set.weight_kg, 1)} × {set.reps}
                      {set.rir !== null ? ` · RIR ${set.rir}` : ''}
                      {set.rpe !== null ? ` · RPE ${set.rpe}` : ''}
                    </span>
                  ))}
                  {!sets.length && <span className="muted">Без завершённых подходов</span>}
                </div>
              </div>
            </div>
          )
        })}
      </section>
      {session.notes && (
        <section className="card notes-display">
          <h2>Заметки</h2>
          <p>{session.notes}</p>
        </section>
      )}
      <div className="finish-actions">
        <Link className="button secondary" to="/">
          На сегодня всё
        </Link>
        <Link className="button" to="/progress">
          Посмотреть прогресс
          <ArrowRight size={17} />
        </Link>
      </div>
    </>
  )
}
