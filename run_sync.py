"""Entrypoint de linha de comando para a sincronização diária.

Uso: python run_sync.py
Pensado para ser chamado pelo Agendador de Tarefas do Windows
(ver scripts/agendar_tarefa.ps1). Código de saída != 0 em caso de falha.
"""
from __future__ import annotations

import logging
import sys
from pathlib import Path

RAIZ_PROJETO = Path(__file__).resolve().parent
sys.path.insert(0, str(RAIZ_PROJETO))

from backend.app import sync  # noqa: E402
from backend.app.logging_config import configurar_logging  # noqa: E402


def main() -> int:
    arquivo_log = configurar_logging("sync")
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
