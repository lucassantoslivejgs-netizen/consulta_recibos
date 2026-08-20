const formatadorMoeda = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
})

export function formatarMoeda(valor: number): string {
  return formatadorMoeda.format(valor)
}

/** Converte "YYYY-MM-DD" (formato do banco) para "dd/mm/aaaa". */
export function formatarDataBR(dataIso: string): string {
  const [ano, mes, dia] = dataIso.split('-')
  return `${dia}/${mes}/${ano}`
}

export function formatarDataHora(iso: string | null): string {
  if (!iso) return '—'
  const data = new Date(iso)
  if (Number.isNaN(data.getTime())) return '—'
  return data.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

/**
 * Máscara de valor em reais no estilo "digitação por centavos": o usuário
 * digita apenas números e o cursor sempre representa centavos (ex.: "15000"
 * vira "150,00"). Retorna o texto formatado para exibição no input.
 */
export function mascararValorDigitado(digitosBrutos: string): string {
  const digitos = digitosBrutos.replace(/\D/g, '')
  if (!digitos) return ''
  const centavos = parseInt(digitos, 10)
  const reais = centavos / 100
  return reais.toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

/** Converte o texto mascarado (ex.: "150,00") para o formato que a API espera. */
export function valorMascaradoParaQuery(valorFormatado: string): string {
  return valorFormatado.replace(/\./g, '').replace(',', '.')
}
