import React, { useEffect, useState } from 'react'
import { NavLink, Route, Routes } from 'react-router-dom'
import HomePage from './pages/HomePage.jsx'
import LibraryPage from './pages/LibraryPage.jsx'
import ViewerPage from './pages/ViewerPage.jsx'
import QuizPage from './pages/QuizPage.jsx'
import NotificationsPage from './pages/NotificationsPage.jsx'
import HotspotEditorPage from './pages/HotspotEditorPage.jsx'
import FlashcardsPage from './pages/FlashcardsPage.jsx'
import StatsPage from './pages/StatsPage.jsx'
import StructurePage from './pages/StructurePage.jsx'
import LoginPage from './pages/LoginPage.jsx'
import { cloudGetUser, cloudOnAuthStateChange, cloudSignOut } from './utils/supabaseSync.js'

const linkBase = 'px-3 py-2 rounded-lg text-sm font-medium'

export default function App() {
  const [user, setUser] = useState(null)
  const [authChecked, setAuthChecked] = useState(false)

  useEffect(() => {
    let alive = true
    cloudGetUser()
      .then((u) => {
        if (!alive) return
        setUser(u)
        setAuthChecked(true)
      })
      .catch(() => {
        if (!alive) return
        setUser(null)
        setAuthChecked(true)
      })

    const unsub = cloudOnAuthStateChange((u) => {
      if (!alive) return
      setUser(u)
      setAuthChecked(true)
    })

    return () => {
      alive = false
      unsub?.()
    }
  }, [])

  if (!authChecked) return null

  if (!user) {
    return <LoginPage />
  }

  return (
    <div className="min-h-dvh bg-slate-950 text-slate-100">
      <header className="sticky top-0 z-50 border-b border-slate-800/60 bg-slate-950/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3">
          <div className="flex items-center gap-2">
            <div className="h-9 w-9 rounded-xl bg-emerald-500/15 ring-1 ring-emerald-500/30" />
            <div>
              <div className="text-sm font-semibold leading-tight">MicroLab</div>
              <div className="text-xs text-slate-400 leading-tight">Histología · Anatomía · Biología</div>
            </div>
          </div>

          <nav className="hidden items-center gap-1 md:flex">
            <NavLink
              to="/"
              className={({ isActive }) =>
                `${linkBase} ${isActive ? 'bg-slate-800 text-white' : 'text-slate-300 hover:bg-slate-900'}`
              }
              end
            >
              Inicio
            </NavLink>
            <NavLink
              to="/biblioteca"
              className={({ isActive }) =>
                `${linkBase} ${isActive ? 'bg-slate-800 text-white' : 'text-slate-300 hover:bg-slate-900'}`
              }
            >
              Biblioteca
            </NavLink>
            <NavLink
              to="/visor"
              className={({ isActive }) =>
                `${linkBase} ${isActive ? 'bg-slate-800 text-white' : 'text-slate-300 hover:bg-slate-900'}`
              }
            >
              Visor
            </NavLink>
            <NavLink
              to="/quiz"
              className={({ isActive }) =>
                `${linkBase} ${isActive ? 'bg-slate-800 text-white' : 'text-slate-300 hover:bg-slate-900'}`
              }
            >
              Quiz
            </NavLink>
            <NavLink
              to="/notificaciones"
              className={({ isActive }) =>
                `${linkBase} ${isActive ? 'bg-slate-800 text-white' : 'text-slate-300 hover:bg-slate-900'}`
              }
            >
              Notificaciones
            </NavLink>
            <NavLink
              to="/flashcards"
              className={({ isActive }) =>
                `${linkBase} ${isActive ? 'bg-slate-800 text-white' : 'text-slate-300 hover:bg-slate-900'}`
              }
            >
              Flashcards
            </NavLink>
            <NavLink
              to="/estadisticas"
              className={({ isActive }) =>
                `${linkBase} ${isActive ? 'bg-slate-800 text-white' : 'text-slate-300 hover:bg-slate-900'}`
              }
            >
              Estadísticas
            </NavLink>
            <NavLink
              to="/editor"
              className={({ isActive }) =>
                `${linkBase} ${isActive ? 'bg-slate-800 text-white' : 'text-slate-300 hover:bg-slate-900'}`
              }
            >
              Editor
            </NavLink>
          </nav>

          <button
            type="button"
            onClick={async () => {
              try {
                await cloudSignOut()
              } catch {
                // ignore
              }
            }}
            className="hidden rounded-lg bg-slate-900 px-3 py-2 text-sm font-semibold text-slate-200 hover:bg-slate-800 md:inline-block"
            title={user?.email || 'Cerrar sesión'}
          >
            Salir
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-6">
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/biblioteca" element={<LibraryPage />} />
          <Route path="/visor" element={<ViewerPage />} />
          <Route path="/quiz" element={<QuizPage />} />
          <Route path="/notificaciones" element={<NotificationsPage />} />
          <Route path="/flashcards" element={<FlashcardsPage />} />
          <Route path="/estadisticas" element={<StatsPage />} />
          <Route path="/estructura/:cardId" element={<StructurePage />} />
          <Route path="/editor" element={<HotspotEditorPage />} />
        </Routes>
      </main>

      <footer className="border-t border-slate-800/60">
        <div className="mx-auto max-w-6xl px-4 py-4 text-xs text-slate-500">
          Hecho para estudio. Puedes cargar tus propias imágenes en alta resolución en la carpeta <code>public/slides</code>.
        </div>
      </footer>
    </div>
  )
}
