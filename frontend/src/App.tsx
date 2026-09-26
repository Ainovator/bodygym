import { lazy, Suspense, useState } from 'react'
import {
  Activity,
  BarChart3,
  BookOpen,
  Dumbbell,
  History as HistoryIcon,
  Moon,
  Sun,
  WifiOff,
} from 'lucide-react'
import { Link, NavLink, Route, Routes } from 'react-router-dom'
import { Today } from './pages/Today'
import { Programs, TemplateEditor } from './pages/Programs'
import { ExerciseDetail } from './pages/ExerciseDetail'
import { Workout } from './pages/Workout'
import { History } from './pages/History'
import { useSyncState, retrySync } from './lib/offline'
import { ErrorBoundary, Loading } from './components/UI'
const Progress = lazy(() => import('./pages/Progress'))
const themeStorageKey = 'feetwork-theme-copper-v1'
function applyTheme(dark: boolean) {
  document.documentElement.dataset.theme = dark ? 'dark' : 'light'
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', dark ? '#141210' : '#f5f1ed')
}
const tabs = [
  { to: '/', label: 'Сегодня', Icon: Activity },
  { to: '/programs', label: 'Программы', Icon: BookOpen },
  { to: '/history', label: 'История', Icon: HistoryIcon },
  { to: '/progress', label: 'Прогресс', Icon: BarChart3 },
]
export function App() {
  const [dark, setDark] = useState(() => {
    const isDark = localStorage.getItem(themeStorageKey) !== 'light'
    applyTheme(isDark)
    return isDark
  })
  const sync = useSyncState()
  const pending = Object.keys(sync.queue).length
  const failed = Object.values(sync.queue).find((item) => item.error)
  function toggleTheme() {
    const next = !dark
    setDark(next)
    applyTheme(next)
    localStorage.setItem(themeStorageKey, next ? 'dark' : 'light')
  }
  return (
    <ErrorBoundary>
      <div className="app-shell">
        <aside className="sidebar">
          <Link to="/" className="brand">
            <span className="brand-mark">
              <Dumbbell size={25} />
            </span>
            feetwork<span className="brand-period">.</span>
          </Link>
          <div className="sidebar-label">ВАШЕ ПРОСТРАНСТВО</div>
          <nav aria-label="Основная навигация">
            {tabs.map(({ to, label, Icon }) => (
              <NavLink
                key={to}
                to={to}
                end={to === '/'}
                className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
              >
                <Icon size={21} />
                <span>{label}</span>
              </NavLink>
            ))}
          </nav>
          <div className="sidebar-bottom">
            <div className="sidebar-note">
              <span className="status-dot" />
              <span>
                Маленькие шаги.
                <br />
                <strong>Большая разница.</strong>
              </span>
            </div>
            <button className="theme-button" onClick={toggleTheme}>
              {dark ? <Sun size={18} /> : <Moon size={18} />}
              {dark ? 'Светлая тема' : 'Тёмная тема'}
            </button>
            <div className="profile-mini">
              <span className="avatar">А</span>
              <div>
                <strong>Демо-профиль</strong>
                <small>Дневник силы · MVP</small>
              </div>
            </div>
          </div>
        </aside>
        <div className="main-shell">
          <header className="topbar">
            <Link className="mobile-brand" to="/">
              <Dumbbell size={22} /> feetwork.
            </Link>
            <span className="topbar-caption">Сила начинается с регулярности</span>
            <div className="topbar-right">
              <span className="demo-badge">Демо-пространство</span>
              <button className="icon-button" onClick={toggleTheme} aria-label="Переключить тему">
                {dark ? <Sun size={19} /> : <Moon size={19} />}
              </button>
              <span className="avatar small-avatar">А</span>
            </div>
          </header>
          {(!sync.online || pending > 0 || sync.storageError) && (
            <div
              className={`sync-banner ${failed || sync.storageError ? 'warning' : ''}`}
              role="status"
            >
              <WifiOff size={16} />
              <span>
                {sync.storageError ||
                  failed?.error ||
                  (!sync.online
                    ? `Нет сети. Изменения сохранены на устройстве${pending ? `: ${pending}` : ''}.`
                    : `Сохраняем подходы: ${pending}…`)}
              </span>
              {failed && <button onClick={retrySync}>Повторить</button>}
            </div>
          )}
          <main className="page">
            <Suspense fallback={<Loading />}>
              <Routes>
                <Route path="/" element={<Today />} />
                <Route path="/programs" element={<Programs />} />
                <Route path="/programs/new" element={<TemplateEditor />} />
                <Route path="/programs/:id/edit" element={<TemplateEditor />} />
                <Route path="/exercises/:id" element={<ExerciseDetail />} />
                <Route path="/workouts/:id" element={<Workout />} />
                <Route path="/history" element={<History />} />
                <Route path="/progress" element={<Progress />} />
                <Route
                  path="*"
                  element={
                    <div className="empty">
                      <h1>Страница не найдена</h1>
                      <Link className="button" to="/">
                        На главную
                      </Link>
                    </div>
                  }
                />
              </Routes>
            </Suspense>
          </main>
        </div>
        <nav className="bottom-nav" aria-label="Мобильная навигация">
          {tabs.map(({ to, label, Icon }) => (
            <NavLink key={to} to={to} end={to === '/'}>
              <Icon size={22} />
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>
      </div>
    </ErrorBoundary>
  )
}
