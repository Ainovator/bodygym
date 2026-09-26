import { ArrowUpRight } from 'lucide-react'
import { Link } from 'react-router-dom'
import { usePrevious } from '../hooks/queries'
import { number } from '../lib/format'
import type { TemplateExercise } from '../types'
import { ExerciseImage } from './UI'
export function ExerciseRow({ item, index }: { item: TemplateExercise; index: number }) {
  const previous = usePrevious(item.exercise_id)
  const last = previous.data?.sets[0]
  return (
    <Link to={`/exercises/${item.exercise_id}`} className="exercise-row">
      <span className="row-index">{String(index + 1).padStart(2, '0')}</span>
      <ExerciseImage exercise={item.exercise} />
      <div className="exercise-row-name">
        <h3>{item.exercise.name}</h3>
        <span className="muted">
          {item.exercise.equipment} <span className="dot">·</span> {item.exercise.category}
        </span>
      </div>
      <div className="exercise-row-plan">
        <strong>
          {item.target_sets} × {item.target_reps_min}–{item.target_reps_max}
        </strong>
        <span className="muted">
          {last ? `Было: ${number(last.weight_kg, 1)} × ${last.reps}` : 'Первая запись впереди'}
        </span>
      </div>
      <ArrowUpRight className="row-arrow" size={19} />
    </Link>
  )
}
