import { useEffect, useRef, useState } from 'react'
import type { Recibo } from '../lib/api'
import { salvarObservacao } from '../lib/api'
import { formatarDataBR, formatarMoeda } from '../lib/format'

interface ResultsTableProps {
  resultados: Recibo[]
}

const estiloTh = 'sticky top-0 z-10 bg-stone-50 px-4 py-3'

export function ResultsTable({ resultados }: ResultsTableProps) {
  return (
    <div className="h-full overflow-auto rounded-xl border border-stone-200 bg-white shadow-sm">
      <table className="w-full min-w-[720px] border-collapse text-sm">
        <thead>
          <tr className="border-b border-stone-200 text-left text-xs font-medium uppercase tracking-wide text-stone-500">
            <th className={estiloTh}>Cliente</th>
            <th className={estiloTh}>Data Pagamento</th>
            <th className={`${estiloTh} text-right`}>Valor</th>
            <th className={estiloTh}>Observação</th>
          </tr>
        </thead>
        <tbody>
          {resultados.map((recibo, i) => (
            <tr
              key={recibo.chave}
              className={i % 2 === 0 ? 'bg-white' : 'bg-stone-50/70'}
            >
              <td className="px-4 py-3 text-stone-800">{recibo.cliente}</td>
              <td className="px-4 py-3 whitespace-nowrap text-stone-600">
                {formatarDataBR(recibo.data_pagamento)}
              </td>
              <td className="px-4 py-3 text-right font-medium whitespace-nowrap text-stone-900">
                {formatarMoeda(recibo.valor)}
              </td>
              <td className="px-4 py-3">
                <ObservacaoCell chave={recibo.chave} valorInicial={recibo.observacao} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

interface ObservacaoCellProps {
  chave: string
  valorInicial: string
}

type StatusSalvamento = 'ocioso' | 'salvando' | 'erro'

function ObservacaoCell({ chave, valorInicial }: ObservacaoCellProps) {
  const [salvo, setSalvo] = useState(valorInicial)
  const [editando, setEditando] = useState(false)
  const [texto, setTexto] = useState(valorInicial)
  const [status, setStatus] = useState<StatusSalvamento>('ocioso')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    setSalvo(valorInicial)
    setTexto(valorInicial)
    setEditando(false)
    setStatus('ocioso')
  }, [chave, valorInicial])

  function aoIniciarEdicao() {
    setTexto(salvo)
    setEditando(true)
    setStatus('ocioso')
    requestAnimationFrame(() => inputRef.current?.focus())
  }

  function aoCancelar() {
    setTexto(salvo)
    setEditando(false)
    setStatus('ocioso')
  }

  async function aoConfirmar() {
    if (texto === salvo) {
      setEditando(false)
      return
    }
    setStatus('salvando')
    try {
      await salvarObservacao(chave, texto)
      setSalvo(texto)
      setEditando(false)
      setStatus('ocioso')
    } catch {
      setStatus('erro')
    }
  }

  if (!editando) {
    return (
      <button
        type="button"
        onClick={aoIniciarEdicao}
        className="group flex w-full min-w-[180px] items-center gap-2 rounded-md px-2 py-1 text-left transition-colors hover:bg-stone-100"
      >
        <span className={salvo ? 'text-stone-700' : 'text-stone-400 italic'}>
          {salvo || 'Adicionar observação…'}
        </span>
        <IconeLapis className="size-3.5 shrink-0 text-stone-300 transition-colors group-hover:text-stone-500" />
      </button>
    )
  }

  return (
    <div className="flex items-center gap-1">
      <input
        ref={inputRef}
        type="text"
        value={texto}
        onChange={(e) => setTexto(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') aoConfirmar()
          if (e.key === 'Escape') aoCancelar()
        }}
        placeholder="Adicionar observação…"
        disabled={status === 'salvando'}
        className="w-full min-w-[180px] rounded-md border border-stone-300 bg-white px-2 py-1 text-stone-700 outline-none focus:border-stone-400"
      />
      <button
        type="button"
        onClick={aoConfirmar}
        disabled={status === 'salvando'}
        title="Confirmar"
        className="shrink-0 rounded-md p-1 text-emerald-600 hover:bg-emerald-50 disabled:opacity-50"
      >
        <IconeCheck className="size-4" />
      </button>
      <button
        type="button"
        onClick={aoCancelar}
        disabled={status === 'salvando'}
        title="Cancelar"
        className="shrink-0 rounded-md p-1 text-stone-400 hover:bg-stone-100 disabled:opacity-50"
      >
        <IconeX className="size-4" />
      </button>
      {status === 'erro' && <span className="shrink-0 text-xs text-red-500">erro ao salvar</span>}
    </div>
  )
}

function IconeLapis({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className={className}>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M16.862 4.487a2.1 2.1 0 1 1 2.97 2.97L8.25 18.94l-4.243.706.707-4.243 12.148-12.916Z"
      />
    </svg>
  )
}

function IconeCheck({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} className={className}>
      <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
    </svg>
  )
}

function IconeX({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} className={className}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
    </svg>
  )
}
