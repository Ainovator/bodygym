import { useEffect, useRef } from 'react'
import { SkipForward, Timer } from 'lucide-react'
import { useClock } from '../hooks/useClock'
export function RestTimer({
  deadline,
  onChange,
}: {
  deadline: number
  onChange: (value: number) => void
}) {
  const now = useClock()
  const remaining = Math.max(0, Math.ceil((deadline - now) / 1000))
  const notified = useRef(false)
  useEffect(() => {
    if (remaining === 0 && !notified.current) {
      notified.current = true
      navigator.vibrate?.([150, 80, 150])
    }
  }, [remaining])
  return (
    <div
      className={`rest-timer ${remaining === 0 ? 'rest-done' : ''}`}
      role="timer"
      aria-label="Таймер отдыха"
    >
      <div className="rest-label">
        <Timer size={22} />
        <span>
          {remaining ? 'Время выдохнуть' : 'Готовы к следующему?'}
          <small>{remaining ? 'Отдых между подходами' : 'Время отдыха закончилось'}</small>
        </span>
      </div>
      <strong>
        {String(Math.floor(remaining / 60)).padStart(2, '0')}:
        {String(remaining % 60).padStart(2, '0')}
      </strong>
      <button
        onClick={() => {
          notified.current = false
          onChange(Math.max(deadline, Date.now()) + 30000)
        }}
      >
        +30 с
      </button>
      <button aria-label="Пропустить отдых" onClick={() => onChange(0)}>
        <SkipForward size={20} />
        <span className="skip-label">Пропустить</span>
      </button>
    </div>
  )
}
