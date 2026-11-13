/* Front-end da Agenda do Salão: telas, formulários e navegação (SPA simples). */

/* ---------- utilidades ---------- */

const $ = (seletor, raiz = document) => raiz.querySelector(seletor);

/** Cria elementos sem usar innerHTML (textos entram como texto, nunca como HTML). */
function h(tag, atributos = {}, ...filhos) {
  const el = document.createElement(tag);
  for (const [chave, valor] of Object.entries(atributos || {})) {
    if (valor === null || valor === undefined || valor === false) continue;
    if (chave === "class") el.className = valor;
    else if (chave.startsWith("on")) el.addEventListener(chave.slice(2), valor);
    else if (valor === true) el.setAttribute(chave, "");
    else el.setAttribute(chave, valor);
  }
  for (const filho of filhos.flat()) {
    if (filho === null || filho === undefined || filho === false) continue;
    el.append(filho.nodeType ? filho : document.createTextNode(filho));
  }
  return el;
}

const dois = (n) => String(n).padStart(2, "0");
const isoData = (d) => `${d.getFullYear()}-${dois(d.getMonth() + 1)}-${dois(d.getDate())}`;
const dataDe = (iso) => {
  const [a, m, d] = iso.split("-").map(Number);
  return new Date(a, m - 1, d);
};
const somarDias = (iso, n) => {
  const d = dataDe(iso);
  d.setDate(d.getDate() + n);
  return isoData(d);
};
const dataLonga = (iso) => {
  const texto = dataDe(iso).toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  return texto.charAt(0).toUpperCase() + texto.slice(1);
};
const dinheiro = (n) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const paraMinutos = (hhmm) => {
  const [hh, mm] = hhmm.split(":").map(Number);
  return hh * 60 + mm;
};
const paraHora = (min) => `${dois(Math.floor(min / 60))}:${dois(min % 60)}`;

/* ---------- avisos e modal ---------- */

function aviso(mensagem, tipo = "ok") {
  const el = h("div", { class: `aviso ${tipo}` }, mensagem);
  $("#avisos").append(el);
  setTimeout(() => el.remove(), tipo === "erro" ? 6000 : 3500);
}

const modal = $("#modal");
modal.addEventListener("click", (e) => {
  if (e.target === modal) fecharModal(); // clique no fundo escurecido
});

function abrirModal(titulo, conteudo) {
  modal.replaceChildren(
    h("div", { class: "modal-cab" },
      h("h2", { id: "modal-titulo" }, titulo),
      h("button", { class: "icone", type: "button", "aria-label": "Fechar", onclick: fecharModal }, "×")),
    conteudo);
  if (!modal.open) modal.showModal();
}

function fecharModal() {
  if (modal.open) modal.close();
}

function confirmar(titulo, texto, rotulo) {
  return new Promise((resolver) => {
    let confirmado = false;
    abrirModal(titulo, h("div", { class: "modal-corpo" },
      h("p", {}, texto),
      h("div", { class: "acoes" },
        h("button", { class: "btn", type: "button", onclick: fecharModal }, "Voltar"),
        h("button", { class: "btn perigo", type: "button", onclick: () => { confirmado = true; fecharModal(); } }, rotulo))));
    modal.addEventListener("close", () => resolver(confirmado), { once: true });
  });
}

/** Desabilita o botão enquanto a ação roda e mostra o erro da API, se houver. */
async function executar(botao, acao) {
  botao.disabled = true;
  try {
    await acao();
  } catch (e) {
    aviso(e.message, "erro");
  } finally {
    botao.disabled = false;
  }
}

/* ---------- campos de formulário ---------- */

function campo(rotulo, entrada, dica) {
  const id = entrada.id || `campo-${Math.random().toString(36).slice(2, 8)}`;
  entrada.id = id;
  return h("div", { class: "campo" },
    h("label", { for: id }, rotulo),
    entrada,
    dica ? h("p", { class: "dica" }, dica) : null);
}

function selecao(opcoes, valorAtual) {
  return h("select", { required: true },
    h("option", { value: "" }, "Selecione…"),
    opcoes.map((o) => h("option", { value: o.valor, selected: String(o.valor) === String(valorAtual) }, o.texto)));
}

/* ---------- tela: início ---------- */

function rotuloDia(iso, hoje) {
  if (iso === hoje) return "Hoje";
  if (iso === somarDias(hoje, 1)) return "Amanhã";
  return `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;
}

function linhaAgendamento(a, hoje, comDia) {
  return h("button", { class: "linha-ag", type: "button", onclick: () => detalheAgendamento(a.id) },
    h("span", { class: "hora-ag" }, a.data_hora.slice(11),
      comDia ? h("small", {}, rotuloDia(a.data_hora.slice(0, 10), hoje)) : null),
    h("span", { class: "info-ag" }, h("strong", {}, a.cliente), h("span", {}, `${a.servico} com ${a.profissional}`)),
    h("span", { class: `etiqueta ${a.status}` }, { agendado: "Agendado", concluido: "Concluído", cancelado: "Cancelado" }[a.status]));
}

async function telaInicio(raiz, rodada) {
  const [todos, clientes, profissionais, servicos] = await Promise.all([
    Api.listarAgendamentos({}), Api.listarClientes(), Api.listarProfissionais(), Api.listarServicos()]);
  if (rodada !== estado.rodada) return;

  const agora = new Date();
  const hoje = isoData(agora);
  const agoraTexto = `${hoje} ${dois(agora.getHours())}:${dois(agora.getMinutes())}`;
  const daquiPraFrente = todos.filter((a) => a.status === "agendado" && a.data_hora >= agoraTexto);
  const proximo = daquiPraFrente[0];
  const hojeAtivos = todos.filter((a) => a.data_hora.startsWith(hoje) && a.status !== "cancelado");
  const proximosDias = daquiPraFrente.filter((a) => !a.data_hora.startsWith(hoje)).slice(0, 6);
  const previsto = hojeAtivos.reduce((soma, a) => soma + a.preco, 0);
  const saudacao = agora.getHours() < 12 ? "Bom dia" : agora.getHours() < 18 ? "Boa tarde" : "Boa noite";

  const destaque = proximo
    ? h("section", { class: "destaque", "aria-labelledby": "destaque-titulo" },
        h("p", { class: "destaque-sub" }, `${saudacao}! Próximo atendimento`),
        h("p", { class: "destaque-hora", id: "destaque-titulo" },
          proximo.data_hora.slice(11), h("small", {}, rotuloDia(proximo.data_hora.slice(0, 10), hoje))),
        h("p", { class: "destaque-texto" }, h("strong", {}, proximo.cliente), `: ${proximo.servico} com ${proximo.profissional}`),
        h("div", { class: "acoes-esq" },
          h("button", { class: "btn primario", type: "button", onclick: () => detalheAgendamento(proximo.id) }, "Ver detalhes"),
          h("button", { class: "btn claro", type: "button", onclick: () => formularioAgendamento({ data: hoje }) }, "Novo agendamento")))
    : h("section", { class: "destaque", "aria-labelledby": "destaque-titulo" },
        h("p", { class: "destaque-sub" }, saudacao),
        h("p", { class: "destaque-titulo", id: "destaque-titulo" }, "Nenhum atendimento marcado daqui para frente."),
        h("p", { class: "destaque-texto" }, "Marque o primeiro horário para ele aparecer aqui."),
        h("div", { class: "acoes-esq" },
          h("button", { class: "btn primario", type: "button", onclick: () => formularioAgendamento({ data: hoje }) }, "Novo agendamento")));

  const numero = (valor, rotulo, href) =>
    h("a", { class: "numero", href }, h("strong", {}, valor), h("span", {}, rotulo));

  raiz.replaceChildren(
    h("header", { class: "topo" },
      h("div", {}, h("h1", {}, "Início"), h("p", { class: "sub" }, dataLonga(hoje)))),
    destaque,
    h("div", { class: "numeros" },
      numero(String(hojeAtivos.length), "atendimentos hoje", "#agenda"),
      numero(dinheiro(previsto), "previsto para hoje", "#agenda"),
      numero(String(clientes.length), "clientes", "#clientes"),
      numero(String(profissionais.length), "profissionais ativos", "#profissionais")),
    h("div", { class: "duas-colunas" },
      h("section", { "aria-labelledby": "t-hoje" },
        h("div", { class: "secao-cab" }, h("h2", { id: "t-hoje" }, "Hoje"), h("a", { href: "#agenda" }, "Abrir agenda")),
        hojeAtivos.length
          ? h("div", { class: "lista-ag" }, hojeAtivos.map((a) => linhaAgendamento(a, hoje, false)))
          : h("div", { class: "vazio" }, h("p", {}, "Nenhum atendimento hoje."))),
      h("section", { "aria-labelledby": "t-prox" },
        h("div", { class: "secao-cab" }, h("h2", { id: "t-prox" }, "Próximos dias")),
        proximosDias.length
          ? h("div", { class: "lista-ag" }, proximosDias.map((a) => linhaAgendamento(a, hoje, true)))
          : h("div", { class: "vazio" }, h("p", {}, "Nada marcado para os próximos dias.")))),
    h("section", { "aria-labelledby": "t-serv" },
      h("div", { class: "secao-cab" }, h("h2", { id: "t-serv" }, "Serviços do salão"), h("a", { href: "#servicos" }, "Gerenciar serviços")),
      servicos.length
        ? h("ul", { class: "cardapio" }, servicos.map((s) => h("li", {},
            h("strong", {}, s.nome),
            h("span", {}, `${s.duracao_min} min`),
            h("span", { class: "preco" }, dinheiro(s.preco)))))
        : h("div", { class: "vazio" }, h("p", {}, "Nenhum serviço cadastrado."))));
}

/* ---------- tela: agenda do dia ---------- */

const PX_POR_MIN = 44 / 30; // cada intervalo de 30 min tem 44 px
const estado = { data: isoData(new Date()), rodada: 0 };

async function telaAgenda(raiz, rodada) {
  const data = estado.data;
  const [profissionais, agendamentos] = await Promise.all([
    Api.listarProfissionais(true),
    Api.listarAgendamentos({ data }),
  ]);
  if (rodada !== estado.rodada) return; // o usuário já foi para outra tela/data

  const ativos = agendamentos.filter((a) => a.status !== "cancelado");
  const colunas = profissionais.filter(
    (p) => p.ativo || ativos.some((a) => a.profissional_id === p.id));

  const total = (status) => agendamentos.filter((a) => a.status === status).length;
  const resumo = `${total("agendado")} agendados, ${total("concluido")} concluídos, ${total("cancelado")} cancelados`;

  raiz.replaceChildren(
    h("header", { class: "topo" },
      h("div", {},
        h("h1", {}, "Agenda"),
        h("p", { class: "sub" }, dataLonga(data))),
      h("button", { class: "btn primario", type: "button", onclick: () => formularioAgendamento({ data }) }, "Novo agendamento")),
    h("div", { class: "barra-dia" },
      h("button", { class: "btn", type: "button", "aria-label": "Dia anterior", onclick: () => irParaData(somarDias(data, -1)) }, "‹"),
      h("input", { type: "date", value: data, "aria-label": "Escolher data",
        onchange: (e) => e.target.value && irParaData(e.target.value) }),
      h("button", { class: "btn", type: "button", "aria-label": "Próximo dia", onclick: () => irParaData(somarDias(data, 1)) }, "›"),
      h("button", { class: "btn", type: "button", onclick: () => irParaData(isoData(new Date())) }, "Hoje"),
      h("span", { class: "resumo" }, resumo)),
    colunas.length === 0
      ? h("div", { class: "vazio" },
          h("p", {}, "Nenhum profissional ativo."),
          h("a", { class: "btn", href: "#profissionais" }, "Cadastrar profissional"))
      : montarGrade(colunas, ativos, data));
}

function irParaData(data) {
  estado.data = data;
  rotear();
}

function montarGrade(profissionais, agendamentos, data) {
  // janela de horas: 08:00–20:00, ampliada se algum agendamento ficar fora dela
  let inicio = 8 * 60;
  let fim = 20 * 60;
  for (const a of agendamentos) {
    const ini = paraMinutos(a.data_hora.slice(11));
    inicio = Math.min(inicio, Math.floor(ini / 60) * 60);
    fim = Math.max(fim, Math.ceil((ini + a.duracao_min) / 60) * 60);
  }
  fim = Math.min(fim, 24 * 60);
  const altura = (fim - inicio) * PX_POR_MIN;

  const colunaHoras = h("div", { class: "coluna-horas", style: `height:${altura}px` });
  for (let m = inicio; m < fim; m += 60) {
    colunaHoras.append(h("span", { style: `top:${(m - inicio) * PX_POR_MIN}px` }, paraHora(m)));
  }

  const grade = h("div", { class: "grade", style: `--colunas:${profissionais.length}` },
    h("div", { class: "cab-canto" }),
    profissionais.map((p) => h("div", { class: "cab-prof" },
      h("strong", {}, p.nome),
      h("span", {}, p.ativo ? (p.especialidade || "") : "Inativo"))),
    colunaHoras,
    profissionais.map((p) => colunaProfissional(p, agendamentos, data, inicio, fim, altura)));

  return h("div", { class: "grade-rolagem" }, grade);
}

function colunaProfissional(prof, agendamentos, data, inicio, fim, altura) {
  const doProf = agendamentos.filter((a) => a.profissional_id === prof.id);
  const intervalos = doProf.map((a) => {
    const ini = paraMinutos(a.data_hora.slice(11));
    return [ini, ini + a.duracao_min];
  });
  const coluna = h("div", { class: "coluna", style: `height:${altura}px` });

  // intervalos livres (clicáveis) a cada 30 minutos
  for (let m = inicio; m < fim; m += 30) {
    const ocupado = intervalos.some(([ini, fimAg]) => m >= ini && m < fimAg);
    const cheio = m % 60 === 0 ? " hora" : "";
    const estilo = `top:${(m - inicio) * PX_POR_MIN}px`;
    if (ocupado || !prof.ativo) {
      coluna.append(h("div", { class: `intervalo${cheio}`, style: estilo }));
    } else {
      coluna.append(h("button", {
        class: `intervalo livre${cheio}`, type: "button", style: estilo,
        "aria-label": `Agendar com ${prof.nome} às ${paraHora(m)}`,
        onclick: () => formularioAgendamento({ data, profissionalId: prof.id, hora: paraHora(m) }),
      }));
    }
  }

  for (const a of doProf) {
    const ini = paraMinutos(a.data_hora.slice(11));
    coluna.append(h("button", {
      class: `reserva ${a.status}`, type: "button",
      style: `top:${(ini - inicio) * PX_POR_MIN}px;height:${a.duracao_min * PX_POR_MIN - 2}px`,
      title: `${a.data_hora.slice(11)} · ${a.cliente} · ${a.servico}`,
      onclick: () => detalheAgendamento(a.id),
    },
      h("strong", {}, `${a.data_hora.slice(11)} ${a.cliente}`),
      h("span", {}, a.servico)));
  }
  return coluna;
}

async function detalheAgendamento(id) {
  let a;
  try {
    a = await Api.buscarAgendamento(id);
  } catch (e) {
    return aviso(e.message, "erro");
  }

  const rotuloStatus = { agendado: "Agendado", concluido: "Concluído", cancelado: "Cancelado" }[a.status];
  const linhas = [
    ["Cliente", a.cliente],
    ["Serviço", `${a.servico} (${a.duracao_min} min)`],
    ["Profissional", a.profissional],
    ["Dia e hora", `${dataLonga(a.data_hora.slice(0, 10))}, ${a.data_hora.slice(11)}`],
    ["Valor", dinheiro(a.preco)],
  ];

  const acoes = h("div", { class: "acoes" }, h("button", { class: "btn", type: "button", onclick: fecharModal }, "Fechar"));
  if (a.status === "agendado") {
    const concluir = h("button", { class: "btn sucesso", type: "button" }, "Concluir atendimento");
    concluir.addEventListener("click", () => executar(concluir, async () => {
      await Api.concluirAgendamento(a.id);
      fecharModal();
      aviso("Atendimento concluído.");
      rotear();
    }));
    const cancelar = h("button", { class: "btn perigo", type: "button" }, "Cancelar agendamento");
    cancelar.addEventListener("click", async () => {
      const ok = await confirmar("Cancelar agendamento?",
        `${a.cliente}, ${a.servico}, ${a.data_hora.slice(11)}. O horário volta a ficar livre.`, "Cancelar agendamento");
      if (!ok) return;
      try {
        await Api.cancelarAgendamento(a.id);
        aviso("Agendamento cancelado.");
        rotear();
      } catch (e) {
        aviso(e.message, "erro");
      }
    });
    acoes.prepend(cancelar);
    acoes.append(concluir);
  }

  abrirModal("Agendamento", h("div", { class: "modal-corpo" },
    h("p", {}, h("span", { class: `etiqueta ${a.status}` }, rotuloStatus)),
    h("dl", { class: "detalhes" }, linhas.map(([rot, val]) => [h("dt", {}, rot), h("dd", {}, val)])),
    acoes));
}

async function formularioAgendamento({ data, profissionalId, hora } = {}) {
  let clientes, servicos, profissionais;
  try {
    [clientes, servicos, profissionais] = await Promise.all([
      Api.listarClientes(), Api.listarServicos(), Api.listarProfissionais()]);
  } catch (e) {
    return aviso(e.message, "erro");
  }
  if (!clientes.length || !servicos.length || !profissionais.length) {
    return abrirModal("Novo agendamento", h("div", { class: "modal-corpo" },
      h("p", {}, "Para agendar, cadastre antes pelo menos um cliente, um serviço e um profissional ativo."),
      h("div", { class: "acoes" }, h("button", { class: "btn", type: "button", onclick: fecharModal }, "Fechar"))));
  }

  const selCliente = selecao(clientes.map((c) => ({ valor: c.id, texto: c.nome })));
  const selServico = selecao(servicos.map((s) => ({
    valor: s.id, texto: `${s.nome}: ${dinheiro(s.preco)}, ${s.duracao_min} min` })));
  const selProf = selecao(profissionais.map((p) => ({
    valor: p.id, texto: p.especialidade ? `${p.nome} (${p.especialidade})` : p.nome })), profissionalId);
  const inpData = h("input", { type: "date", required: true, value: data || estado.data });
  const inpHora = h("input", { type: "time", required: true, step: 300, value: hora || "" });
  const ocupados = h("p", { class: "dica", "aria-live": "polite" });

  async function atualizarOcupados() {
    if (!selProf.value || !inpData.value) { ocupados.textContent = ""; return; }
    try {
      const r = await Api.disponibilidade(selProf.value, inpData.value);
      ocupados.textContent = r.ocupados.length
        ? `Horários já ocupados neste dia: ${r.ocupados.join(", ")}.`
        : "Nenhum horário ocupado neste dia.";
    } catch (e) {
      ocupados.textContent = "";
    }
  }
  selProf.addEventListener("change", atualizarOcupados);
  inpData.addEventListener("change", atualizarOcupados);
  atualizarOcupados();

  const salvar = h("button", { class: "btn primario", type: "submit" }, "Agendar");
  const form = h("form", { class: "modal-corpo", novalidate: false },
    campo("Cliente", selCliente),
    campo("Serviço", selServico),
    campo("Profissional", selProf),
    h("div", { class: "duas" }, campo("Dia", inpData), campo("Hora", inpHora)),
    ocupados,
    h("div", { class: "acoes" },
      h("button", { class: "btn", type: "button", onclick: fecharModal }, "Cancelar"),
      salvar));

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    executar(salvar, async () => {
      await Api.criarAgendamento({
        cliente_id: Number(selCliente.value),
        profissional_id: Number(selProf.value),
        servico_id: Number(selServico.value),
        data_hora: `${inpData.value} ${inpHora.value}`,
      });
      fecharModal();
      aviso("Agendamento criado.");
      estado.data = inpData.value;
      rotear();
    });
  });

  abrirModal("Novo agendamento", form);
}

/* ---------- telas de cadastro (clientes, profissionais, serviços) ---------- */

const RECURSOS = {
  clientes: {
    titulo: "Clientes", singular: "cliente", novo: "Novo cliente",
    vazio: "Nenhum cliente cadastrado ainda.",
    listar: () => Api.listarClientes(),
    campos: [
      { nome: "nome", rotulo: "Nome", tipo: "text", obrigatorio: true },
      { nome: "telefone", rotulo: "Telefone", tipo: "tel", obrigatorio: true },
      { nome: "email", rotulo: "E-mail", tipo: "email" },
    ],
    colunas: [
      { rotulo: "Nome", valor: (x) => x.nome },
      { rotulo: "Telefone", valor: (x) => x.telefone },
      { rotulo: "E-mail", valor: (x) => x.email || "" },
    ],
  },
  profissionais: {
    titulo: "Profissionais", singular: "profissional", novo: "Novo profissional",
    vazio: "Nenhum profissional cadastrado ainda.",
    listar: () => Api.listarProfissionais(true),
    campos: [
      { nome: "nome", rotulo: "Nome", tipo: "text", obrigatorio: true },
      { nome: "especialidade", rotulo: "Especialidade", tipo: "text" },
      { nome: "ativo", rotulo: "Atende clientes (ativo)", tipo: "checkbox", padrao: true },
    ],
    colunas: [
      { rotulo: "Nome", valor: (x) => x.nome },
      { rotulo: "Especialidade", valor: (x) => x.especialidade || "" },
      { rotulo: "Situação", valor: (x) => (x.ativo ? "Ativo" : "Inativo") },
    ],
  },
  servicos: {
    titulo: "Serviços", singular: "serviço", novo: "Novo serviço",
    vazio: "Nenhum serviço cadastrado ainda.",
    listar: () => Api.listarServicos(),
    campos: [
      { nome: "nome", rotulo: "Nome", tipo: "text", obrigatorio: true },
      { nome: "preco", rotulo: "Preço (R$)", tipo: "number", numero: "decimal", min: 0, step: "0.01", obrigatorio: true },
      { nome: "duracao_min", rotulo: "Duração (minutos)", tipo: "number", numero: "inteiro", min: 5, step: 5, obrigatorio: true },
    ],
    colunas: [
      { rotulo: "Nome", valor: (x) => x.nome },
      { rotulo: "Preço", valor: (x) => dinheiro(x.preco) },
      { rotulo: "Duração", valor: (x) => `${x.duracao_min} min` },
    ],
  },
};

async function telaRecurso(raiz, rodada, chave) {
  const cfg = RECURSOS[chave];
  const itens = await cfg.listar();
  if (rodada !== estado.rodada) return;

  let filtro = "";
  const corpo = h("tbody");
  const vazio = h("div", { class: "vazio" }, h("p", {}, cfg.vazio));
  const tabela = h("div", { class: "tabela-rolagem" },
    h("table", {},
      h("thead", {}, h("tr", {}, cfg.colunas.map((c) => h("th", { scope: "col" }, c.rotulo)), h("th", { scope: "col" }, h("span", { class: "so-leitor" }, "Ações")))),
      corpo));

  function linha(item) {
    return h("tr", {},
      cfg.colunas.map((c, i) => h("td", { "data-rotulo": c.rotulo, class: i === 0 ? "principal" : "" }, c.valor(item))),
      h("td", { class: "linha-acoes" },
        h("button", { class: "btn pequeno", type: "button", onclick: () => formularioRecurso(chave, item) }, "Editar"),
        h("button", { class: "btn pequeno perigo-suave", type: "button", onclick: () => excluirItem(chave, item) }, "Excluir")));
  }

  function pintar() {
    const visiveis = itens.filter((x) =>
      cfg.colunas.some((c) => String(c.valor(x)).toLowerCase().includes(filtro)));
    corpo.replaceChildren(...visiveis.map(linha));
    tabela.hidden = visiveis.length === 0;
    vazio.hidden = visiveis.length > 0;
    vazio.firstChild.textContent = itens.length ? "Nada encontrado para essa busca." : cfg.vazio;
  }

  raiz.replaceChildren(
    h("header", { class: "topo" },
      h("div", {}, h("h1", {}, cfg.titulo), h("p", { class: "sub" }, `${itens.length} cadastrados`)),
      h("button", { class: "btn primario", type: "button", onclick: () => formularioRecurso(chave) }, cfg.novo)),
    itens.length > 4
      ? h("div", { class: "busca" }, h("input", {
          type: "search", placeholder: `Buscar em ${cfg.titulo.toLowerCase()}`, "aria-label": `Buscar em ${cfg.titulo.toLowerCase()}`,
          oninput: (e) => { filtro = e.target.value.trim().toLowerCase(); pintar(); } }))
      : null,
    tabela, vazio);
  pintar();
}

function formularioRecurso(chave, item) {
  const cfg = RECURSOS[chave];
  const entradas = {};

  const blocos = cfg.campos.map((c) => {
    const valor = item ? item[c.nome] : c.padrao;
    if (c.tipo === "checkbox") {
      const caixa = h("input", { type: "checkbox", checked: Boolean(valor) });
      entradas[c.nome] = caixa;
      return h("label", { class: "caixa" }, caixa, c.rotulo);
    }
    const entrada = h("input", {
      type: c.tipo, required: c.obrigatorio, min: c.min, step: c.step,
      value: valor === null || valor === undefined ? "" : valor,
    });
    entradas[c.nome] = entrada;
    return campo(c.rotulo, entrada);
  });

  const salvar = h("button", { class: "btn primario", type: "submit" }, "Salvar");
  const form = h("form", { class: "modal-corpo" }, blocos,
    h("div", { class: "acoes" },
      h("button", { class: "btn", type: "button", onclick: fecharModal }, "Cancelar"),
      salvar));

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const dados = {};
    for (const c of cfg.campos) {
      const entrada = entradas[c.nome];
      if (c.tipo === "checkbox") dados[c.nome] = entrada.checked;
      else if (c.numero) dados[c.nome] = entrada.value === "" ? null : Number(entrada.value);
      else dados[c.nome] = entrada.value.trim();
    }
    executar(salvar, async () => {
      if (item) await Api.atualizar(chave, item.id, dados);
      else await Api.criar(chave, dados);
      fecharModal();
      aviso(item ? "Alterações salvas." : `Novo ${cfg.singular} cadastrado.`);
      rotear();
    });
  });

  abrirModal(item ? `Editar ${cfg.singular}` : cfg.novo, form);
}

async function excluirItem(chave, item) {
  const cfg = RECURSOS[chave];
  const ok = await confirmar(`Excluir ${cfg.singular}?`, `${item.nome} será removido do cadastro.`, "Excluir");
  if (!ok) return;
  try {
    await Api.excluir(chave, item.id);
    aviso(`${item.nome} foi excluído.`);
    rotear();
  } catch (e) {
    aviso(e.message, "erro"); // ex.: "possui agendamentos e não pode ser excluído"
  }
}

/* ---------- navegação ---------- */

const TELAS = {
  inicio: (raiz, r) => telaInicio(raiz, r),
  agenda: (raiz, r) => telaAgenda(raiz, r),
  clientes: (raiz, r) => telaRecurso(raiz, r, "clientes"),
  profissionais: (raiz, r) => telaRecurso(raiz, r, "profissionais"),
  servicos: (raiz, r) => telaRecurso(raiz, r, "servicos"),
};

async function rotear() {
  const nome = location.hash.slice(1) in TELAS ? location.hash.slice(1) : "inicio";
  const raiz = $("#conteudo");
  const rodada = ++estado.rodada;

  for (const link of document.querySelectorAll("#menu a")) {
    if (link.getAttribute("href") === `#${nome}`) link.setAttribute("aria-current", "page");
    else link.removeAttribute("aria-current");
  }

  try {
    await TELAS[nome](raiz, rodada);
  } catch (e) {
    if (rodada !== estado.rodada) return;
    raiz.replaceChildren(h("div", { class: "vazio erro" },
      h("p", {}, e.message),
      h("button", { class: "btn", type: "button", onclick: rotear }, "Tentar de novo")));
  }
}

window.addEventListener("hashchange", () => { rotear(); $("#conteudo").focus({ preventScroll: true }); });
rotear();
