# Arquitetura técnica

Documento para quem for dar manutenção no código. Explica *como* as peças se
encaixam e *por que* algumas decisões não óbvias foram tomadas. Para
instalação, configuração e regras de negócio, ver [README.md](README.md).

## Visão geral

```
planilhas .xlsx (OneDrive)
        │  leitura (read-only)
        ▼
backend/app/sync.py  ──►  backend/app/db.py  ──►  db/recibos.db (SQLite)
   (run_sync.py OU                                       │
    POST /api/sync)                                      │  leitura via SQL
                                                           ▼
                                            backend/app/main.py (FastAPI)
                                                           │  JSON sobre HTTP
                                                           ▼
                                            frontend/ (React + Vite)
                                            servido como estático pelo
                                            próprio FastAPI em produção
```

`sync.executar()` é chamado de dois jeitos possíveis, sem automação hoje:

1. **`run_sync.py`** — linha de comando, processo à parte. Não há nenhum
   agendamento ativo no momento (removido deliberadamente — ver seção
   [Sincronização manual pela tela](#sincronização-manual-pela-tela-apisync)
   —, mas o script continua funcional caso um dia valha reativar).
2. **`POST /api/sync`** — disparado pelo botão "Atualizar dados" da tela,
   dentro do próprio processo `uvicorn` (via `BackgroundTasks`). É o
   caminho normal de uso hoje.

Como uma sincronização agora pode nascer *dentro* do processo web (não só
como processo batch externo), existe um lock (`threading.Lock` em
`main.py`) protegendo contra duas sincronizações simultâneas — ver detalhes
na seção abaixo. Isso não existia quando a única forma de sincronizar era
via `run_sync.py` isolado.

## Pipeline de sincronização (`backend/app/sync.py`)

`executar()` é o ponto de entrada, chamado por `run_sync.py`:

1. `descobrir_arquivos` — lista os `.xlsx` na pasta configurada
   (`config.pasta_origem`) cujo nome bate com o padrão `FLUXO DE CAIXA ...
   <ano> ... LIVE ...xlsx` (ver `_nome_valido`).
2. Para cada arquivo, `_ler_planilha` abre a aba `Livro` (via `openpyxl`
   read-only) e localiza onde os dados começam. Existem dois modos:
   - **Cabeçalho nomeado**: procura a linha cujos valores batem
     exatamente com `COLUNAS_ESPERADAS`.
   - **Fallback posicional**: se não achar o cabeçalho nomeado, procura o
     marcador `"Coluna2"` na 2ª célula de alguma linha e assume as colunas
     por posição fixa a partir dali (loga um aviso — isso indica planilha
     fora do padrão esperado, vale conferir manualmente).
3. `_aplicar_filtros` aplica as regras de negócio fixas (RN-01/RN-08,
   documentadas no README): conta/subconta, banco aceito, data válida.
   Linhas fora disso **nunca chegam ao banco** — não há flag ou coluna
   "excluído", elas simplesmente não são inseridas.
4. `_linhas_para_gravar` monta os dicts finais (inclui
   `cliente_normalizado`, usado depois para busca sem acento/maiúscula).
5. `db.gravar_carga_atomica` grava tudo de uma vez (ver próxima seção).

**Se um arquivo falhar ao ler/filtrar, ele é contado em `arquivos_ignorados`
e a sincronização continua com os demais** — um arquivo corrompido não
derruba a carga inteira. `run_sync.py` só retorna código de erro (1) se
`arquivos_processados == 0` ou se algo não tratado explodir.

## Carga atômica e por que o `id` de `recibos` não é estável

`db.gravar_carga_atomica` (`backend/app/db.py`) não faz `UPDATE`/`INSERT`
incremental. A cada sincronização ela:

1. Recria `recibos_tmp` do zero e insere todas as linhas lidas nesta rodada.
2. Dentro de uma única transação: `DROP TABLE recibos`, renomeia
   `recibos_tmp` → `recibos`, recria os índices, atualiza `meta`.

Isso garante que uma sincronização que falhe no meio não deixa o banco
consultável em estado parcial (o `recibos` antigo só é derrubado depois que
o novo já está pronto). **Efeito colateral importante**: o
`id INTEGER PRIMARY KEY AUTOINCREMENT` de `recibos` é recriado do zero a
cada carga — a mesma linha lógica pode ter um `id` diferente amanhã. Nunca
guarde referência a `recibos.id` fora de uma única requisição.

## Observações do usuário

Feature adicionada para o usuário anotar algo sobre um recibo direto na
tela de consulta (independente da coluna `OBS` que já vem da planilha).

Como o `id` de `recibos` não sobrevive a uma sincronização (seção acima),
a anotação não pode referenciar `recibos.id`. Em vez disso:

- `db.calcular_chave_recibo(cliente, data_pagamento, valor_centavos, banco,
  subconta, arquivo_origem)` gera um hash SHA-256 dos dados de origem da
  linha. Essa é a `chave` estável do recibo — enquanto os dados na planilha
  não mudarem, a chave é a mesma antes e depois de qualquer resync.
- A anotação fica numa tabela separada, `anotacoes (chave PRIMARY KEY,
  texto, atualizado_em)`, criada em `conectar()` (schema
  `SCHEMA_ANOTACOES`) — por isso **nunca** é afetada pelo drop/rename de
  `recibos` descrito acima.
- `db.buscar_recibos` calcula a `chave` de cada linha retornada e faz um
  lookup em lote em `anotacoes` (`_buscar_anotacoes`, uma query `IN (...)`
  só para as chaves da página atual — não escaneia a tabela toda).
- `db.salvar_anotacao(caminho_db, chave, texto)` faz upsert; texto vazio
  (após `strip()`) **deleta** a linha em vez de guardar string vazia.

**Limitação conhecida**: se a planilha tiver duas linhas com exatamente os
mesmos valores de cliente/data/valor/banco/subconta no mesmo arquivo, elas
geram a mesma `chave` e portanto compartilham a mesma anotação. Isso é
aceitável no volume atual de dados, mas é o primeiro lugar a olhar se
algum dia uma anotação "vazar" para o recibo errado. Solução, se
necessário: incluir a posição da linha na planilha como parte da chave (
exigiria expor esse dado desde `sync.py`).

A coluna original `recibos.obs` (vinda da planilha) continua existindo no
schema e sendo gravada pelo sync — só não é mais exposta pela API nem
mostrada na tela (removida deliberadamente da tela para simplificar; ver
histórico do `main.py`/`db.py` se precisar trazer de volta).

## API (`backend/app/main.py`)

Cinco rotas, sem autenticação (uso interno, rede local):

| Rota | Método | Descrição |
|---|---|---|
| `/api/recibos` | GET | Busca paginada. Query params: `cliente` (LIKE sobre `cliente_normalizado`, sem acento/case), `data` (igualdade exata, `YYYY-MM-DD`), `valor` (string decimal, convertida para centavos e comparada por igualdade — não é faixa), `pagina`, `tamanho_pagina`. Sem nenhum filtro preenchido, retorna resultado vazio (`sem_filtro: true`) em vez de escanear a tabela toda. |
| `/api/meta` | GET | Metadados da última sincronização (`meta` table): timestamp, contagens, duração. Usado só para exibir "última atualização" no rodapé. |
| `/api/recibos/observacao` | PUT | Body `{chave, texto}` → upsert/delete em `anotacoes`. Retorna `{chave, observacao}` com o texto já `strip()`ado. |
| `/api/sync` | POST | Dispara `sync.executar()` em background (ver seção abaixo). `409` se já houver uma sincronização em andamento. |
| `/api/sync/status` | GET | `{em_andamento, iniciado_em, concluido_em, erro}` — usado pelo front pra fazer polling até a sincronização terminar. |

Em produção, `main.py` também monta `frontend/dist` como estático na raiz
(`StaticFiles(..., html=True)`), então o mesmo processo uvicorn serve API e
tela na mesma porta. Em dev, o front roda separado via Vite (porta 5173) e
`vite.config.ts` faz proxy de `/api/*` para `127.0.0.1:8000`.

## Sincronização manual pela tela (`/api/sync`)

Botão "Atualizar dados" no rodapé — é o caminho normal de sincronização hoje
(não há agendamento automático ativo, ver [Visão geral](#visão-geral)).
Chama o mesmo `sync.executar()` que o `run_sync.py` usa, só que disparado
por HTTP.

Pontos que não são óbvios:

- **Roda em background, não bloqueia a requisição.** Uma sincronização leva
  ~90-120s (8 planilhas, ~22k linhas cada). `POST /api/sync` usa
  `BackgroundTasks` do FastAPI/Starlette — a função roda numa threadpool
  (não bloqueia o event loop), então outras requisições (busca, `/api/meta`)
  continuam sendo atendidas normalmente enquanto a sincronização roda.
- **Lock em memória (`threading.Lock`) impede duas sincronizações
  simultâneas.** `db.gravar_carga_atomica` não foi desenhada pra
  concorrência — duas execuções ao mesmo tempo escreveriam na mesma
  `recibos_tmp`. `_sync_lock.acquire(blocking=False)` no início de
  `disparar_sincronizacao` garante só uma por vez; uma segunda tentativa
  recebe `409`. O lock é liberado em `_executar_sync_em_background`
  (bloco `finally`), então mesmo se `sync.executar()` lançar exceção o
  lock não fica preso.
  **Limitação conhecida**: esse lock é por processo. Se um dia o uvicorn
  rodar com `--workers > 1` (múltiplos processos), cada worker teria seu
  próprio lock e a proteção furaria — hoje a app roda com um único worker,
  então não é um problema real, só um limite a lembrar se isso mudar.
  **Segunda limitação, mais real**: esse lock só protege sincronizações
  disparadas *pela tela*. Ele não sabe nada sobre uma execução manual de
  `python run_sync.py` rodando ao mesmo tempo num terminal à parte — são
  processos diferentes, sem lock compartilhado. Rodar `run_sync.py` e
  clicar em "Atualizar dados" ao mesmo tempo não é seguro. Na prática isso
  é raro (uso interno, poucas pessoas), mas se `run_sync.py` voltar a ser
  usado de forma automatizada (agendamento), evitar rodá-lo perto do
  horário em que alguém provavelmente clicaria o botão.
- **Front faz polling em `/api/sync/status`** (`Footer.tsx`, a cada 2s)
  até `em_andamento` virar `false`. Ao montar, o `Footer` já consulta o
  status uma vez — se outra pessoa já tiver disparado uma sincronização
  pela tela, o botão aparece "Sincronizando…" pra todo mundo que abrir a
  tela nesse meio-tempo, não só
  pra quem clicou.
- Quando a sincronização termina sem erro, o front chama `buscarMeta()` de
  novo (atualiza o rodapé) e reexecuta a busca atual via um contador
  (`gatilhoRecarga` em `App.tsx`) incluído nas dependências do `useEffect`
  de busca — assim os resultados na tela já refletem os dados novos sem
  precisar recarregar a página.

## Frontend

Stack: React 19 + TypeScript + Vite + Tailwind 4. Sem router (tela única) e
sem gerenciador de estado externo — tudo é `useState`/`useEffect` em
`App.tsx`.

```
App.tsx                  estado da busca (filtros, página, resposta, loading/erro)
├─ SearchFilters.tsx      inputs controlados de cliente/data/valor
├─ ResultsTable.tsx       tabela + edição inline de observação
├─ Pagination.tsx         anterior/próxima
├─ States.tsx             telas de estado vazio/carregando/erro/inicial
└─ Footer.tsx              "última sincronização" (via /api/meta)
```

### Fluxo de busca (`App.tsx`)

- `filtros` muda → `useEffect` com `setTimeout(350ms)` (debounce) dispara
  `buscarRecibos`. Um `AbortController` cancela a requisição anterior se o
  usuário digitar de novo antes da resposta chegar — evita race condition
  de resposta antiga sobrescrever a mais recente.
- Sem nenhum filtro preenchido, nem chama a API (mostra `EstadoInicial`
  direto) — evita ida ao backend só para descartar o resultado.
- `pagina` reseta para `1` sempre que os filtros mudam
  (`aoAlterarFiltros`).

### Edição de observação (`ResultsTable.tsx`)

`ObservacaoCell` é uma máquina de estados pequena, uma instância por linha:

- **Modo visualização** (padrão): texto atual + ícone de lápis; clicar
  entra em modo edição (`aoIniciarEdicao`, foca o input via
  `requestAnimationFrame` porque o input só existe no DOM depois do
  re-render).
- **Modo edição**: input + botão ✓ (confirmar) + botão ✕ (cancelar).
  `Enter` equivale a ✓, `Esc` equivale a ✕. Confirmar chama
  `salvarObservacao` (PUT); só sai do modo edição depois da resposta —
  se der erro, mostra "erro ao salvar" e permanece editável para o
  usuário tentar de novo.
- `useEffect([chave, valorInicial])` resincroniza o estado local sempre
  que a `chave` muda (ex.: trocou de página, ou o resultado da busca
  mudou) — sem isso, o React reaproveitaria o componente da linha anterior
  com texto errado (mesma posição na lista, `key` diferente por causa do
  `chave` no `key={recibo.chave}` do `<tr>`, mas o estado interno do
  input ainda precisa ser resetado explicitamente).
- Não há debounce/autosave enquanto digita — a escrita só acontece no
  clique/Enter, de propósito, para o usuário ter controle explícito sobre
  quando grava (pedido explícito do usuário nesta sessão, "mini botão
  para confirmar").

### Tipos e API (`frontend/src/lib/api.ts`)

`Recibo` é o contrato com o backend — se mudar o shape retornado por
`buscar_recibos` no `db.py`, atualizar essa interface junto (não há
geração automática de tipos a partir do backend).

## Onde mexer para tarefas comuns

- **Novo filtro de busca**: adicionar param em `listar_recibos` (main.py)
  → `buscar_recibos` (db.py, monta `condicoes`/`params`) → `FiltrosBusca` e
  `buscarRecibos` (api.ts) → input em `SearchFilters.tsx`.
- **Nova coluna exibida**: incluir no `SELECT` de `buscar_recibos`, no dict
  de `resultados`, na interface `Recibo` (api.ts) e no `<th>`/`<td>` de
  `ResultsTable.tsx`. Lembrar que colunas que não fazem parte da chave
  (`calcular_chave_recibo`) podem mudar sem invalidar anotações existentes;
  colunas que fazem parte dela (cliente, data, valor, banco, subconta,
  arquivo_origem) não devem ser alteradas em `sync.py` sem considerar que
  isso muda a `chave` e "perde" anotações já salvas para recibos existentes.
- **Novo campo editável pelo usuário** (estilo observação): seguir o
  padrão de `anotacoes` — tabela própria, chave pelo hash do recibo, nunca
  guardar em `recibos` diretamente (é recriada a cada sync).
- **Mudar regra de negócio da importação** (RN-01/RN-08 etc.): só em
  `sync.py` (`_aplicar_filtros`) + `config.ini`. Não há filtro equivalente
  aplicado na leitura (`db.buscar_recibos`) — o que entra em `recibos` já
  passou pelas regras.

## Coisas que podem surpreender

- `SCHEMA_ANOTACOES` é executado em todo `conectar()`, inclusive durante o
  sync. `CREATE TABLE IF NOT EXISTS` é barato, mas é por isso que a tabela
  de anotações "simplesmente existe" sem precisar de um passo de migração
  separado — se um dia isso virar `ALTER TABLE`, não vai ser mais
  idempotente da mesma forma, cuidado ao editar esse arquivo.
- Comparação de `valor` na busca é **igualdade exata em centavos**, não
  faixa. Buscar "150" não traz "150,50".
- `cliente_normalizado` remove acento e caixa (`unicodedata.normalize`);
  a busca por cliente é sempre `LIKE %termo%` sobre essa coluna, nunca
  sobre `cliente` original.
- Não há autenticação nem controle de concorrência entre usuários
  simultâneos editando a mesma observação — o último `PUT` vence.
