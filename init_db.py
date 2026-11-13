"""Inicializa o banco sem apagar dados existentes por padrão.

Uso: python init_db.py            (cria se ainda não existir)
     python init_db.py --reset    (apaga e recria os dados de demonstração)
"""
import sys
from pathlib import Path

from app.database import Database, CAMINHO_PADRAO
from app.dao import AgendamentoDAO

RAIZ = Path(__file__).resolve().parent


def main():
    resetar = "--reset" in sys.argv
    if CAMINHO_PADRAO.exists() and not resetar:
        print(f"Banco já existe: {CAMINHO_PADRAO}")
        print("Nada foi apagado. Use 'python init_db.py --reset' para recriar os dados de exemplo.")
        return

    if CAMINHO_PADRAO.exists():
        CAMINHO_PADRAO.unlink()

    with Database() as db:
        db.executar_script((RAIZ / "database" / "schema.sql").read_text(encoding="utf-8"))
        db.executar_script((RAIZ / "database" / "seed.sql").read_text(encoding="utf-8"))

        print(f"Banco criado em: {CAMINHO_PADRAO}\n")
        print("Agendamentos cadastrados:")
        for a in AgendamentoDAO(db).listar_detalhado():
            print(f"  #{a['id']} {a['data_hora']} | {a['cliente']} | "
                  f"{a['servico']} com {a['profissional']} | {a['status']}")


if __name__ == "__main__":
    main()
