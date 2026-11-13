"""Inicia o servidor Flask para desenvolvimento local."""
import os

from app import create_app
from app.database import CAMINHO_PADRAO

app = create_app()

if __name__ == "__main__":
    if not CAMINHO_PADRAO.exists():
        raise SystemExit("Banco não encontrado. Rode primeiro: python init_db.py")
    porta = int(os.environ.get("PORT", "5000"))
    debug = os.environ.get("FLASK_DEBUG", "0") == "1"
    app.run(host="0.0.0.0", port=porta, debug=debug)
