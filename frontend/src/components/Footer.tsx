import { useEffect, useRef, useState } from 'react'
import { formatarDataHora } from '../lib/format'
import { consultarStatusSincronizacao, dispararSincronizacao } from '../lib/api'

interface FooterProps {
  ultimaSincronizacao: string | null | undefined
  aoSincronizarConcluido: () => void
}

const INTERVALO_POLL_MS = 2000

export function Footer({ ultimaSincronizacao, aoSincronizarConcluido }: FooterProps) {
  const [sincronizando, setSincronizando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const aoConcluirRef = useRef(aoSincronizarConcluido)
  aoConcluirRef.current = aoSincronizarConcluido

  useEffect(() => {
    // Ao carregar a tela, confere se já não tem uma sincronização em
    // andamento (ex.: disparada por outra pessoa, ou pela tarefa agendada).
    consultarStatusSincronizacao()
      .then((status) => setSincronizando(status.em_andamento))
      .catch(() => {})
  }, [])

  useEffect(() => {
    if (!sincronizando) return

    const intervalo = setInterval(async () => {
      try {
        const status = await consultarStatusSincronizacao()
        if (!status.em_andamento) {
          clearInterval(intervalo)
          setSincronizando(false)
          setErro(status.erro)
          if (!status.erro) aoConcluirRef.current()
        }
      } catch {
        // rede instável: só tenta de novo no próximo tick
      }
    }, INTERVALO_POLL_MS)

    return () => clearInterval(intervalo)
  }, [sincronizando])

  async function aoClicarAtualizar() {
    setErro(null)
    try {
      await dispararSincronizacao()
      setSincronizando(true)
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro desconhecido')
    }
  }

  return (
    <footer className="mx-auto flex w-full max-w-5xl shrink-0 flex-wrap items-center justify-center gap-x-3 gap-y-1 border-t border-stone-200 px-4 py-3 text-center text-xs text-stone-400 sm:px-6">
      <span>Última atualização dos dados: {formatarDataHora(ultimaSincronizacao ?? null)}</span>

      <button
        type="button"
        onClick={aoClicarAtualizar}
        disabled={sincronizando}
        className="inline-flex items-center gap-1.5 rounded-md border border-stone-300 px-2.5 py-1 font-medium text-stone-600 transition hover:bg-stone-50 hover:text-stone-800 disabled:cursor-not-allowed disabled:opacity-60"
      >
        <IconeAtualizar className={`size-3.5 ${sincronizando ? 'animate-spin' : ''}`} />
        {sincronizando ? 'Sincronizando…' : 'Atualizar dados'}
      </button>

      {erro && <span className="w-full text-red-500">Falha na sincronização: {erro}</span>}
    </footer>
  )
}

function IconeAtualizar({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className={className}>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M16.023 9.348h4.992v-4.992M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182"
      />
    </svg>
  )
}
