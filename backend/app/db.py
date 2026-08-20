"""Acesso ao SQLite: schema, carga atômica e consultas.

Compartilhado entre o sincronizador (sync.py) e a API (main.py).
"""
from __future__ import annotations

import hashlib
import sqlite3
import unicodedata
from datetime import datetime
from pathlib import Path
from typing import Any, Iterable

SCHEMA_RECIBOS = """
CREATE TABLE {tabela} (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    cliente TEXT NOT NULL,
    cliente_normalizado TEXT NOT NULL,
    data_pagamento TEXT NOT NULL,
    valor_centavos INTEGER NOT NULL,
    banco TEXT NOT NULL,
    subconta TEXT NOT NULL,
    obs TEXT,
    arquivo_origem TEXT NOT NULL
)
"""

SCHEMA_META = """
CREATE TABLE IF NOT EXISTS meta (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    ultima_sincronizacao TEXT NOT NULL,
    arquivos_processados INTEGER NOT NULL,
    arquivos_ignorados INTEGER NOT NULL,
    linhas_importadas INTEGER NOT NULL,
    duracao_segundos REAL NOT NULL
)
"""

# Anotações digitadas pelo próprio usuário da tela de consulta. Fica numa
# tabela separada (não afetada pela recarga atômica de `recibos`) e é
# referenciada por uma chave estável derivada dos dados de origem do recibo,
# já que o id autoincrement de `recibos` é recriado a cada sincronização.
SCHEMA_ANOTACOES = """
CREATE TABLE IF NOT EXISTS anotacoes (
    chave TEXT PRIMARY KEY,
    texto TEXT NOT NULL,
    atualizado_em TEXT NOT NULL
)
"""


def calcular_chave_recibo(
    cliente: str,
    data_pagamento: str,
    valor_centavos: int,
    banco: str,
    subconta: str,
    arquivo_origem: str,
) -> str:
    """Identificador estável de um recibo, baseado nos dados de origem.

    Não usa o id autoincrement de `recibos` porque essa tabela é totalmente
    recriada a cada sincronização (ver gravar_carga_atomica).
    """
    bruto = "|".join(
        [cliente, data_pagamento, str(valor_centavos), banco, subconta, arquivo_origem]
    )
    return hashlib.sha256(bruto.encode("utf-8")).hexdigest()


def normalizar_texto(texto: str) -> str:
    """Maiúsculas, sem acento. Usado para cliente_normalizado e para o termo de busca."""
    if texto is None:
        return ""
    sem_acento = unicodedata.normalize("NFKD", texto).encode("ascii", "ignore").decode("ascii")
    return sem_acento.upper().strip()


def conectar(caminho_db: Path) -> sqlite3.Connection:
    caminho_db.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(caminho_db)
    conn.execute("PRAGMA foreign_keys = OFF")
    conn.execute(SCHEMA_ANOTACOES)
    return conn


def gravar_carga_atomica(
    caminho_db: Path,
    linhas: Iterable[dict[str, Any]],
    stats: dict[str, Any],
) -> int:
    """Grava recibos + meta de forma atômica.
    Escreve tudo em uma tabela temporária, indexa, e só então substitui a
    tabela definitiva dentro de uma única transação. Se qualquer etapa falhar
    antes do commit, o banco anterior permanece intacto.
    Retorna a quantidade de linhas gravadas.
    """
    conn = conectar(caminho_db)
    total = 0
    try:
        conn.execute("DROP TABLE IF EXISTS recibos_tmp")
        conn.execute(SCHEMA_RECIBOS.format(tabela="recibos_tmp"))

        insert_sql = """
            INSERT INTO recibos_tmp
                (cliente, cliente_normalizado, data_pagamento, valor_centavos,
                 banco, subconta, obs, arquivo_origem)
            VALUES (:cliente, :cliente_normalizado, :data_pagamento, :valor_centavos,
                    :banco, :subconta, :obs, :arquivo_origem)
        """
        registros = list(linhas)
        if registros:
            conn.executemany(insert_sql, registros)
        total = len(registros)

        conn.execute(SCHEMA_META)

        with conn:
            conn.execute("DROP TABLE IF EXISTS recibos")
            conn.execute("ALTER TABLE recibos_tmp RENAME TO recibos")
            # Índices são criados depois do rename (mais rápido que indexar
            # incrementalmente durante o INSERT, e evita nomes "_tmp" presos
            # à tabela definitiva).
            conn.execute("CREATE INDEX idx_cliente_norm ON recibos(cliente_normalizado)")
            conn.execute("CREATE INDEX idx_data ON recibos(data_pagamento)")
            conn.execute("CREATE INDEX idx_valor ON recibos(valor_centavos)")
            conn.execute(
                """
                INSERT INTO meta (id, ultima_sincronizacao, arquivos_processados,
                                   arquivos_ignorados, linhas_importadas, duracao_segundos)
                VALUES (1, :ultima_sincronizacao, :arquivos_processados,
                        :arquivos_ignorados, :linhas_importadas, :duracao_segundos)
                ON CONFLICT(id) DO UPDATE SET
                    ultima_sincronizacao = excluded.ultima_sincronizacao,
                    arquivos_processados = excluded.arquivos_processados,
                    arquivos_ignorados = excluded.arquivos_ignorados,
                    linhas_importadas = excluded.linhas_importadas,
                    duracao_segundos = excluded.duracao_segundos
                """,
                {
                    "ultima_sincronizacao": datetime.now().isoformat(timespec="seconds"),
                    **stats,
                },
            )
        return total
    finally:
        conn.close()


TAMANHO_PAGINA_PADRAO = 25


def _resposta_vazia(pagina: int, tamanho_pagina: int, sem_filtro: bool) -> dict[str, Any]:
    return {
        "total": 0,
        "pagina": pagina,
        "tamanho_pagina": tamanho_pagina,
        "total_paginas": 0,
        "resultados": [],
        "sem_filtro": sem_filtro,
    }


def buscar_recibos(
    caminho_db: Path,
    cliente: str | None = None,
    data: str | None = None,
    valor_centavos: int | None = None,
    pagina: int = 1,
    tamanho_pagina: int = TAMANHO_PAGINA_PADRAO,
) -> dict[str, Any]:
    pagina = max(pagina, 1)

    if not caminho_db.exists():
        return _resposta_vazia(pagina, tamanho_pagina, sem_filtro=True)

    if not cliente and not data and valor_centavos is None:
        return _resposta_vazia(pagina, tamanho_pagina, sem_filtro=True)

    condicoes = []
    params: dict[str, Any] = {}

    if cliente:
        condicoes.append("cliente_normalizado LIKE :cliente")
        params["cliente"] = f"%{normalizar_texto(cliente)}%"
    if data:
        condicoes.append("data_pagamento = :data")
        params["data"] = data
    if valor_centavos is not None:
        condicoes.append("valor_centavos = :valor")
        params["valor"] = valor_centavos

    where = " AND ".join(condicoes) if condicoes else "1=1"

    conn = conectar(caminho_db)
    conn.row_factory = sqlite3.Row
    try:
        total = conn.execute(
            f"SELECT COUNT(*) AS n FROM recibos WHERE {where}", params
        ).fetchone()["n"]

        total_paginas = max((total + tamanho_pagina - 1) // tamanho_pagina, 1)
        pagina = min(pagina, total_paginas)
        offset = (pagina - 1) * tamanho_pagina

        linhas = conn.execute(
            f"""
            SELECT cliente, data_pagamento, valor_centavos, banco, subconta, arquivo_origem
            FROM recibos
            WHERE {where}
            ORDER BY data_pagamento DESC, id DESC
            LIMIT :limite OFFSET :offset
            """,
            {**params, "limite": tamanho_pagina, "offset": offset},
        ).fetchall()

        chaves = [
            calcular_chave_recibo(
                linha["cliente"],
                linha["data_pagamento"],
                linha["valor_centavos"],
                linha["banco"],
                linha["subconta"],
                linha["arquivo_origem"],
            )
            for linha in linhas
        ]
        anotacoes = _buscar_anotacoes(conn, chaves)

        resultados = [
            {
                "cliente": linha["cliente"],
                "data_pagamento": linha["data_pagamento"],
                "valor": round(linha["valor_centavos"] / 100, 2),
                "chave": chave,
                "observacao": anotacoes.get(chave, ""),
            }
            for linha, chave in zip(linhas, chaves)
        ]

        return {
            "total": total,
            "pagina": pagina,
            "tamanho_pagina": tamanho_pagina,
            "total_paginas": total_paginas,
            "resultados": resultados,
            "sem_filtro": False,
        }
    finally:
        conn.close()


def _buscar_anotacoes(conn: sqlite3.Connection, chaves: list[str]) -> dict[str, str]:
    if not chaves:
        return {}
    marcadores = ",".join("?" * len(chaves))
    linhas = conn.execute(
        f"SELECT chave, texto FROM anotacoes WHERE chave IN ({marcadores})", chaves
    ).fetchall()
    return {linha["chave"]: linha["texto"] for linha in linhas}


def salvar_anotacao(caminho_db: Path, chave: str, texto: str) -> None:
    """Cria/atualiza a observação do usuário para um recibo. Texto vazio remove a anotação."""
    conn = conectar(caminho_db)
    try:
        with conn:
            if texto.strip():
                conn.execute(
                    """
                    INSERT INTO anotacoes (chave, texto, atualizado_em)
                    VALUES (:chave, :texto, :atualizado_em)
                    ON CONFLICT(chave) DO UPDATE SET
                        texto = excluded.texto,
                        atualizado_em = excluded.atualizado_em
                    """,
                    {
                        "chave": chave,
                        "texto": texto.strip(),
                        "atualizado_em": datetime.now().isoformat(timespec="seconds"),
                    },
                )
            else:
                conn.execute("DELETE FROM anotacoes WHERE chave = :chave", {"chave": chave})
    finally:
        conn.close()


def obter_meta(caminho_db: Path) -> dict[str, Any] | None:
    if not caminho_db.exists():
        return None
    conn = conectar(caminho_db)
    conn.row_factory = sqlite3.Row
    try:
        linha = conn.execute(
            "SELECT ultima_sincronizacao, arquivos_processados, arquivos_ignorados, "
            "linhas_importadas, duracao_segundos FROM meta WHERE id = 1"
        ).fetchone()
        return dict(linha) if linha else None
    except sqlite3.OperationalError:
        return None
    finally:
        conn.close()
