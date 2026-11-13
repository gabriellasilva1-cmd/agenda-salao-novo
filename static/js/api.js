/* Camada de acesso à API Flask. Todas as chamadas Fetch ficam aqui. */

async function requisicao(metodo, url, corpo) {
  const opcoes = { method: metodo, headers: {} };
  if (corpo !== undefined) {
    opcoes.headers["Content-Type"] = "application/json";
    opcoes.body = JSON.stringify(corpo);
  }

  let resposta;
  try {
    resposta = await fetch(url, opcoes);
  } catch (e) {
    throw new Error("Não foi possível falar com o servidor. Confira se o 'python run.py' está rodando.");
  }

  if (resposta.status === 204) return null;

  let dados = null;
  try {
    dados = await resposta.json();
  } catch (e) {
    /* resposta sem JSON: usa a mensagem genérica abaixo */
  }
  if (!resposta.ok) {
    throw new Error((dados && dados.erro) || `Erro ${resposta.status} ao falar com o servidor.`);
  }
  return dados;
}

function comFiltros(url, filtros = {}) {
  const params = new URLSearchParams();
  for (const [chave, valor] of Object.entries(filtros)) {
    if (valor !== undefined && valor !== null && valor !== "") params.set(chave, valor);
  }
  const texto = params.toString();
  return texto ? `${url}?${texto}` : url;
}

const Api = {
  /* clientes, serviços e profissionais seguem o mesmo padrão REST */
  listarClientes: () => requisicao("GET", "/api/clientes"),
  listarServicos: () => requisicao("GET", "/api/servicos"),
  listarProfissionais: (incluirInativos = false) =>
    requisicao("GET", comFiltros("/api/profissionais", { todos: incluirInativos ? 1 : "" })),

  criar: (recurso, dados) => requisicao("POST", `/api/${recurso}`, dados),
  atualizar: (recurso, id, dados) => requisicao("PUT", `/api/${recurso}/${id}`, dados),
  excluir: (recurso, id) => requisicao("DELETE", `/api/${recurso}/${id}`),

  /* agendamentos */
  listarAgendamentos: (filtros) => requisicao("GET", comFiltros("/api/agendamentos", filtros)),
  buscarAgendamento: (id) => requisicao("GET", `/api/agendamentos/${id}`),
  criarAgendamento: (dados) => requisicao("POST", "/api/agendamentos", dados),
  cancelarAgendamento: (id) => requisicao("PATCH", `/api/agendamentos/${id}/cancelar`),
  concluirAgendamento: (id) => requisicao("PATCH", `/api/agendamentos/${id}/concluir`),
  disponibilidade: (profissionalId, data) =>
    requisicao("GET", comFiltros("/api/disponibilidade", { profissional_id: profissionalId, data })),
};
