import { useEffect, useState } from 'react'
import { Header } from './components/Header'
import { SearchFilters, type ValoresFiltro } from './components/SearchFilters'
import { ResultsTable } from './components/ResultsTable'
import { Pagination } from './components/Pagination'
import { Footer } from './components/Footer'
import { EstadoCarregando, EstadoErro, EstadoInicial, EstadoVazio } from './components/States'
import { buscarMeta, buscarRecibos, type Meta, type RespostaRecibos } from './lib/api'
import { valorMascaradoParaQuery } from './lib/format'

const ATRASO_BUSCA_MS = 350
const FILTROS_VAZIOS: ValoresFiltro = { cliente: '', data: '', valorExibido: '' }

function App() {
  const [filtros, setFiltros] = useState<ValoresFiltro>(FILTROS_VAZIOS)
  const [pagina, setPagina] = useState(1)
  const [resposta, setResposta] = useState<RespostaRecibos | null>(null)
  const [carregando, setCarregando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [meta, setMeta] = useState<Meta | null>(null)

  function aoAlterarFiltros(novosValores: ValoresFiltro) {
    setFiltros(novosValores)
    setPagina(1)
  }

  function aoLimparFiltros() {
    setFiltros(FILTROS_VAZIOS)
    setPagina(1)
  }

  useEffect(() => {
    buscarMeta()
      .then(setMeta)
      .catch(() => setMeta(null))
  }, [])

  useEffect(() => {
    const controller = new AbortController()
    const timer = setTimeout(() => {
      const semFiltro = !filtros.cliente && !filtros.data && !filtros.valorExibido
      if (semFiltro) {
        setResposta(null)
        setErro(null)
        setCarregando(false)
        return
      }

      setCarregando(true)
      setErro(null)
      buscarRecibos(
        {
          cliente: filtros.cliente,
          data: filtros.data,
          valorQuery: filtros.valorExibido ? valorMascaradoParaQuery(filtros.valorExibido) : '',
          pagina,
        },
        controller.signal,
      )
        .then((r) => setResposta(r))
        .catch((e: unknown) => {
          if (e instanceof DOMException && e.name === 'AbortError') return
          setErro(e instanceof Error ? e.message : 'Erro desconhecido')
        })
        .finally(() => setCarregando(false))
    }, ATRASO_BUSCA_MS)

    return () => {
      clearTimeout(timer)
      controller.abort()
    }
  }, [filtros, pagina])

  const temFiltro = filtros.cliente || filtros.data || filtros.valorExibido

  return (
    <div className="flex h-dvh flex-col overflow-hidden">
      <Header />

      <main className="mx-auto flex w-full max-w-5xl min-h-0 flex-1 flex-col px-4 py-6 sm:px-6">
        <SearchFilters valores={filtros} aoAlterar={aoAlterarFiltros} aoLimpar={aoLimparFiltros} />

        <div className="mt-5 flex min-h-0 flex-1 flex-col">
          {!temFiltro && <EstadoInicial />}

          {temFiltro && carregando && <EstadoCarregando />}

          {temFiltro && !carregando && erro && <EstadoErro mensagem={erro} />}

          {temFiltro && !carregando && !erro && resposta && resposta.total === 0 && <EstadoVazio />}

          {temFiltro && !carregando && !erro && resposta && resposta.total > 0 && (
            <div className="flex min-h-0 flex-1 flex-col">
              <p className="mb-3 shrink-0 text-sm text-stone-500">
                {(resposta.pagina - 1) * resposta.tamanho_pagina + 1}–
                {Math.min(resposta.pagina * resposta.tamanho_pagina, resposta.total)} de{' '}
                {resposta.total.toLocaleString('pt-BR')}{' '}
                {resposta.total === 1 ? 'recibo encontrado' : 'recibos encontrados'}
              </p>
              <ResultsTable resultados={resposta.resultados} />
              <Pagination
                pagina={resposta.pagina}
                totalPaginas={resposta.total_paginas}
                aoMudarPagina={setPagina}
              />
            </div>
          )}
        </div>
      </main>

      <Footer ultimaSincronizacao={meta?.ultima_sincronizacao} />
    </div>
  )
}

export default App
