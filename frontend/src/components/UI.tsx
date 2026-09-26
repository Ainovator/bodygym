import { Component, useEffect, useRef, type ReactNode } from 'react'
import { AlertCircle, ArrowLeft, LoaderCircle, X } from 'lucide-react'
import { Link } from 'react-router-dom'
import type { Exercise } from '../types'

export function Loading({ label = 'Загружаем данные…' }: { label?: string }) {
  return (
    <div className="state-box" role="status">
      <LoaderCircle className="spin" size={28} />
      <span>{label}</span>
    </div>
  )
}
export function ErrorState({ error, retry }: { error: unknown; retry?: () => void }) {
  return (
    <div className="error-box" role="alert">
      <AlertCircle size={20} />
      <div>
        <strong>{error instanceof Error ? error.message : 'Не удалось загрузить данные'}</strong>
        <p>Проверьте подключение и попробуйте ещё раз.</p>
        {retry && (
          <button className="button secondary small" onClick={retry}>
            Повторить
          </button>
        )}
      </div>
    </div>
  )
}
export function Empty({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="empty">
      <span className="empty-symbol">↗</span>
      <h3>{title}</h3>
      <div className="muted">{children}</div>
    </div>
  )
}
export function PageHeader({
  eyebrow,
  title,
  children,
  back,
}: {
  eyebrow?: string
  title: string
  children?: ReactNode
  back?: string
}) {
  return (
    <header className="page-header">
      <div>
        {back && (
          <Link className="back-link" to={back}>
            <ArrowLeft size={16} /> Назад
          </Link>
        )}
        {eyebrow && <p className="eyebrow">{eyebrow}</p>}
        <h1>{title}</h1>
      </div>
      {children}
    </header>
  )
}
export function ExerciseImage({
  exercise,
  large = false,
  loading = large ? 'eager' : 'lazy',
}: {
  exercise: Exercise
  large?: boolean
  loading?: 'eager' | 'lazy'
}) {
  const src = exercise.media.find((m) => m.type === 'image')?.url ?? '/illustrations/push.svg'
  const anatomical = src.startsWith('/illustrations/anatomy/')
  return (
    <img
      className={`exercise-image${large ? ' large' : ''}${anatomical ? ' anatomy' : ''}`}
      src={src}
      alt={`Иллюстрация: ${exercise.name}`}
      loading={loading}
      decoding="async"
    />
  )
}
export function Modal({
  title,
  children,
  onClose,
}: {
  title: string
  children: ReactNode
  onClose: () => void
}) {
  const ref = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    const dialog = ref.current
    dialog?.showModal()
    return () => {
      dialog?.close()
    }
  }, [])
  return (
    <dialog
      ref={ref}
      className="modal"
      onCancel={onClose}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
      aria-label={title}
    >
      <div className="modal-content">
        <header className="section-heading">
          <h2>{title}</h2>
          <button className="icon-button" onClick={onClose} aria-label="Закрыть">
            <X size={22} />
          </button>
        </header>
        {children}
      </div>
    </dialog>
  )
}
export class ErrorBoundary extends Component<{ children: ReactNode }, { error: boolean }> {
  state = { error: false }
  static getDerivedStateFromError() {
    return { error: true }
  }
  render() {
    return this.state.error ? (
      <main className="page">
        <ErrorState
          error={
            new Error('Не удалось открыть экран. Ваши сохранённые подходы остаются на устройстве.')
          }
          retry={() => location.reload()}
        />
      </main>
    ) : (
      this.props.children
    )
  }
}
