"""API FastAPI: consulta de recibos e metadados de sincronização.

Em produção, também serve o build estático do front-end (frontend/dist),
para que a aplicação inteira rode numa única porta.
"""
from __future__ import annotations

from pathlib import Path
from typing import Optional

from fastapi import FastAPI, Query
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

from . import db
from .config import carregar_config

app = FastAPI(title="Consulta de Recibos - LIVE Roupas Esportivas")

cfg = carregar_config()


def _parse_valor(valor: str) -> Optional[int]:
    """Converte string decimal (vírgula ou ponto) em centavos."""
    if not valor:
        return None
    normalizado = valor.strip().replace(".", "").replace(",", ".") if "," in valor else valor.strip()
    try:
        return round(float(normalizado) * 100)
    except ValueError:
        return None


@app.get("/api/recibos")
def listar_recibos(
    cliente: Optional[str] = Query(default=None),
    data: Optional[str] = Query(default=None),
    valor: Optional[str] = Query(default=None),
    pagina: int = Query(default=1, ge=1),
    tamanho_pagina: int = Query(default=db.TAMANHO_PAGINA_PADRAO, ge=1, le=100),
):
    valor_centavos = _parse_valor(valor) if valor else None
    return db.buscar_recibos(
        cfg.caminho_db,
        cliente=cliente,
        data=data,
        valor_centavos=valor_centavos,
        pagina=pagina,
        tamanho_pagina=tamanho_pagina,
    )


@app.get("/api/meta")
def obter_meta():
    meta = db.obter_meta(cfg.caminho_db)
    return meta or {"ultima_sincronizacao": None}


class ObservacaoEntrada(BaseModel):
    chave: str
    texto: str


@app.put("/api/recibos/observacao")
def salvar_observacao(entrada: ObservacaoEntrada):
    db.salvar_anotacao(cfg.caminho_db, entrada.chave, entrada.texto)
    return {"chave": entrada.chave, "observacao": entrada.texto.strip()}


_frontend_dist = cfg.raiz_projeto / "frontend" / "dist"
if _frontend_dist.exists():
    app.mount("/", StaticFiles(directory=_frontend_dist, html=True), name="frontend")
