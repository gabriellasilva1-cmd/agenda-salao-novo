"""Aplicação Flask (padrão application factory)."""
from pathlib import Path

from flask import Flask, g, jsonify, send_from_directory

from app.database import CAMINHO_PADRAO, Database
from app.models import Conflito, ErroValidacao, NaoEncontrado


def get_db():
    """Uma conexão por requisição (o SQLite não aceita compartilhar entre threads)."""
    from flask import current_app
    if "db" not in g:
        g.db = Database(current_app.config["DATABASE"])
        g.db.conectar()
    return g.db


PASTA_FRONT = Path(__file__).resolve().parent.parent / "static"


def create_app(caminho_banco=CAMINHO_PADRAO):
    app = Flask(__name__, static_folder=str(PASTA_FRONT), static_url_path="/static")
    app.config["DATABASE"] = str(caminho_banco)
    app.json.ensure_ascii = False
    app.json.sort_keys = False

    @app.teardown_appcontext
    def fechar_banco(_erro):
        db = g.pop("db", None)
        if db is not None:
            db.fechar()

    @app.errorhandler(ErroValidacao)
    def _validacao(e):
        return jsonify(erro=str(e)), 400

    @app.errorhandler(NaoEncontrado)
    def _nao_encontrado(e):
        return jsonify(erro=str(e.args[0])), 404

    @app.errorhandler(Conflito)
    def _conflito(e):
        return jsonify(erro=str(e)), 409

    @app.errorhandler(404)
    def _rota_inexistente(_e):
        return jsonify(erro="Rota não encontrada."), 404

    @app.errorhandler(405)
    def _metodo(_e):
        return jsonify(erro="Método não permitido para esta rota."), 405

    @app.get("/")
    def pagina_inicial():
        """Site do salão (HTML/CSS/JS), que consome a API via Fetch."""
        return send_from_directory(app.static_folder, "index.html")

    @app.get("/painel")
    def painel():
        """Painel de gestão: agenda, clientes, profissionais e serviços."""
        return send_from_directory(app.static_folder, "painel.html")

    from app.routes import api
    app.register_blueprint(api)
    return app
