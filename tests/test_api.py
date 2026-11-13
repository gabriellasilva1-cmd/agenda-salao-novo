"""Testes da API (Etapa 2).  Uso:  python -m unittest discover -s tests -v"""
import sys
import tempfile
import unittest
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(RAIZ))

from app import create_app  # noqa: E402
from app.database import Database  # noqa: E402


class ApiTestCase(unittest.TestCase):
    def setUp(self):
        self._tmp = tempfile.TemporaryDirectory()
        caminho = Path(self._tmp.name) / "teste.db"
        with Database(caminho) as db:
            for arq in ("schema.sql", "seed.sql"):
                db.executar_script((RAIZ / "database" / arq).read_text(encoding="utf-8"))
        self.client = create_app(caminho).test_client()

    def tearDown(self):
        self._tmp.cleanup()

    def novo_agendamento(self, **extra):
        corpo = {"cliente_id": 4, "profissional_id": 3, "servico_id": 5,
                 "data_hora": "2026-12-01 09:00"}
        corpo.update(extra)
        return self.client.post("/api/agendamentos", json=corpo)


class TestClientes(ApiTestCase):
    def test_listar(self):
        r = self.client.get("/api/clientes")
        self.assertEqual(r.status_code, 200)
        self.assertEqual(len(r.get_json()), 4)

    def test_criar_e_buscar(self):
        r = self.client.post("/api/clientes", json={"nome": "Bia", "telefone": "(19) 95555-0000"})
        self.assertEqual(r.status_code, 201)
        novo = r.get_json()
        self.assertIsNone(novo["email"])
        self.assertEqual(self.client.get(f"/api/clientes/{novo['id']}").get_json()["nome"], "Bia")

    def test_validacao(self):
        self.assertEqual(self.client.post("/api/clientes", json={"nome": " ", "telefone": "1"}).status_code, 400)
        self.assertEqual(self.client.post("/api/clientes", json={"nome": "A", "telefone": "1", "email": "x"}).status_code, 400)
        self.assertEqual(self.client.post("/api/clientes", data="isto não é json").status_code, 400)

    def test_email_duplicado(self):
        r = self.client.post("/api/clientes", json={"nome": "X", "telefone": "1", "email": "maria@email.com"})
        self.assertEqual(r.status_code, 409)

    def test_atualizar(self):
        r = self.client.put("/api/clientes/3", json={"nome": "Carla L.", "telefone": "(19) 97777-3333"})
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.get_json()["nome"], "Carla L.")

    def test_inexistente(self):
        self.assertEqual(self.client.get("/api/clientes/999").status_code, 404)
        self.assertEqual(self.client.put("/api/clientes/999", json={"nome": "A", "telefone": "1"}).status_code, 404)

    def test_excluir_sem_e_com_agendamento(self):
        self.assertEqual(self.client.delete("/api/clientes/4").status_code, 204)  # Débora, sem histórico
        r = self.client.delete("/api/clientes/1")  # Maria tem agendamentos
        self.assertEqual(r.status_code, 409)


class TestServicosEProfissionais(ApiTestCase):
    def test_criar_servico(self):
        r = self.client.post("/api/servicos", json={"nome": "Hidratação", "preco": 70, "duracao_min": 50})
        self.assertEqual(r.status_code, 201)
        self.assertEqual(r.get_json()["preco"], 70.0)

    def test_servico_invalido_ou_duplicado(self):
        self.assertEqual(self.client.post("/api/servicos", json={"nome": "A", "preco": -1, "duracao_min": 10}).status_code, 400)
        self.assertEqual(self.client.post("/api/servicos", json={"nome": "A", "preco": 1, "duracao_min": 0}).status_code, 400)
        self.assertEqual(self.client.post("/api/servicos", json={"nome": "Escova", "preco": 1, "duracao_min": 10}).status_code, 409)

    def test_profissional_inativo_some_da_listagem(self):
        r = self.client.post("/api/profissionais", json={"nome": "Lia", "ativo": False})
        self.assertEqual(r.status_code, 201)
        self.assertEqual(len(self.client.get("/api/profissionais").get_json()), 3)
        self.assertEqual(len(self.client.get("/api/profissionais?todos=1").get_json()), 4)

    def test_excluir_servico_em_uso(self):
        self.assertEqual(self.client.delete("/api/servicos/1").status_code, 409)
        self.assertEqual(self.client.delete("/api/servicos/5").status_code, 204)


class TestAgendamentos(ApiTestCase):
    def test_listar_detalhado_e_filtros(self):
        todos = self.client.get("/api/agendamentos").get_json()
        self.assertEqual(len(todos), 4)
        self.assertIn("cliente", todos[0])
        dia = self.client.get("/api/agendamentos?data=2026-11-10").get_json()
        self.assertEqual(len(dia), 3)
        self.assertEqual(len(self.client.get("/api/agendamentos?profissional_id=2").get_json()), 1)
        self.assertEqual(len(self.client.get("/api/agendamentos?status=concluido").get_json()), 1)
        self.assertEqual(self.client.get("/api/agendamentos?status=xyz").status_code, 400)
        self.assertEqual(self.client.get("/api/agendamentos?data=10/11/2026").status_code, 400)
        self.assertEqual(self.client.get("/api/agendamentos?cliente_id=abc").status_code, 400)

    def test_criar(self):
        r = self.novo_agendamento()
        self.assertEqual(r.status_code, 201)
        corpo = r.get_json()
        self.assertEqual(corpo["status"], "agendado")
        self.assertEqual(corpo["servico"], "Sobrancelha")

    def test_horario_ocupado(self):
        r = self.novo_agendamento(profissional_id=1, data_hora="2026-11-10 09:00")
        self.assertEqual(r.status_code, 409)

    def test_horario_cancelado_pode_ser_reaproveitado(self):
        self.assertEqual(self.client.patch("/api/agendamentos/1/cancelar").status_code, 200)
        r = self.novo_agendamento(profissional_id=1, data_hora="2026-11-10 09:00")
        self.assertEqual(r.status_code, 201)

    def test_horarios_com_sobreposicao_de_duracao(self):
        # O corte começa às 09h e dura 60 minutos; 09h30 deve ser recusado.
        r = self.novo_agendamento(profissional_id=1, servico_id=1,
                                  data_hora="2026-11-10 09:30")
        self.assertEqual(r.status_code, 409)

    def test_referencias_e_formato(self):
        self.assertEqual(self.novo_agendamento(cliente_id=99).status_code, 404)
        self.assertEqual(self.novo_agendamento(servico_id=99).status_code, 404)
        self.assertEqual(self.novo_agendamento(data_hora="amanhã").status_code, 400)
        self.assertEqual(self.novo_agendamento(data_hora="2026-13-40 25:00").status_code, 400)
        self.assertEqual(self.novo_agendamento(status="foo").status_code, 400)

    def test_profissional_inativo(self):
        novo = self.client.post("/api/profissionais", json={"nome": "Lia", "ativo": False}).get_json()
        self.assertEqual(self.novo_agendamento(profissional_id=novo["id"]).status_code, 409)

    def test_cancelar_e_concluir(self):
        r = self.client.patch("/api/agendamentos/2/concluir")
        self.assertEqual(r.get_json()["status"], "concluido")
        # já concluído: não pode cancelar nem concluir de novo
        self.assertEqual(self.client.patch("/api/agendamentos/2/cancelar").status_code, 409)
        self.assertEqual(self.client.patch("/api/agendamentos/2/concluir").status_code, 409)
        self.assertEqual(self.client.patch("/api/agendamentos/999/cancelar").status_code, 404)

    def test_disponibilidade(self):
        r = self.client.get("/api/disponibilidade?profissional_id=1&data=2026-11-10")
        self.assertEqual(r.get_json()["ocupados"], ["09:00", "14:00"])
        self.assertEqual(self.client.get("/api/disponibilidade?data=2026-11-10").status_code, 400)
        self.assertEqual(self.client.get("/api/disponibilidade?profissional_id=99&data=2026-11-10").status_code, 404)

    def test_rota_e_metodo_inexistentes(self):
        self.assertEqual(self.client.get("/api/xyz").status_code, 404)
        self.assertEqual(self.client.delete("/api/agendamentos/1").status_code, 405)


class TestFrontEnd(ApiTestCase):
    def test_pagina_inicial_e_arquivos_estaticos(self):
        r = self.client.get("/")
        self.assertEqual(r.status_code, 200)
        self.assertIn("Sevenella Club", r.get_data(as_text=True))
        r.close()
        painel = self.client.get("/painel")
        self.assertEqual(painel.status_code, 200)
        self.assertIn("Painel", painel.get_data(as_text=True))
        painel.close()
        for caminho in ("/static/css/site.css", "/static/js/site.js", "/static/css/style.css",
                        "/static/js/api.js", "/static/js/app.js", "/static/img/hero.svg"):
            resposta = self.client.get(caminho)
            self.assertEqual(resposta.status_code, 200, caminho)
            resposta.close()


if __name__ == "__main__":
    unittest.main()
