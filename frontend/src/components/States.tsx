import type { ReactNode } from 'react'

function CentroEstado({
  icone,
  titulo,
  descricao,
}: {
  icone: ReactNode
  titulo: string
  descricao?: string
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-stone-300 bg-white/60 px-6 py-14 text-center">
      {icone}
      <p className="text-sm font-medium text-stone-700">{titulo}</p>
      {descricao ? <p className="max-w-sm text-sm text-stone-500">{descricao}</p> : null}
    </div>
  )
}

export function EstadoCarregando() {
  return (
    <div className="flex items-center justify-center gap-3 rounded-xl border border-stone-200 bg-white px-6 py-14 text-stone-500">
      <svg className="h-5 w-5 animate-spin text-emerald-600" viewBox="0 0 24 24" fill="none">
        <circle
          className="opacity-25"
          cx="12"
          cy="12"
          r="10"
          stroke="currentColor"
          strokeWidth="4"
        />
        <path
          className="opacity-75"
          fill="currentColor"
          d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
        />
      </svg>
      <span className="text-sm">Buscando recibos…</span>
    </div>
  )
}

export function EstadoInicial() {
  return (
    <CentroEstado
      icone={
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.5}
          className="h-8 w-8 text-stone-400"
        >
          <circle cx="11" cy="11" r="7" />
          <path strokeLinecap="round" d="m20 20-3.5-3.5" />
        </svg>
      }
      titulo="Digite um filtro para começar"
      descricao="Busque por cliente, data de pagamento ou valor — pode combinar os três."
    />
  )
}

export function EstadoVazio() {
  return (
    <CentroEstado
      icone={
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.5}
          className="h-8 w-8 text-stone-400"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6M9 8h6M6 3h9l3 3v15H6z" />
        </svg>
      }
      titulo="Nenhum recibo encontrado"
      descricao="Confira os filtros e tente novamente."
    />
  )
}

export function EstadoErro({ mensagem }: { mensagem: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-red-200 bg-red-50 px-6 py-14 text-center">
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.5}
        className="h-8 w-8 text-red-500"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M12 9v4m0 4h.01M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L14.71 3.86a2 2 0 0 0-3.42 0Z"
        />
      </svg>
      <p className="text-sm font-medium text-red-700">Não foi possível buscar os recibos</p>
      <p className="max-w-sm text-sm text-red-600">{mensagem}</p>
    </div>
  )
}
