import { useState } from 'react'
import {
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  CalendarDays,
  Clock3,
  Dumbbell,
  Flame,
} from 'lucide-react'
import { Link } from 'react-router-dom'
import { useHistory } from '../hooks/queries'
import { dateLabel, duration, kcal, number } from '../lib/format'
import { Empty, ErrorState, Loading, PageHeader } from '../components/UI'
export function History() {
  const [page, setPage] = useState(1)
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const query = useHistory(
    `page=${page}&limit=9${from ? `&from=${from}` : ''}${to ? `&to=${to}` : ''}`,
  )
  return (
    <>
      <PageHeader eyebrow="Каждая тренировка — часть пути" title="История">
        <span className="date-pill">
          <CalendarDays size={17} />
          {query.data?.total ?? '—'} тренировок
        </span>
      </PageHeader>
      <div className="history-filters">
        <label>
          С
          <input
            type="date"
            aria-label="С даты"
            value={from}
            max={to || undefined}
            onChange={(e) => {
              setFrom(e.target.value)
              setPage(1)
            }}
          />
        </label>
        <span>—</span>
        <label>
          По
          <input
            type="date"
            aria-label="По дату"
            value={to}
            min={from || undefined}
            onChange={(e) => {
              setTo(e.target.value)
              setPage(1)
            }}
          />
        </label>
        {(from || to) && (
          <button
            className="text-link"
            onClick={() => {
              setFrom('')
              setTo('')
              setPage(1)
            }}
          >
            Сбросить
          </button>
        )}
      </div>
      {query.isPending ? (
        <Loading />
      ) : query.isError && !query.data ? (
        <ErrorState error={query.error} retry={() => void query.refetch()} />
      ) : !query.data?.items.length ? (
        <Empty title="В этом периоде пока тихо">
          <p>Ваши завершённые тренировки появятся здесь.</p>
          <Link className="button" to="/">
            Начать движение
          </Link>
        </Empty>
      ) : (
        <>
          <div className="history-grid">
            {query.data.items.map((session, i) => (
              <Link className="card history-card" key={session.id} to={`/workouts/${session.id}`}>
                <div className="section-heading">
                  <span className={`history-icon color-${i % 3}`}>
                    <Dumbbell size={23} />
                  </span>
                  <ArrowUpRight size={20} />
                </div>
                <p className="eyebrow">
                  {dateLabel(session.started_at, {
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric',
                  })}
                </p>
                <h2>{session.name}</h2>
                <div className="history-time">
                  <Clock3 size={16} />
                  {duration(session.training_duration)}
                  <span>·</span>
                  {session.set_count} подходов
                </div>
                <div className="history-bottom">
                  <strong>
                    {number(session.total_volume)} <small>кг</small>
                  </strong>
                  <span>
                    <Flame size={15} />
                    {kcal(session.estimated_calories)} ккал
                  </span>
                </div>
              </Link>
            ))}
          </div>
          <div className="pagination">
            <button
              className="button secondary small"
              disabled={page === 1}
              onClick={() => setPage(page - 1)}
            >
              <ArrowLeft size={17} />
              Назад
            </button>
            <span>
              {page} / {Math.ceil(query.data.total / 9)}
            </span>
            <button
              className="button secondary small"
              disabled={page * 9 >= query.data.total}
              onClick={() => setPage(page + 1)}
            >
              Далее
              <ArrowRight size={17} />
            </button>
          </div>
        </>
      )}
    </>
  )
}
