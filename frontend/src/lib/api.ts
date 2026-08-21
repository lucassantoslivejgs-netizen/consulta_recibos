export interface Recibo {
  cliente: string
  data_pagamento: string
  valor: number
  chave: string
  observacao: string
}

export interface RespostaRecibos {
  total: number
  pagina: number
  tamanho_pagina: number
  total_paginas: number
  resultados: Recibo[]
  sem_filtro: boolean
}

export interface Meta {
  ultima_sincronizacao: string | null
  arquivos_processados?: number
  arquivos_ignorados?: number
  linhas_importadas?: number
  duracao_segundos?: number
}

export interface FiltrosBusca {
  cliente: string
  data: string
  valorQuery: string
  pagina: number
}

export async function buscarRecibos(
  filtros: FiltrosBusca,
  signal?: AbortSignal,
): Promise<RespostaRecibos> {
  const params = new URLSearchParams()
  if (filtros.cliente) params.set('cliente', filtros.cliente)
  if (filtros.data) params.set('data', filtros.data)
  if (filtros.valorQuery) params.set('valor', filtros.valorQuery)
  params.set('pagina', String(filtros.pagina))

  const resp = await fetch(`/api/recibos?${params.toString()}`, { signal })
  if (!resp.ok) {
    throw new Error(`Falha na busca (HTTP ${resp.status})`)
  }
  return resp.json()
}

export async function buscarMeta(): Promise<Meta> {
  const resp = await fetch('/api/meta')
  if (!resp.ok) {
    throw new Error(`Falha ao obter metadados (HTTP ${resp.status})`)
  }
  return resp.json()
}

export async function salvarObservacao(chave: string, texto: string): Promise<void> {
  const resp = await fetch('/api/recibos/observacao', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chave, texto }),
  })
  if (!resp.ok) {
    throw new Error(`Falha ao salvar observação (HTTP ${resp.status})`)
  }
}

export interface StatusSincronizacao {
  em_andamento: boolean
  iniciado_em: string | null
  concluido_em: string | null
  erro: string | null
}

/** Retorna false sem lançar erro se já houver uma sincronização em andamento (HTTP 409). */
export async function dispararSincronizacao(): Promise<boolean> {
  const resp = await fetch('/api/sync', { method: 'POST' })
  if (resp.status === 409) return false
  if (!resp.ok) {
    throw new Error(`Falha ao iniciar sincronização (HTTP ${resp.status})`)
  }
  return true
}

export async function consultarStatusSincronizacao(): Promise<StatusSincronizacao> {
  const resp = await fetch('/api/sync/status')
  if (!resp.ok) {
    throw new Error(`Falha ao consultar status da sincronização (HTTP ${resp.status})`)
  }
  return resp.json()
}
