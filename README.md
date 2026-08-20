# Consulta de Recibos — LIVE

Sistema para qualquer colaborador confirmar recibos de pagamento de clientes
sem precisar acionar o Setor Financeiro. Um sincronizador lê as planilhas
mensais "FLUXO DE CAIXA" e consolida os recibos num banco SQLite; uma tela web
permite buscar por cliente, data e valor.

## Como funciona

1. **Sincronizador** (`run_sync.py`): varre a pasta configurada, lê a aba
   `Livro` de cada planilha `FLUXO DE CAIXA ... 2026 ... LIVE.xlsx`, aplica os
   filtros de negócio (só recebimento de clientes, banco ITAU 14444) e grava
   tudo em `db/recibos.db`. As planilhas originais nunca são alteradas.
2. **API + tela web** (`backend/app/main.py`): FastAPI expõe `/api/recibos` e
   `/api/meta`; em produção também serve o build do front-end (`frontend/dist`)
   numa porta só.

## Instalação

Pré-requisitos: Python 3.11+ e Node.js 18+.

```powershell
# Backend
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt

# Frontend
cd frontend
npm install
npm run build
cd ..
```

## Configuração (`config.ini`)

Todas as configurações ficam em `config.ini` na raiz do projeto. Qualquer
chave pode ser sobrescrita por variável de ambiente
`CONSULTA_RECIBOS_<NOME_DA_CHAVE_EM_MAIUSCULO>`, o que é útil para apontar
para o caminho real do OneDrive em produção sem editar o arquivo versionado.

O valor padrão de `pasta_origem` aponta para a cópia local de planilhas já
presente no repositório (`db/FLUXO DE CAIXA LIVE ROUPAS 2026/`), útil para
testar a instalação. **Em produção**, troque para o caminho real, por
exemplo editando `config.ini`:

```ini
[origem]
pasta_origem = C:\Users\<usuario>\OneDrive - LIVE ROUPAS ESPORTIVAS\Setor Financeiro - General\EXTRATO BRADESCO\FLUXO DE CAIXA LIVE ROUPAS 2026
```

ou, sem editar o arquivo, definindo a variável de ambiente antes de rodar:

```powershell
$env:CONSULTA_RECIBOS_PASTA_ORIGEM = "C:\Users\<usuario>\OneDrive - LIVE ROUPAS ESPORTIVAS\Setor Financeiro - General\EXTRATO BRADESCO\FLUXO DE CAIXA LIVE ROUPAS 2026"
```

**Importante:** na máquina de produção, a pasta do OneDrive precisa estar com
"Sempre manter neste dispositivo" ativado (clique direito na pasta no
Explorer), para evitar download sob demanda durante a sincronização.

## Rodando a sincronização

```powershell
python run_sync.py
```

Grava um log em `backend/logs/sync_AAAAMMDD_HHMMSS.log` com: arquivos
encontrados/ignorados, linhas lidas e após cada filtro por arquivo, bancos
distintos encontrados (para conferir que nenhum recibo válido está sendo
perdido por grafia divergente do banco) e erros. A carga é atômica: se a
sincronização falhar, o banco anterior permanece intacto.

## Agendamento (Windows)

Depois de validar que `python run_sync.py` funciona na máquina de produção,
registre a tarefa diária (PowerShell como Administrador):

```powershell
powershell -ExecutionPolicy Bypass -File scripts\agendar_tarefa.ps1
```

Isso cria a tarefa `ConsultaRecibos-Sincronizacao`, agendada para rodar todo
dia às 07:00, com "executar assim que possível" habilitado (caso a máquina
esteja desligada no horário). Para testar imediatamente:

```powershell
Start-ScheduledTask -TaskName 'ConsultaRecibos-Sincronizacao'
```

## Rodando a aplicação web

**Produção (uma porta só, serve o build do front-end):**

```powershell
.venv\Scripts\activate
uvicorn backend.app.main:app --host 0.0.0.0 --port 8000
```

Acesse `http://<ip-da-maquina>:8000` de qualquer computador na rede interna.

**Desenvolvimento (hot reload do front-end):**

```powershell
# terminal 1
.venv\Scripts\activate
uvicorn backend.app.main:app --reload --port 8000

# terminal 2
cd frontend
npm run dev
```

Acesse `http://localhost:5173` — o Vite já está configurado para
redirecionar chamadas `/api/*` para `localhost:8000`.

## Estrutura do projeto

```
config.ini              configuração (pasta de origem, códigos de conta, banco)
requirements.txt        dependências Python
run_sync.py             entrypoint da sincronização (usado pelo Agendador de Tarefas)
db/
  FLUXO DE CAIXA .../   planilhas de origem (somente leitura)
  recibos.db            banco gerado pela sincronização
backend/app/
  config.py             leitura de config.ini + variáveis de ambiente
  db.py                 schema SQLite, carga atômica, consultas
  sync.py               leitura das planilhas, filtros de negócio
  main.py               API FastAPI + serve o build do front-end
frontend/                Vite + React + TypeScript + Tailwind
scripts/
  agendar_tarefa.ps1     registra a tarefa agendada no Windows
```

## Regras de negócio aplicadas na importação

- Só entram no banco lançamentos com `CONTA` iniciando em `1000` **e**
  `SUBCONTA` iniciando em `1076` ou `1050` **e** `Banco` igual a `ITAU 14444`
  (comparação tolerante a maiúsculas/espaços). Esses filtros são fixos, sem
  tela de configuração, e são aplicados **na importação** — nenhum lançamento
  fora deles chega a existir no banco consultável pela tela.
- Linhas cuja data de pagamento não pôde ser interpretada são descartadas
  (contadas no log de sincronização).
- Valores são sempre gravados e exibidos positivos.

## Fora de escopo (v1)

Exportação/impressão de resultados, login individual, edição de dados, outras
empresas além da LIVE, outros anos além de 2026, busca por intervalo de datas
ou faixa de valores.
