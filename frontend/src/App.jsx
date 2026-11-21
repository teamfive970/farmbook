import { useState } from "react";

export default function App() {
  const [count, setCount] = useState(0);

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <div className="mx-auto flex min-h-screen max-w-4xl flex-col items-center justify-center px-6 py-16 text-center">
        <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-sky-500 text-3xl font-bold text-white shadow-lg shadow-sky-500/20">
          ⚛
        </div>
        <p className="mb-3 text-sm font-semibold uppercase tracking-[0.2em] text-sky-600">
          React + Vite + Tailwind CSS v4
        </p>
        <h1 className="text-4xl font-bold tracking-tight sm:text-6xl">
          Welcome to your project
        </h1>
        <p className="mt-5 max-w-xl text-base leading-7 text-slate-600">
          Your clean starter screen is ready. Start building your application
          by editing <code className="rounded bg-slate-200 px-2 py-1 text-sm">src/App.jsx</code>.
        </p>
        <button
          type="button"
          onClick={() => setCount((value) => value + 1)}
          className="mt-8 rounded-lg bg-sky-600 px-6 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-sky-700 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:ring-offset-2"
        >
          Clicked {count} times
        </button>
        <p className="mt-10 text-sm text-slate-500">
          Edit, save, and watch your changes appear instantly.
        </p>
      </div>
    </main>
  );
}