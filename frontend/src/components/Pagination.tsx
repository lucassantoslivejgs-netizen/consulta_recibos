interface PaginationProps {
  pagina: number
  totalPaginas: number
  aoMudarPagina: (pagina: number) => void
}

const estiloBotao =
  'inline-flex items-center gap-1 rounded-lg border border-stone-300 bg-white px-3 py-1.5 ' +
  'text-sm font-medium text-stone-700 shadow-sm transition hover:bg-stone-50 ' +
  'disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-white'

export function Pagination({ pagina, totalPaginas, aoMudarPagina }: PaginationProps) {
  if (totalPaginas <= 1) return null

  return (
    <div className="mt-3 flex shrink-0 items-center justify-between">
      <button
        type="button"
        className={estiloBotao}
        disabled={pagina <= 1}
        onClick={() => aoMudarPagina(pagina - 1)}
      >
        ← Anterior
      </button>

      <span className="text-sm text-stone-500">
        Página {pagina} de {totalPaginas}
      </span>

      <button
        type="button"
        className={estiloBotao}
        disabled={pagina >= totalPaginas}
        onClick={() => aoMudarPagina(pagina + 1)}
      >
        Próxima →
      </button>
    </div>
  )
}
