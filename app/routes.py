"""Rotas da API (JSON). O front-end da Etapa 3 vai consumir estas rotas."""
from datetime import datetime

from flask import Blueprint, jsonify, request

from app import get_db
from app.dao import AgendamentoDAO, ClienteDAO, ProfissionalDAO, ServicoDAO
from app.models import (STATUS_VALIDOS, Agendamento, Cliente, ErroValidacao,
                        Profissional, Servico)

api = Blueprint("api", __name__, url_prefix="/api")


def _corpo_json():
    dados = request.get_json(silent=True)
    if not isinstance(dados, dict):
        raise ErroValidacao("Envie os dados em JSON (objeto) no corpo da requisição.")
    return dados


def _inteiro_opcional(nome):
    valor = request.args.get(nome)
    if valor is None or valor == "":
        return None
    try:
        return int(valor)
    except ValueError:
        raise ErroValidacao(f"O parâmetro '{nome}' deve ser um número inteiro.")


def _crud(caminho, DAO, Modelo, com_listagem=True):
    """Registra GET/POST na coleção e GET/PUT/DELETE no item, para um recurso."""

    def listar():
        return jsonify([x.to_dict() for x in DAO(get_db()).listar()])

    def criar():
        novo = DAO(get_db()).criar(Modelo.de_dict(_corpo_json()))
        return jsonify(novo.to_dict()), 201

    def buscar(id):
        return jsonify(DAO(get_db()).buscar(id).to_dict())

    def atualizar(id):
        dao = DAO(get_db())
        dao.buscar(id)  # 404 antes de validar o corpo
        return jsonify(dao.atualizar(Modelo.de_dict(_corpo_json(), id)).to_dict())

    def excluir(id):
        DAO(get_db()).excluir(id)
        return "", 204

    nome = DAO.tabela
    if com_listagem:
        api.add_url_rule(f"/{caminho}", f"{nome}_listar", listar, methods=["GET"])
    api.add_url_rule(f"/{caminho}", f"{nome}_criar", criar, methods=["POST"])
    api.add_url_rule(f"/{caminho}/<int:id>", f"{nome}_buscar", buscar, methods=["GET"])
    api.add_url_rule(f"/{caminho}/<int:id>", f"{nome}_atualizar", atualizar, methods=["PUT"])
    api.add_url_rule(f"/{caminho}/<int:id>", f"{nome}_excluir", excluir, methods=["DELETE"])


_crud("clientes", ClienteDAO, Cliente)
_crud("servicos", ServicoDAO, Servico)
_crud("profissionais", ProfissionalDAO, Profissional, com_listagem=False)


# Listagem própria de profissionais: aceita ?todos=1 (inclui inativos).
@api.get("/profissionais")
def listar_profissionais():
    apenas_ativos = request.args.get("todos") not in ("1", "true")
    return jsonify([p.to_dict() for p in ProfissionalDAO(get_db()).listar(apenas_ativos)])


# ---------- Agendamentos ----------

@api.get("/agendamentos")
def listar_agendamentos():
    data = request.args.get("data")
    if data:
        try:
            datetime.strptime(data, "%Y-%m-%d")
        except ValueError:
            raise ErroValidacao("O parâmetro 'data' deve estar no formato AAAA-MM-DD.")
    status = request.args.get("status")
    if status and status not in STATUS_VALIDOS:
        raise ErroValidacao(f"Status inválido. Use: {', '.join(STATUS_VALIDOS)}.")
    return jsonify(AgendamentoDAO(get_db()).listar_detalhado(
        data=data,
        profissional_id=_inteiro_opcional("profissional_id"),
        cliente_id=_inteiro_opcional("cliente_id"),
        status=status))


@api.post("/agendamentos")
def criar_agendamento():
    dao = AgendamentoDAO(get_db())
    novo = dao.criar(Agendamento.de_dict(_corpo_json()))
    return jsonify(dao.buscar_detalhado(novo.id)), 201


@api.get("/agendamentos/<int:id>")
def buscar_agendamento(id):
    return jsonify(AgendamentoDAO(get_db()).buscar_detalhado(id))


@api.patch("/agendamentos/<int:id>/cancelar")
def cancelar_agendamento(id):
    return _mudar_status(id, Agendamento.cancelar)


@api.patch("/agendamentos/<int:id>/concluir")
def concluir_agendamento(id):
    return _mudar_status(id, Agendamento.concluir)


def _mudar_status(id, acao):
    dao = AgendamentoDAO(get_db())
    agendamento = dao.buscar(id)
    acao(agendamento)  # lança Conflito se não estiver 'agendado'
    dao.atualizar_status(agendamento)
    return jsonify(dao.buscar_detalhado(id))


@api.get("/disponibilidade")
def disponibilidade():
    """Horários já ocupados de um profissional em um dia (apoio ao front-end)."""
    profissional_id = _inteiro_opcional("profissional_id")
    data = request.args.get("data")
    if profissional_id is None or not data:
        raise ErroValidacao("Informe 'profissional_id' e 'data' (AAAA-MM-DD).")
    try:
        datetime.strptime(data, "%Y-%m-%d")
    except ValueError:
        raise ErroValidacao("O parâmetro 'data' deve estar no formato AAAA-MM-DD.")
    ProfissionalDAO(get_db()).buscar(profissional_id)
    ocupados = [a["data_hora"][11:] for a in AgendamentoDAO(get_db()).listar_detalhado(
        data=data, profissional_id=profissional_id) if a["status"] != "cancelado"]
    return jsonify(profissional_id=profissional_id, data=data, ocupados=ocupados)
