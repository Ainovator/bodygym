import { useEffect, useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import {
  ArrowDown,
  ArrowRight,
  ArrowUp,
  Clock3,
  Dumbbell,
  Pencil,
  Plus,
  Search,
  Trash2,
} from 'lucide-react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useExercises, useTemplates } from '../hooks/queries'
import { send } from '../lib/api'
import { queryClient } from '../lib/query'
import { Empty, ErrorState, ExerciseImage, Loading, Modal, PageHeader } from '../components/UI'
import type { Exercise, Template, TemplateExercise } from '../types'

export function Programs() {
  const query = useTemplates()
  const [deleting, setDeleting] = useState<Template | null>(null)
  const remove = useMutation({
    mutationFn: (id: string) => send(`/workout-templates/${id}`, 'DELETE'),
    onSuccess: () => {
      setDeleting(null)
      void queryClient.invalidateQueries({ queryKey: ['templates'] })
    },
  })
  return (
    <>
      <PageHeader eyebrow="Постройте свою систему" title="Программы">
        <Link className="button" to="/programs/new">
          <Plus size={19} />
          Новая программа
        </Link>
      </PageHeader>
      <p className="page-intro">Меньше решений в зале. Больше внимания каждому подходу.</p>
      {query.isPending ? (
        <Loading />
      ) : query.isError && !query.data ? (
        <ErrorState error={query.error} retry={() => void query.refetch()} />
      ) : !query.data?.length ? (
        <Empty title="Здесь будет ваша программа">
          <p>Добавьте упражнения, задайте подходы и начните тренировку.</p>
        </Empty>
      ) : (
        <div className="program-grid">
          {query.data.map((program, index) => (
            <article className="card program-card" key={program.id}>
              <div className={`program-visual visual-${index % 3}`}>
                <span className="program-number">0{index + 1}</span>
                <img src={`/illustrations/${['push', 'pull', 'legs'][index % 3]}.svg`} alt="" />
                <span className="program-tag">СИЛОВАЯ</span>
              </div>
              <div className="program-content">
                <h2>{program.name}</h2>
                <p className="muted">{program.description || 'Ваша персональная программа'}</p>
                <div className="program-meta">
                  <span>
                    <Dumbbell size={15} />
                    {program.exercises.length} упражнений
                  </span>
                  <span>
                    <Clock3 size={15} />
                    {program.exercises.reduce((n, e) => n + e.target_sets, 0)} подходов
                  </span>
                </div>
                <div className="program-preview">
                  {program.exercises.slice(0, 3).map((e) => (
                    <span key={e.exercise_id}>{e.exercise.name}</span>
                  ))}
                  {program.exercises.length > 3 && (
                    <small>+ ещё {program.exercises.length - 3}</small>
                  )}
                </div>
                <div className="program-actions">
                  <Link className="button secondary" to={`/programs/${program.id}/edit`}>
                    <Pencil size={16} />
                    Редактировать
                    <ArrowRight size={16} />
                  </Link>
                  <button
                    className="icon-button"
                    aria-label={`Удалить ${program.name}`}
                    onClick={() => setDeleting(program)}
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
      {deleting && (
        <Modal title="Удалить программу?" onClose={() => setDeleting(null)}>
          <p>«{deleting.name}» будет удалена. История выполненных тренировок сохранится.</p>
          {remove.isError && <ErrorState error={remove.error} />}
          <div className="modal-actions">
            <button className="button secondary" onClick={() => setDeleting(null)}>
              Отмена
            </button>
            <button
              className="button danger"
              disabled={remove.isPending}
              onClick={() => remove.mutate(deleting.id)}
            >
              Удалить программу
            </button>
          </div>
        </Modal>
      )}
    </>
  )
}
export function TemplateEditor() {
  const { id } = useParams()
  const templates = useTemplates()
  const catalog = useExercises()
  const navigate = useNavigate()
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [items, setItems] = useState<TemplateExercise[]>([])
  const [loaded, setLoaded] = useState(false)
  const [picker, setPicker] = useState(false)
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('Все')
  useEffect(() => {
    if (!id || loaded || !templates.data) return
    const template = templates.data.find((t) => t.id === id)
    if (template) {
      setName(template.name)
      setDescription(template.description)
      setItems(template.exercises)
      setLoaded(true)
    }
  }, [id, loaded, templates.data])
  const save = useMutation({
    mutationFn: () =>
      send<Template>(id ? `/workout-templates/${id}` : '/workout-templates', id ? 'PUT' : 'POST', {
        name,
        description,
        exercises: items.map((e, position) => ({
          exercise_id: e.exercise_id,
          position,
          target_sets: e.target_sets,
          target_reps_min: e.target_reps_min,
          target_reps_max: e.target_reps_max,
          rest_seconds: e.rest_seconds,
        })),
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['templates'] })
      navigate('/programs')
    },
  })
  function add(exercise: Exercise) {
    setItems([
      ...items,
      {
        exercise_id: exercise.id,
        position: items.length,
        target_sets: 3,
        target_reps_min: 8,
        target_reps_max: 12,
        rest_seconds: exercise.default_rest_seconds,
        exercise,
      },
    ])
    setPicker(false)
  }
  function update(
    index: number,
    key: 'target_sets' | 'target_reps_min' | 'target_reps_max' | 'rest_seconds',
    value: number,
  ) {
    setItems(items.map((item, i) => (i === index ? { ...item, [key]: value } : item)))
  }
  function move(index: number, by: number) {
    const next = [...items]
    ;[next[index], next[index + by]] = [next[index + by], next[index]]
    setItems(next)
  }
  if (id && templates.isPending) return <Loading />
  if (id && templates.isError)
    return <ErrorState error={templates.error} retry={() => void templates.refetch()} />
  if (id && templates.data && !templates.data.some((t) => t.id === id))
    return (
      <Empty title="Программа не найдена">
        <Link to="/programs">Все программы</Link>
      </Empty>
    )
  const filtered =
    catalog.data?.filter(
      (e) =>
        !items.some((item) => item.exercise_id === e.id) &&
        (category === 'Все' || e.category === category) &&
        `${e.name} ${e.slug}`.toLowerCase().includes(search.toLowerCase()),
    ) ?? []
  return (
    <>
      <PageHeader
        back="/programs"
        eyebrow="Ваш план, ваши правила"
        title={id ? 'Редактировать программу' : 'Новая программа'}
      />
      <form
        className="editor-layout"
        onSubmit={(e) => {
          e.preventDefault()
          save.mutate()
        }}
      >
        <div className="card form-card">
          <label>
            Название
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Например, Верх тела"
              required
              maxLength={120}
            />
          </label>
          <label>
            Описание
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Фокус и настроение тренировки"
              maxLength={2000}
              rows={2}
            />
          </label>
        </div>
        <div className="section-heading">
          <h2>
            Упражнения <span className="count-badge">{items.length}</span>
          </h2>
          <button className="button secondary small" type="button" onClick={() => setPicker(true)}>
            <Plus size={17} />
            Добавить
          </button>
        </div>
        {!items.length && (
          <Empty title="С чего начнём?">
            <button className="text-link" type="button" onClick={() => setPicker(true)}>
              Выбрать упражнения <ArrowRight size={17} />
            </button>
          </Empty>
        )}
        {items.map((item, index) => (
          <section className="card editor-exercise" key={item.exercise_id}>
            <header>
              <ExerciseImage exercise={item.exercise} />
              <h3>{item.exercise.name}</h3>
              <div className="editor-reorder">
                <button
                  type="button"
                  className="icon-button"
                  disabled={index === 0}
                  aria-label="Переместить вверх"
                  onClick={() => move(index, -1)}
                >
                  <ArrowUp size={16} />
                </button>
                <button
                  type="button"
                  className="icon-button"
                  disabled={index === items.length - 1}
                  aria-label="Переместить вниз"
                  onClick={() => move(index, 1)}
                >
                  <ArrowDown size={16} />
                </button>
                <button
                  type="button"
                  className="icon-button"
                  aria-label="Убрать упражнение"
                  onClick={() => setItems(items.filter((_, i) => i !== index))}
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </header>
            <div className="editor-fields">
              <label>
                Подходы
                <input
                  type="number"
                  inputMode="numeric"
                  min={1}
                  max={20}
                  required
                  value={item.target_sets}
                  onChange={(e) => update(index, 'target_sets', Number(e.target.value))}
                />
              </label>
              <label>
                Повторы от
                <input
                  type="number"
                  inputMode="numeric"
                  min={1}
                  max={100}
                  required
                  value={item.target_reps_min}
                  onChange={(e) => update(index, 'target_reps_min', Number(e.target.value))}
                />
              </label>
              <label>
                Повторы до
                <input
                  type="number"
                  inputMode="numeric"
                  min={item.target_reps_min}
                  max={100}
                  required
                  value={item.target_reps_max}
                  onChange={(e) => update(index, 'target_reps_max', Number(e.target.value))}
                />
              </label>
              <label>
                Отдых, сек
                <input
                  type="number"
                  inputMode="numeric"
                  min={0}
                  max={900}
                  required
                  value={item.rest_seconds}
                  onChange={(e) => update(index, 'rest_seconds', Number(e.target.value))}
                />
              </label>
            </div>
          </section>
        ))}
        {save.isError && <ErrorState error={save.error} />}
        <div className="editor-save">
          <Link className="button secondary" to="/programs">
            Отмена
          </Link>
          <button className="button" disabled={!items.length || save.isPending}>
            {save.isPending ? 'Сохраняем…' : 'Сохранить программу'}
          </button>
        </div>
      </form>
      {picker && (
        <Modal title="Добавить упражнение" onClose={() => setPicker(false)}>
          <label className="search-input">
            <Search size={19} />
            <input
              autoFocus
              placeholder="Название упражнения"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              aria-label="Поиск упражнения"
            />
          </label>
          <div className="filter-chips">
            {['Все', ...new Set(catalog.data?.map((e) => e.category))].map((c) => (
              <button
                key={c}
                className={category === c ? 'selected' : ''}
                onClick={() => setCategory(c)}
              >
                {c}
              </button>
            ))}
          </div>
          {catalog.isPending ? (
            <Loading />
          ) : catalog.isError ? (
            <ErrorState error={catalog.error} retry={() => void catalog.refetch()} />
          ) : (
            <div className="picker-list">
              {filtered.map((exercise) => (
                <button className="picker-item" key={exercise.id} onClick={() => add(exercise)}>
                  <ExerciseImage exercise={exercise} />
                  <span>
                    <strong>{exercise.name}</strong>
                    <small>
                      {exercise.equipment} · {exercise.category}
                    </small>
                  </span>
                  <Plus size={20} />
                </button>
              ))}
              {!filtered.length && (
                <Empty title="Ничего не найдено">
                  <p>Измените поиск или категорию.</p>
                </Empty>
              )}
            </div>
          )}
        </Modal>
      )}
    </>
  )
}
