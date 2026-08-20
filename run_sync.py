"""Entrypoint de linha de comando para a sincronização diária.

Uso: python run_sync.py
Pensado para ser chamado pelo Agendador de Tarefas do Windows
(ver scripts/agendar_tarefa.ps1). Código de saída != 0 em caso de falha.
"""
from __future__ import annotations

import logging
import sys
from datetime import datetime
from pathlib import Path

RAIZ_PROJETO = Path(__file__).resolve().parent
sys.path.insert(0, str(RAIZ_PROJETO))

from backend.app import sync  # noqa: E402


def _configurar_logging() -> Path:
    pasta_logs = RAIZ_PROJETO / "backend" / "logs"
    pasta_logs.mkdir(parents=True, exist_ok=True)
    arquivo_log = pasta_logs / f"sync_{datetime.now():%Y%m%d_%H%M%S}.log"

    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
        handlers=[
            logging.FileHandler(arquivo_log, encoding="utf-8"),
            logging.StreamHandler(sys.stdout),
        ],
    )
    return arquivo_log


def main() -> int:
    arquivo_log = _configurar_logging()
    logger = logging.getLogger("consulta_recibos.run_sync")
    logger.info("Log desta execução: %s", arquivo_log)

    try:
        stats = sync.executar()
    except Exception:
        logger.exception("Sincronização falhou com erro não tratado.")
        return 1

    if stats["arquivos_processados"] == 0:
        logger.error("Nenhum arquivo foi processado com sucesso.")
        return 1

    return 0


if __name__ == "__main__":
    sys.exit(main())
