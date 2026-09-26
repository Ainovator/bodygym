import { ArrowRight, Dumbbell, ExternalLink, Search, X } from 'lucide-react'
import { Link, NavLink, useLocation, useParams, useSearchParams } from 'react-router-dom'
import { useState } from 'react'
import { Empty, ErrorState, ExerciseImage, Loading, PageHeader } from '../components/UI'
import { machines } from '../data/machines'
import { useExercises } from '../hooks/queries'

const normalize = (value: string) => value.toLocaleLowerCase('ru-RU').replace(/ё/g, 'е').trim()

function MachinePhoto({ src, label }: { src: string; label: string }) {
  const [failed, setFailed] = useState(false)
  return (
    <div className="machine-photo">
      {failed ? (
        <div className="media-unavailable" role="img" aria-label={`Фото недоступно: ${label}`}>
          <Dumbbell size={32} />
          <span>Фото недоступно</span>
        </div>
      ) : (
        <img src={src} alt={label} loading="lazy" decoding="async" onError={() => setFailed(true)} />
      )}
    </div>
  )
}

export default function Catalog({ kind }: { kind: 'exercises' | 'machines' }) {
  const query = useExercises()
  const [params, setParams] = useSearchParams()
  const search = params.get('q') ?? ''
  const group = params.get('group') ?? ''
  const isMachines = kind === 'machines'
  const exercises = query.data ?? []
  const groups = isMachines
    ? ['Грудь', 'Спина', 'Плечи', 'Руки', 'Ноги', 'Корпус']
    : [...new Set(exercises.map(e => e.category))].sort((a, b) => a.localeCompare(b, 'ru'))
  const terms = normalize(search).split(/\s+/).filter(Boolean)
  const matches = (text: string) => terms.every(term => normalize(text).includes(term))
  const filteredExercises = exercises.filter(e =>
    (!group || e.category === group) && matches([e.name, e.equipment, ...e.primary_muscles, ...e.secondary_muscles].join(' ')),
  )
  const filteredMachines = machines.filter(m =>
    (!group || m.groups.includes(group)) && matches([m.name, m.brand, m.model, ...m.muscles, ...m.groups].join(' ')),
  )
  const count = isMachines ? filteredMachines.length : filteredExercises.length
  const total = isMachines ? machines.length : exercises.length
  const backTo = `/catalog/${kind}${params.size ? `?${params}` : ''}`
  function filter(key: string, value: string) {
    const next = new URLSearchParams(params)
    if (value) next.set(key, value)
    else next.delete(key)
    setParams(next, { replace: true })
  }

  return (
    <>
      <PageHeader eyebrow="ВАШ СПРАВОЧНИК В ЗАЛЕ" title="Каталог">
        <span className="catalog-heading-note"><Dumbbell size={18} /> От движения к результату</span>
      </PageHeader>
      <nav className="catalog-tabs" aria-label="Разделы каталога">
        <NavLink to="/catalog/exercises">Упражнения <span>{query.data ? exercises.length : '—'}</span></NavLink>
        <NavLink to="/catalog/machines">Тренажёры <span>{machines.length}</span></NavLink>
      </nav>
      <p className="catalog-intro">
        {isMachines
          ? 'Популярные типы тренажёров на примере конкретных моделей. Узнайте оборудование по фото и посмотрите, для каких движений оно подходит.'
          : 'Найдите упражнение, посмотрите работающие мышцы и откройте технику выполнения.'}
      </p>
      <div className="catalog-toolbar">
        <label className="catalog-search">
          <Search size={19} aria-hidden="true" />
          <input aria-label={isMachines ? 'Поиск тренажёров' : 'Поиск упражнений'} type="search"
            placeholder={isMachines ? 'Название, модель или мышца…' : 'Упражнение, мышца или оборудование…'}
            value={search} onChange={e => filter('q', e.target.value)} />
        </label>
        <label className="catalog-group">
          <span className="sr-only">Группа мышц</span>
          <select value={group} onChange={e => filter('group', e.target.value)}>
            <option value="">Все группы мышц</option>
            {groups.map(g => <option key={g} value={g}>{g[0].toUpperCase() + g.slice(1)}</option>)}
          </select>
        </label>
      </div>
      <div className="catalog-results">
        <span className="muted" role="status">Показано {count} из {total}</span>
        {(search || group) && <button className="text-link" onClick={() => setParams({}, { replace: true })}><X size={14} /> Сбросить</button>}
      </div>
      {!isMachines && query.isPending ? <Loading /> : !isMachines && query.isError && !query.data ? (
        <ErrorState error={query.error} retry={() => void query.refetch()} />
      ) : count === 0 ? (
        <Empty title="Ничего не найдено"><p>Попробуйте другое название или сбросьте фильтры.</p></Empty>
      ) : (
        <div className="catalog-grid">
          {isMachines ? filteredMachines.map(machine => (
            <Link className="card catalog-card" key={machine.id} to={`/catalog/machines/${machine.id}`} state={{ backTo }}>
              <MachinePhoto src={machine.image} label={`${machine.brand} ${machine.model}`} />
              <div className="catalog-card-copy">
                <span className="catalog-overline">{machine.brand}</span>
                <h2>{machine.name}</h2>
                <p className="catalog-model">{machine.model}</p>
                <div className="catalog-muscles">{machine.groups.map(g => <span key={g}>{g}</span>)}</div>
                <span className="catalog-card-action">О тренажёре <ArrowRight size={17} /></span>
              </div>
            </Link>
          )) : filteredExercises.map(exercise => (
            <Link className="card catalog-card" key={exercise.id} to={`/exercises/${exercise.id}`} state={{ backTo }}>
              <div className="catalog-exercise-photo"><ExerciseImage exercise={exercise} large loading="lazy" /></div>
              <div className="catalog-card-copy">
                <span className="catalog-overline">{exercise.category} · {exercise.equipment}</span>
                <h2>{exercise.name}</h2>
                <p className="catalog-model">{exercise.primary_muscles.join(' · ')}</p>
                <span className="catalog-card-action">Техника и мышцы <ArrowRight size={17} /></span>
              </div>
            </Link>
          ))}
        </div>
      )}
      {isMachines && <p className="catalog-credit">Изображения моделей — Life Fitness / Hammer Strength. Источник указан в карточке каждого тренажёра.</p>}
    </>
  )
}

export function MachineDetail() {
  const { slug } = useParams()
  const location = useLocation()
  const backTo = typeof location.state?.backTo === 'string' && location.state.backTo.startsWith('/catalog/machines')
    ? location.state.backTo : '/catalog/machines'
  const machine = machines.find(m => m.id === slug)
  const query = useExercises()
  if (!machine) return <Empty title="Тренажёр не найден"><Link className="text-link" to="/catalog/machines">К списку тренажёров <ArrowRight size={16} /></Link></Empty>
  const related = query.data?.filter(e => machine.exerciseSlugs.includes(e.slug)) ?? []
  return (
    <>
      <PageHeader back={backTo} eyebrow={`${machine.brand} · ${machine.model}`} title={machine.name} />
      <div className="detail-grid machine-detail">
        <div>
          <section className="card machine-detail-visual">
            <MachinePhoto key={machine.id} src={machine.image} label={`${machine.brand} ${machine.model}`} />
            <div className="machine-photo-credit"><span>Изображение производителя</span><a href={machine.sourceUrl} target="_blank" rel="noreferrer">Источник <ExternalLink size={13} /></a></div>
          </section>
          <section className="card muscle-card">
            <h2>Мышцы в работе</h2>
            <div className="muscle-tags">{machine.muscles.map(m => <span key={m}>{m}</span>)}</div>
          </section>
        </div>
        <div className="detail-copy">
          <p className="description">{machine.description}</p>
          <section className="card machine-recognition"><h2>Как узнать в зале</h2><p>{machine.recognition}</p></section>
          <section className="card machine-recognition">
            <h2>Модель на фото</h2>
            <p>{machine.brand} {machine.model}</p>
            <p className="muted">Расположение регулировок и траектория движения зависят от модели. Схема на корпусе поможет настроить именно ваш тренажёр.</p>
            <a className="text-link" href={machine.sourceUrl} target="_blank" rel="noreferrer">Страница производителя <ExternalLink size={15} /></a>
          </section>
          {machine.exerciseSlugs.length > 0 && (
            <section className="card machine-related">
              <h2>Движения в каталоге</h2>
              <p className="muted">Иллюстрации показывают тип движения; конструкция тренажёра может отличаться.</p>
              {query.isPending ? <Loading /> : query.isError && !query.data ? <ErrorState error={query.error} retry={() => void query.refetch()} /> : related.map(exercise => (
                <Link className="machine-related-link" key={exercise.id} to={`/exercises/${exercise.id}`} state={{ backTo: `/catalog/machines/${machine.id}` }}>
                  <ExerciseImage exercise={exercise} />
                  <span>{exercise.name}</span><ArrowRight size={17} />
                </Link>
              ))}
            </section>
          )}
        </div>
      </div>
    </>
  )
}
