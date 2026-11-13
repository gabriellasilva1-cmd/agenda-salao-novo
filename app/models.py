"""Classes de domínio (POO) do sistema de agenda do salão.

Nesta etapa os modelos representam apenas os dados e as regras de validação.
O acesso ao banco fica nas classes DAO (app/dao.py).
"""
from datetime import datetime

FORMATO_DATA_HORA = "%Y-%m-%d %H:%M"
STATUS_VALIDOS = ("agendado", "concluido", "cancelado")


class ErroValidacao(ValueError):
    """Dado inválido enviado pelo usuário (vira HTTP 400)."""


class NaoEncontrado(LookupError):
    """Registro inexistente (vira HTTP 404)."""


class Conflito(Exception):
    """Operação que viola uma regra de integridade (vira HTTP 409)."""


def _texto_obrigatorio(valor, campo):
    if not isinstance(valor, str) or not valor.strip():
        raise ErroValidacao(f"O campo '{campo}' é obrigatório.")
    return valor.strip()


def _texto_opcional(valor, campo):
    if valor is None:
        return None
    if not isinstance(valor, str):
        raise ErroValidacao(f"O campo '{campo}' deve ser texto.")
    return valor.strip() or None


class Entidade:
    """Classe base: todo registro do banco tem um id e vira dicionário (JSON)."""

    def __init__(self, id=None):
        self.id = id

    def to_dict(self):
        return dict(vars(self))

    def __repr__(self):
        return f"{type(self).__name__}({vars(self)})"


class Cliente(Entidade):
    def __init__(self, nome, telefone, email=None, id=None):
        super().__init__(id)
        self.nome = _texto_obrigatorio(nome, "nome")
        self.telefone = _texto_obrigatorio(telefone, "telefone")
        self.email = _texto_opcional(email, "email")
        if self.email and ("@" not in self.email or " " in self.email):
            raise ErroValidacao("E-mail inválido.")

    @classmethod
    def de_dict(cls, dados, id=None):
        return cls(dados.get("nome"), dados.get("telefone"), dados.get("email"), id)

    @classmethod
    def de_linha(cls, linha):
        return cls(linha["nome"], linha["telefone"], linha["email"], linha["id"])


class Profissional(Entidade):
    def __init__(self, nome, especialidade=None, ativo=True, id=None):
        super().__init__(id)
        self.nome = _texto_obrigatorio(nome, "nome")
        self.especialidade = _texto_opcional(especialidade, "especialidade")
        if not isinstance(ativo, (bool, int)) or ativo not in (0, 1):
            raise ErroValidacao("O campo 'ativo' deve ser verdadeiro ou falso.")
        self.ativo = bool(ativo)

    @classmethod
    def de_dict(cls, dados, id=None):
        return cls(dados.get("nome"), dados.get("especialidade"),
                   dados.get("ativo", True), id)

    @classmethod
    def de_linha(cls, linha):
        return cls(linha["nome"], linha["especialidade"], bool(linha["ativo"]), linha["id"])


class Servico(Entidade):
    def __init__(self, nome, preco, duracao_min, id=None):
        super().__init__(id)
        self.nome = _texto_obrigatorio(nome, "nome")
        if isinstance(preco, bool) or not isinstance(preco, (int, float)) or preco < 0:
            raise ErroValidacao("O preço deve ser um número maior ou igual a zero.")
        if isinstance(duracao_min, bool) or not isinstance(duracao_min, int) or duracao_min <= 0:
            raise ErroValidacao("A duração deve ser um número inteiro de minutos maior que zero.")
        self.preco = float(preco)
        self.duracao_min = duracao_min

    @classmethod
    def de_dict(cls, dados, id=None):
        return cls(dados.get("nome"), dados.get("preco"), dados.get("duracao_min"), id)

    @classmethod
    def de_linha(cls, linha):
        return cls(linha["nome"], linha["preco"], linha["duracao_min"], linha["id"])


class Agendamento(Entidade):
    def __init__(self, cliente_id, profissional_id, servico_id, data_hora,
                 status="agendado", id=None):
        super().__init__(id)
        for nome, valor in (("cliente_id", cliente_id),
                            ("profissional_id", profissional_id),
                            ("servico_id", servico_id)):
            if isinstance(valor, bool) or not isinstance(valor, int):
                raise ErroValidacao(f"O campo '{nome}' é obrigatório (número inteiro).")
        self.cliente_id = cliente_id
        self.profissional_id = profissional_id
        self.servico_id = servico_id
        self.data_hora = self._validar_data_hora(data_hora)
        if status not in STATUS_VALIDOS:
            raise ErroValidacao(f"Status inválido. Use: {', '.join(STATUS_VALIDOS)}.")
        self.status = status

    @staticmethod
    def _validar_data_hora(valor):
        try:
            datetime.strptime(valor, FORMATO_DATA_HORA)
        except (TypeError, ValueError):
            raise ErroValidacao("data_hora inválida. Use o formato 'AAAA-MM-DD HH:MM'.")
        return valor

    @classmethod
    def de_dict(cls, dados, id=None):
        return cls(dados.get("cliente_id"), dados.get("profissional_id"),
                   dados.get("servico_id"), dados.get("data_hora"),
                   dados.get("status", "agendado"), id)

    @classmethod
    def de_linha(cls, linha):
        return cls(linha["cliente_id"], linha["profissional_id"], linha["servico_id"],
                   linha["data_hora"], linha["status"], linha["id"])

    def cancelar(self):
        self._mudar_status("cancelado")

    def concluir(self):
        self._mudar_status("concluido")

    def _mudar_status(self, novo):
        if self.status != "agendado":
            raise Conflito(f"Só é possível alterar agendamentos com status 'agendado' "
                           f"(atual: '{self.status}').")
        self.status = novo
