import { formatarDataHora } from '../lib/format'

interface FooterProps {
  ultimaSincronizacao: string | null | undefined
}

export function Footer({ ultimaSincronizacao }: FooterProps) {
  return (
    <footer className="mx-auto w-full max-w-5xl shrink-0 border-t border-stone-200 px-4 py-3 text-center text-xs text-stone-400 sm:px-6">
      Última atualização dos dados: {formatarDataHora(ultimaSincronizacao ?? null)}
    </footer>
  )
}
