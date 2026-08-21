"""API FastAPI: consulta de recibos e metadados de sincronização.

Em produção, também serve o build estático do front-end (frontend/dist),
para que a aplicação inteira rode numa única porta.
"""
from __future__ import annotations

import logging
import threading
from datetime import datetime
from typing import Optional

from fastapi import BackgroundTasks, FastAPI, HTTPException, Query
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

from . import db, sync
from .config import carregar_config
from .logging_config import configurar_logging

configurar_logging("web")
logger = logging.getLogger("consulta_recibos.main")

app = FastAPI(title="Consulta de Recibos - LIVE Roupas Esportivas")

cfg = carregar_config()

_sync_lock = threading.Lock()
_sync_estado: dict[str, object] = {
    "em_andamento": False,
    "iniciado_em": None,
    "concluido_em": None,
    "erro": None,
}


def _executar_sync_em_background() -> None:
    try:
        sync.executar()
        _sync_estado["erro"] = None
    except Exception as e:  # noqa: BLE001 - queremos capturar qualquer falha e expor na API
        logger.exception("Sincronização manual (via tela) falhou.")
        _sync_estado["erro"] = str(e)
    finally:
        _sync_estado["em_andamento"] = False
        _sync_estado["concluido_em"] = datetime.now().isoformat(timespec="seconds")
        _sync_lock.release()


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


@app.post("/api/sync")
def disparar_sincronizacao(background_tasks: BackgroundTasks):
    """Dispara a sincronização (mesmo pipeline do run_sync.py) em segundo plano.

    Só uma sincronização por vez: se já tiver uma em andamento (agendada ou
    disparada por outra pessoa na tela), retorna 409 em vez de rodar duas
    concorrentes (a carga atômica em db.py não foi desenhada pra isso).
    """
    if not _sync_lock.acquire(blocking=False):
        raise HTTPException(status_code=409, detail="Sincronização já em andamento.")

    _sync_estado.update(
        {
            "em_andamento": True,
            "iniciado_em": datetime.now().isoformat(timespec="seconds"),
            "erro": None,
        }
    )
    background_tasks.add_task(_executar_sync_em_background)
    return dict(_sync_estado)


@app.get("/api/sync/status")
def status_sincronizacao():
    return dict(_sync_estado)


_frontend_dist = cfg.raiz_projeto / "frontend" / "dist"
if _frontend_dist.exists():
    app.mount("/", StaticFiles(directory=_frontend_dist, html=True), name="frontend")
