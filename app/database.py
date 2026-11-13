"""Conexão com o banco de dados SQLite."""
import os
import sqlite3
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent
CAMINHO_PADRAO = Path(os.environ.get("DATABASE_PATH", str(RAIZ / "database" / "salao.db")))


class Database:
    """Encapsula a conexão e as operações básicas no banco."""

    def __init__(self, caminho=CAMINHO_PADRAO):
        self._caminho = str(caminho)
        self._conexao = None

    def conectar(self):
        if self._conexao is None:
            Path(self._caminho).parent.mkdir(parents=True, exist_ok=True)
            self._conexao = sqlite3.connect(self._caminho)
            self._conexao.row_factory = sqlite3.Row
            self._conexao.execute("PRAGMA foreign_keys = ON")
        return self._conexao

    def executar(self, sql, params=()):
        """Executa INSERT/UPDATE/DELETE e devolve o id da última linha."""
        conn = self.conectar()
        cursor = conn.execute(sql, params)
        conn.commit()
        return cursor.lastrowid

    def consultar(self, sql, params=()):
        """Executa SELECT e devolve uma lista de linhas."""
        return self.conectar().execute(sql, params).fetchall()

    def executar_script(self, script):
        conn = self.conectar()
        conn.executescript(script)
        conn.commit()

    def fechar(self):
        if self._conexao is not None:
            self._conexao.close()
            self._conexao = None

    def __enter__(self):
        self.conectar()
        return self

    def __exit__(self, *args):
        self.fechar()
