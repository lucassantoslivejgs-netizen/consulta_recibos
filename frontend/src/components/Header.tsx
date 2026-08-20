export function Header() {
  return (
    <header className="shrink-0 border-b border-stone-200 bg-white">
      <div className="mx-auto flex max-w-5xl items-center gap-3 px-4 py-5 sm:px-6">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-emerald-600 text-white">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            className="h-5 w-5"
          >
            <path d="M9 12l2 2 4-4" />
            <path d="M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
          </svg>
        </div>
        <div>
          <h1 className="text-lg font-semibold tracking-tight text-stone-900 sm:text-xl">
            Consulta de Recibos
          </h1>
          <p className="text-sm text-stone-500">LIVE Roupas Esportivas · Setor Financeiro</p>
        </div>
      </div>
    </header>
  )
}
