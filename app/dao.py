"""DAOs (Data Access Objects): único lugar onde o SQL é escrito.

Cada DAO recebe um objeto Database e converte linhas do banco em modelos.
"""
import sqlite3

from app.models import (Agendamento, Cliente, Conflito, NaoEncontrado,
                        Profissional, Servico)


class BaseDAO:
    tabela = None
    modelo = None
    rotulo = "Registro"

    def __init__(self, db):
        self.db = db

    def listar(self):
        linhas = self.db.consultar(f"SELECT * FROM {self.tabela} ORDER BY nome")
        return [self.modelo.de_linha(l) for l in linhas]

    def buscar(self, id):
        linhas = self.db.consultar(f"SELECT * FROM {self.tabela} WHERE id = ?", (id,))
        if not linhas:
            raise NaoEncontrado(f"{self.rotulo} {id} não encontrado.")
        return self.modelo.de_linha(linhas[0])

    def excluir(self, id):
        self.buscar(id)
        try:
            self.db.executar(f"DELETE FROM {self.tabela} WHERE id = ?", (id,))
        except sqlite3.IntegrityError:
            raise Conflito(f"{self.rotulo} possui agendamentos e não pode ser excluído.")


class ClienteDAO(BaseDAO):
    tabela, modelo, rotulo = "clientes", Cliente, "Cliente"

    def criar(self, c):
        try:
            c.id = self.db.executar(
                "INSERT INTO clientes (nome, telefone, email) VALUES (?, ?, ?)",
                (c.nome, c.telefone, c.email))
        except sqlite3.IntegrityError:
            raise Conflito("Já existe um cliente com este e-mail.")
        return c

    def atualizar(self, c):
        self.buscar(c.id)
        try:
            self.db.executar(
                "UPDATE clientes SET nome = ?, telefone = ?, email = ? WHERE id = ?",
                (c.nome, c.telefone, c.email, c.id))
        except sqlite3.IntegrityError:
            raise Conflito("Já existe um cliente com este e-mail.")
        return c


class ProfissionalDAO(BaseDAO):
    tabela, modelo, rotulo = "profissionais", Profissional, "Profissional"

    def listar(self, apenas_ativos=True):
        sql = "SELECT * FROM profissionais"
        if apenas_ativos:
            sql += " WHERE ativo = 1"
        return [Profissional.de_linha(l) for l in self.db.consultar(sql + " ORDER BY nome")]

    def criar(self, p):
        p.id = self.db.executar(
            "INSERT INTO profissionais (nome, especialidade, ativo) VALUES (?, ?, ?)",
            (p.nome, p.especialidade, int(p.ativo)))
        return p

    def atualizar(self, p):
        self.buscar(p.id)
        self.db.executar(
            "UPDATE profissionais SET nome = ?, especialidade = ?, ativo = ? WHERE id = ?",
            (p.nome, p.especialidade, int(p.ativo), p.id))
        return p


class ServicoDAO(BaseDAO):
    tabela, modelo, rotulo = "servicos", Servico, "Serviço"

    def criar(self, s):
        try:
            s.id = self.db.executar(
                "INSERT INTO servicos (nome, preco, duracao_min) VALUES (?, ?, ?)",
                (s.nome, s.preco, s.duracao_min))
        except sqlite3.IntegrityError:
            raise Conflito("Já existe um serviço com este nome.")
        return s

    def atualizar(self, s):
        self.buscar(s.id)
        try:
            self.db.executar(
                "UPDATE servicos SET nome = ?, preco = ?, duracao_min = ? WHERE id = ?",
                (s.nome, s.preco, s.duracao_min, s.id))
        except sqlite3.IntegrityError:
            raise Conflito("Já existe um serviço com este nome.")
        return s


class AgendamentoDAO(BaseDAO):
    tabela, modelo, rotulo = "agendamentos", Agendamento, "Agendamento"

    _SELECT_DETALHADO = (
        "SELECT a.id, a.data_hora, a.status, a.cliente_id, a.profissional_id, "
        "a.servico_id, c.nome AS cliente, p.nome AS profissional, "
        "s.nome AS servico, s.preco, s.duracao_min "
        "FROM agendamentos a "
        "JOIN clientes c ON c.id = a.cliente_id "
        "JOIN profissionais p ON p.id = a.profissional_id "
        "JOIN servicos s ON s.id = a.servico_id ")

    def horario_disponivel(self, profissional_id, data_hora, duracao_min):
        """Verifica sobreposição, não apenas horários com início idêntico."""
        from datetime import datetime, timedelta

        inicio = datetime.strptime(data_hora, "%Y-%m-%d %H:%M")
        fim = inicio + timedelta(minutes=duracao_min)
        linhas = self.db.consultar(
            "SELECT 1 FROM agendamentos a "
            "JOIN servicos s ON s.id = a.servico_id "
            "WHERE a.profissional_id = ? AND a.status != 'cancelado' "
            "AND a.data_hora < ? "
            "AND datetime(a.data_hora, '+' || s.duracao_min || ' minutes') > ? LIMIT 1",
            (profissional_id, fim.strftime("%Y-%m-%d %H:%M"),
             inicio.strftime("%Y-%m-%d %H:%M")))
        return len(linhas) == 0

    def criar(self, a):
        """Valida as referências e a disponibilidade e grava o agendamento."""
        ClienteDAO(self.db).buscar(a.cliente_id)
        profissional = ProfissionalDAO(self.db).buscar(a.profissional_id)
        servico = ServicoDAO(self.db).buscar(a.servico_id)
        if not profissional.ativo:
            raise Conflito("Este profissional está inativo.")
        if not self.horario_disponivel(a.profissional_id, a.data_hora, servico.duracao_min):
            raise Conflito("Horário indisponível: existe outro atendimento nesse período.")
        try:
            a.id = self.db.executar(
                "INSERT INTO agendamentos "
                "(cliente_id, profissional_id, servico_id, data_hora, status) "
                "VALUES (?, ?, ?, ?, ?)",
                (a.cliente_id, a.profissional_id, a.servico_id, a.data_hora, a.status))
        except sqlite3.IntegrityError:  # índice único (corrida entre duas requisições)
            raise Conflito("Horário indisponível para este profissional.")
        return a

    def atualizar_status(self, a):
        self.db.executar("UPDATE agendamentos SET status = ? WHERE id = ?", (a.status, a.id))
        return a

    def listar(self):
        return [Agendamento.de_linha(l) for l in
                self.db.consultar("SELECT * FROM agendamentos ORDER BY data_hora")]

    def listar_detalhado(self, data=None, profissional_id=None, cliente_id=None, status=None):
        filtros, params = [], []
        if data:
            filtros.append("substr(a.data_hora, 1, 10) = ?")
            params.append(data)
        if profissional_id is not None:
            filtros.append("a.profissional_id = ?")
            params.append(profissional_id)
        if cliente_id is not None:
            filtros.append("a.cliente_id = ?")
            params.append(cliente_id)
        if status:
            filtros.append("a.status = ?")
            params.append(status)
        sql = self._SELECT_DETALHADO
        if filtros:
            sql += "WHERE " + " AND ".join(filtros) + " "
        return [dict(l) for l in self.db.consultar(sql + "ORDER BY a.data_hora", params)]

    def buscar_detalhado(self, id):
        linhas = self.db.consultar(self._SELECT_DETALHADO + "WHERE a.id = ?", (id,))
        if not linhas:
            raise NaoEncontrado(f"Agendamento {id} não encontrado.")
        return dict(linhas[0])

    def excluir(self, id):
        raise NotImplementedError("Agendamentos não são apagados: use cancelar.")
