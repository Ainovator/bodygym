import { Check, ChevronDown, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { number } from '../lib/format'
import { markSetEdited, queueSet, setDraft, useSyncState } from '../lib/offline'
import type { SetPatch, WorkoutSet } from '../types'
import { parseInput } from '../lib/input'
export function SetRow({
  set,
  previous,
  sessionId,
  active,
  onFocus,
  onComplete,
  onDelete,
  disabledDelete,
}: {
  set: WorkoutSet
  previous?: WorkoutSet
  sessionId: string
  active: boolean
  onFocus: () => void
  onComplete: () => void
  onDelete: () => void
  disabledDelete: boolean
}) {
  const sync = useSyncState()
  const [advanced, setAdvanced] = useState(false)
  const draft = sync.drafts[set.id] ?? {}
  function field(
    key: 'weight_kg' | 'reps' | 'rir' | 'rpe',
    label: string,
    min: number,
    max: number,
    optional = false,
  ) {
    const value = draft[key] ?? (set[key] === null ? '' : String(set[key]))
    const valid = (optional && value === '') || parseInput(value, min, max, key === 'reps') !== null
    return (
      <label className={`set-input-label ${!valid ? 'invalid' : ''}`}>
        <span className="sr-only">
          {label}, подход {set.set_number}
        </span>
        <input
          aria-label={`${label}, подход ${set.set_number}`}
          inputMode={key === 'reps' ? 'numeric' : 'decimal'}
          value={value}
          placeholder={optional ? '—' : undefined}
          onFocus={onFocus}
          aria-invalid={!valid}
          onChange={(e) => {
            const raw = e.target.value
            markSetEdited(set.id)
            setDraft(set.id, key, raw)
            const parsed = parseInput(raw, min, max, key === 'reps')
            if (parsed !== null || (optional && raw === ''))
              queueSet(sessionId, set.id, { [key]: raw === '' ? null : parsed } as SetPatch)
          }}
          onBlur={() => {
            if (valid) setDraft(set.id, key, null)
          }}
        />
      </label>
    )
  }
  const invalid = Object.entries(draft).some(([key, raw]) => {
    if ((key === 'rir' || key === 'rpe') && !raw) return false
    return (
      parseInput(
        raw,
        key === 'reps' || key === 'rpe' ? 1 : 0,
        key === 'weight_kg' ? 1000 : key === 'reps' ? 100 : 10,
        key === 'reps',
      ) === null
    )
  })
  return (
    <div className={`set-block ${active ? 'focused' : ''} ${set.completed ? 'completed' : ''}`}>
      <div className="set-row">
        <span className="set-number">{set.set_number}</span>
        <span className="previous-set">
          {previous ? `${number(previous.weight_kg, 1)} × ${previous.reps}` : '—'}
        </span>
        {field('weight_kg', 'Вес, кг', 0, 1000)}
        {field('reps', 'Повторы', 1, 100)}
        <button
          className="set-check"
          role="checkbox"
          aria-checked={set.completed}
          aria-label={`Отметить подход ${set.set_number}`}
          disabled={invalid}
          onClick={onComplete}
        >
          <Check size={21} strokeWidth={2.5} />
        </button>
      </div>
      {active && (
        <>
          <div className="weight-steps">
            {[-5, -2.5].map((delta) => (
              <button
                key={delta}
                onClick={() => {
                  markSetEdited(set.id)
                  setDraft(set.id, 'weight_kg', null)
                  queueSet(sessionId, set.id, { weight_kg: Math.max(0, set.weight_kg + delta) })
                }}
              >
                {delta}
              </button>
            ))}
            <span>
              {number(set.weight_kg, 2)} <small>кг</small>
            </span>
            {[2.5, 5].map((delta) => (
              <button
                key={delta}
                onClick={() => {
                  markSetEdited(set.id)
                  setDraft(set.id, 'weight_kg', null)
                  queueSet(sessionId, set.id, { weight_kg: Math.min(1000, set.weight_kg + delta) })
                }}
              >
                +{delta}
              </button>
            ))}
          </div>
          <div className="set-tools">
            <button onClick={() => setAdvanced(!advanced)} aria-expanded={advanced}>
              Дополнительно <ChevronDown size={14} />
            </button>
            <button
              onClick={onDelete}
              disabled={disabledDelete}
              aria-label={`Удалить подход ${set.set_number}`}
            >
              <Trash2 size={14} />
              Убрать
            </button>
          </div>
        </>
      )}
      {active && advanced && (
        <div className="advanced-fields">
          <div>
            <span>RIR · в запасе</span>
            {field('rir', 'RIR', 0, 10, true)}
          </div>
          <div>
            <span>RPE · усилие</span>
            {field('rpe', 'RPE', 1, 10, true)}
          </div>
          <p>Необязательно. RIR 0–10, RPE 1–10.</p>
        </div>
      )}
      {invalid && (
        <p className="field-error">
          Проверьте значение: вес 0–1000, повторы 1–100, RIR 0–10, RPE 1–10.
        </p>
      )}
      {sync.queue[set.id]?.error && (
        <p className="field-error">
          {sync.queue[set.id].error} — исправьте значение и повторите сохранение.
        </p>
      )}
    </div>
  )
}
