import { mascararValorDigitado } from '../lib/format'

export interface ValoresFiltro {
  cliente: string
  data: string
  valorExibido: string
}

interface SearchFiltersProps {
  valores: ValoresFiltro
  aoAlterar: (valores: ValoresFiltro) => void
  aoLimpar: () => void
}

const estiloCampo =
  'w-full rounded-lg border border-stone-300 bg-white px-3 py-2.5 text-sm text-stone-900 ' +
  'placeholder:text-stone-400 shadow-sm transition focus:border-emerald-500 focus:outline-none ' +
  'focus:ring-2 focus:ring-emerald-500/20'

export function SearchFilters({ valores, aoAlterar, aoLimpar }: SearchFiltersProps) {
  const temFiltro = valores.cliente || valores.data || valores.valorExibido

  return (
    <section className="rounded-xl border border-stone-200 bg-white p-4 shadow-sm sm:p-5">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div>
          <label htmlFor="filtro-cliente" className="mb-1.5 block text-xs font-medium text-stone-600">
            Cliente
          </label>
          <input
            id="filtro-cliente"
            type="text"
            placeholder="Nome do cliente"
            className={estiloCampo}
            value={valores.cliente}
            onChange={(e) => aoAlterar({ ...valores, cliente: e.target.value })}
          />
        </div>

        <div>
          <label htmlFor="filtro-data" className="mb-1.5 block text-xs font-medium text-stone-600">
            Data de pagamento
          </label>
          <input
            id="filtro-data"
            type="date"
            className={estiloCampo}
            value={valores.data}
            onChange={(e) => aoAlterar({ ...valores, data: e.target.value })}
          />
        </div>

        <div>
          <label htmlFor="filtro-valor" className="mb-1.5 block text-xs font-medium text-stone-600">
            Valor
          </label>
          <div className="relative">
            <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm text-stone-400">
              R$
            </span>
            <input
              id="filtro-valor"
              type="text"
              inputMode="numeric"
              placeholder="0,00"
              className={`${estiloCampo} pl-9`}
              value={valores.valorExibido}
              onChange={(e) =>
                aoAlterar({ ...valores, valorExibido: mascararValorDigitado(e.target.value) })
              }
            />
          </div>
        </div>
      </div>

      {temFiltro ? (
        <button
          type="button"
          onClick={aoLimpar}
          className="mt-3 text-xs font-medium text-stone-500 underline decoration-stone-300 underline-offset-2 hover:text-stone-700"
        >
          Limpar filtros
        </button>
      ) : null}
    </section>
  )
}
