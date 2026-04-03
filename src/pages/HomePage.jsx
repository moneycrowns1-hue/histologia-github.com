import React from 'react'
import { Link } from 'react-router-dom'

export default function HomePage() {
  return (
    <div className="grid gap-6">
      <section className="rounded-2xl border border-slate-800/60 bg-slate-900/30 p-5">
        <h2 className="text-xl font-semibold">Aprende con diapositivas interactivas</h2>
        <p className="mt-2 text-sm text-slate-300">
          Explora tejidos, células y órganos con zoom fluido, puntos interactivos y un modo quiz para entrenar reconocimiento.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Link
            to="/visor"
            className="rounded-xl bg-emerald-500 px-4 py-2 text-sm font-semibold text-emerald-950 hover:bg-emerald-400"
          >
            Abrir visor
          </Link>
          <Link
            to="/quiz"
            className="rounded-xl bg-slate-800 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700"
          >
            Iniciar quiz
          </Link>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-800/60 bg-slate-900/20 p-4">
        <div className="text-sm font-semibold">Guía rápida</div>
        <div className="mt-2 grid gap-2 text-sm text-slate-300">
          <div>
            1) Coloca tus imágenes en <code className="text-slate-200">public/slides</code> (JPG/PNG).
          </div>
          <div>
            2) Edita <code className="text-slate-200">src/slides/slides.js</code> para agregar diapositivas y hotspots.
          </div>
          <div>
            3) En el visor, usa <span className="text-slate-200">Estudio</span> para ver etiquetas y <span className="text-slate-200">Quiz</span> para practicar.
          </div>
        </div>
      </section>

      <section className="grid gap-3 md:grid-cols-3">
        <div className="rounded-2xl border border-slate-800/60 bg-slate-900/20 p-4">
          <div className="text-sm font-semibold">Zoom + desplazamiento táctil</div>
          <div className="mt-1 text-sm text-slate-300">Rueda, arrastre, y pinch-to-zoom en pantallas táctiles.</div>
        </div>
        <div className="rounded-2xl border border-slate-800/60 bg-slate-900/20 p-4">
          <div className="text-sm font-semibold">Puntos interactivos</div>
          <div className="mt-1 text-sm text-slate-300">Toca una estructura para ver nombre, descripción y función.</div>
        </div>
        <div className="rounded-2xl border border-slate-800/60 bg-slate-900/20 p-4">
          <div className="text-sm font-semibold">Modo estudio / modo quiz</div>
          <div className="mt-1 text-sm text-slate-300">Muestra u oculta etiquetas para practicar.</div>
        </div>
      </section>
    </div>
  )
}
