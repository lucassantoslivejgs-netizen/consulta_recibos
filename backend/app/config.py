"""Carregamento de configuração do sistema.

Lê o config.ini na raiz do projeto. Qualquer chave pode ser sobrescrita por
variável de ambiente CONSULTA_RECIBOS_<CHAVE_MAIUSCULA>, para permitir apontar
para caminhos diferentes em produção sem editar o arquivo versionado.
"""
from __future__ import annotations

import configparser
import os
from dataclasses import dataclass
from pathlib import Path

RAIZ_PROJETO = Path(__file__).resolve().parents[2]
CAMINHO_CONFIG = RAIZ_PROJETO / "config.ini"


def _valor(cfg: configparser.ConfigParser, secao: str, chave: str) -> str:
    env_key = f"CONSULTA_RECIBOS_{chave.upper()}"
    if env_key in os.environ:
        return os.environ[env_key]
    return cfg.get(secao, chave)


def _caminho_absoluto(valor: str) -> Path:
    caminho = Path(valor)
    if not caminho.is_absolute():
        caminho = RAIZ_PROJETO / caminho
    return caminho


@dataclass(frozen=True)
class Config:
    pasta_origem: Path
    ano: str
    aba: str
    conta_prefixo: str
    subconta_prefixos: tuple[str, ...]
    banco_aceito: str
    caminho_db: Path
    raiz_projeto: Path = RAIZ_PROJETO


def carregar_config() -> Config:
    cfg = configparser.ConfigParser()
    if not CAMINHO_CONFIG.exists():
        raise FileNotFoundError(f"Arquivo de configuração não encontrado: {CAMINHO_CONFIG}")
    cfg.read(CAMINHO_CONFIG, encoding="utf-8")

    subcontas = tuple(
        p.strip() for p in _valor(cfg, "filtros", "subconta_prefixos").split(",") if p.strip()
    )

    return Config(
        pasta_origem=_caminho_absoluto(_valor(cfg, "origem", "pasta_origem")),
        ano=_valor(cfg, "origem", "ano").strip(),
        aba=_valor(cfg, "origem", "aba").strip(),
        conta_prefixo=_valor(cfg, "filtros", "conta_prefixo").strip(),
        subconta_prefixos=subcontas,
        banco_aceito=_valor(cfg, "banco", "banco_aceito").strip(),
        caminho_db=_caminho_absoluto(_valor(cfg, "banco_dados", "caminho_db")),
    )
