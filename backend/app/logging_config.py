"""Configuração de logging compartilhada entre run_sync.py (CLI) e main.py (web).

Um arquivo de log por processo iniciado, em backend/logs/.
"""
from __future__ import annotations

import logging
import sys
from datetime import datetime
from pathlib import Path

RAIZ_PROJETO = Path(__file__).resolve().parents[2]


def configurar_logging(prefixo: str) -> Path:
    pasta_logs = RAIZ_PROJETO / "backend" / "logs"
    pasta_logs.mkdir(parents=True, exist_ok=True)
    arquivo_log = pasta_logs / f"{prefixo}_{datetime.now():%Y%m%d_%H%M%S}.log"

    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
        handlers=[
            logging.FileHandler(arquivo_log, encoding="utf-8"),
            logging.StreamHandler(sys.stdout),
        ],
    )
    return arquivo_log
