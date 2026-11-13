/* Site do salão: carrega serviços e equipe da API e permite agendar online. */

const $ = (seletor) => document.querySelector(seletor);

/** Cria elementos sem innerHTML (os textos nunca são interpretados como HTML). */
function h(tag, atributos = {}, ...filhos) {
  const el = document.createElement(tag);
  for (const [chave, valor] of Object.entries(atributos)) {
    if (valor === null || valor === undefined || valor === false) continue;
    if (chave === "class") el.className = valor;
    else if (chave.startsWith("on")) el.addEventListener(chave.slice(2), valor);
    else el.setAttribute(chave, valor === true ? "" : valor);
  }
  for (const filho of filhos.flat()) {
    if (filho !== null && filho !== undefined && filho !== false) el.append(filho.nodeType ? filho : document.createTextNode(filho));
  }
  return el;
}

const dois = (n) => String(n).padStart(2, "0");
const isoData = (d) => `${d.getFullYear()}-${dois(d.getMonth() + 1)}-${dois(d.getDate())}`;
const dinheiro = (n) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const paraMinutos = (hhmm) => { const [a, b] = hhmm.split(":").map(Number); return a * 60 + b; };
const paraHora = (min) => `${dois(Math.floor(min / 60))}:${dois(min % 60)}`;
const dataLonga = (iso) => {
  const [a, m, d] = iso.split("-").map(Number);
  const t = new Date(a, m - 1, d).toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" });
  return t.charAt(0).toUpperCase() + t.slice(1);
};

const ABRE = 8 * 60;   // 08:00
const FECHA = 20 * 60; // 20:00
const PASSO = 30;      // intervalo entre horários (min)

const estado = { servicos: [], profissionais: [], hora: null };

/* ---------- catálogo (serviços e equipe) ---------- */

async function carregarCatalogo() {
  try {
    [estado.servicos, estado.profissionais] = await Promise.all([Api.listarServicos(), Api.listarProfissionais()]);
  } catch (e) {
    const aviso = h("li", { class: "carregando" }, e.message);
    $("#lista-servicos").replaceChildren(aviso.cloneNode(true));
    $("#lista-equipe").replaceChildren(aviso);
    return;
  }

  $("#lista-servicos").replaceChildren(...(estado.servicos.length
    ? estado.servicos.map((s) => h("li", {},
        h("span", { class: "preco-nome" }, s.nome),
        h("span", { class: "preco-valor" }, dinheiro(s.preco)),
        h("span", { class: "preco-info" }, `${s.duracao_min} minutos`)))
    : [h("li", { class: "carregando" }, "Nenhum serviço cadastrado ainda.")]));

  $("#lista-equipe").replaceChildren(...(estado.profissionais.length
    ? estado.profissionais.map((p) => h("li", {}, h("strong", {}, p.nome), h("span", {}, p.especialidade || "")))
    : [h("li", { class: "carregando" }, "Nenhuma profissional cadastrada ainda.")]));

  preencher($("#f-servico"), estado.servicos.map((s) => [s.id, `${s.nome}: ${dinheiro(s.preco)}, ${s.duracao_min} min`]), "Escolha o serviço");
  preencher($("#f-prof"), estado.profissionais.map((p) => [p.id, p.especialidade ? `${p.nome} (${p.especialidade})` : p.nome]), "Escolha a profissional");
}

function preencher(select, opcoes, rotuloVazio) {
  select.replaceChildren(h("option", { value: "" }, rotuloVazio), ...opcoes.map(([valor, texto]) => h("option", { value: valor }, texto)));
}

/* ---------- horários livres ---------- */

let rodadaHorarios = 0;

async function atualizarHorarios() {
  const caixa = $("#horarios");
  estado.hora = null;
  const servico = estado.servicos.find((s) => String(s.id) === $("#f-servico").value);
  const profissionalId = $("#f-prof").value;
  const data = $("#f-data").value;

  if (!servico || !profissionalId || !data) {
    caixa.replaceChildren(h("p", { class: "dica" }, "Escolha serviço, profissional e dia para ver os horários."));
    return;
  }

  const rodada = ++rodadaHorarios;
  caixa.replaceChildren(h("p", { class: "dica" }, "Buscando horários…"));

  let ocupados;
  try {
    ocupados = (await Api.listarAgendamentos({ data, profissional_id: profissionalId }))
      .filter((a) => a.status !== "cancelado")
      .map((a) => { const ini = paraMinutos(a.data_hora.slice(11)); return [ini, ini + a.duracao_min]; });
  } catch (e) {
    if (rodada === rodadaHorarios) caixa.replaceChildren(h("p", { class: "dica" }, e.message));
    return;
  }
  if (rodada !== rodadaHorarios) return;

  const agora = new Date();
  const hoje = data === isoData(agora);
  const minutosAgora = agora.getHours() * 60 + agora.getMinutes();

  const livres = [];
  for (let m = ABRE; m + servico.duracao_min <= FECHA; m += PASSO) {
    if (hoje && m <= minutosAgora) continue;
    const sobrepoe = ocupados.some(([ini, fim]) => m < fim && m + servico.duracao_min > ini);
    if (!sobrepoe) livres.push(m);
  }

  if (!livres.length) {
    caixa.replaceChildren(h("p", { class: "dica" }, "Não há horários livres neste dia. Tente outra data ou outra profissional."));
    return;
  }

  caixa.replaceChildren(...livres.map((m) => h("button", {
    class: "hora", type: "button", "aria-pressed": "false",
    onclick: (e) => {
      estado.hora = paraHora(m);
      for (const b of caixa.querySelectorAll(".hora")) b.setAttribute("aria-pressed", String(b === e.currentTarget));
      mostrarErro("");
    },
  }, paraHora(m))));
}

function mostrarErro(texto) {
  const el = $("#erro-form");
  el.textContent = texto;
  el.hidden = !texto;
}

/* ---------- envio do agendamento ---------- */

/** Cria o cliente; se o e-mail já existir, reaproveita o cadastro. */
async function obterCliente({ nome, telefone, email }) {
  try {
    return await Api.criar("clientes", { nome, telefone, email });
  } catch (e) {
    if (!email) throw e;
    const existente = (await Api.listarClientes()).find((c) => c.email === email);
    if (!existente) throw e;
    return existente;
  }
}

async function enviar(evento) {
  evento.preventDefault();
  mostrarErro("");

  const nome = $("#f-nome").value.trim();
  const telefone = $("#f-telefone").value.trim();
  const email = $("#f-email").value.trim();
  const servico = estado.servicos.find((s) => String(s.id) === $("#f-servico").value);
  const profissional = estado.profissionais.find((p) => String(p.id) === $("#f-prof").value);
  const data = $("#f-data").value;

  if (!nome || !telefone) return mostrarErro("Informe seu nome e telefone.");
  if (!servico || !profissional || !data) return mostrarErro("Escolha o serviço, a profissional e o dia.");
  if (!estado.hora) return mostrarErro("Toque em um horário livre para continuar.");

  const botao = $("#btn-confirmar");
  botao.disabled = true;
  try {
    const cliente = await obterCliente({ nome, telefone, email });
    await Api.criarAgendamento({
      cliente_id: cliente.id, profissional_id: profissional.id, servico_id: servico.id,
      data_hora: `${data} ${estado.hora}`,
    });
    mostrarConfirmacao({ nome, servico, profissional, data, hora: estado.hora });
  } catch (e) {
    mostrarErro(e.message);
    atualizarHorarios(); // o horário pode ter sido ocupado por outra pessoa
  } finally {
    botao.disabled = false;
  }
}

function mostrarConfirmacao({ nome, servico, profissional, data, hora }) {
  const linhas = [
    ["Cliente", nome],
    ["Serviço", `${servico.nome} (${servico.duracao_min} min)`],
    ["Profissional", profissional.nome],
    ["Quando", `${dataLonga(data)}, ${hora}`],
    ["Valor", dinheiro(servico.preco)],
  ];
  $("#resumo").replaceChildren(...linhas.flatMap(([rotulo, valor]) => [h("dt", {}, rotulo), h("dd", {}, valor)]));
  $("#form-agendar").hidden = true;
  const caixa = $("#confirmacao");
  caixa.hidden = false;
  caixa.focus();
}

function novoAgendamento() {
  $("#form-agendar").reset();
  $("#f-data").value = isoData(new Date());
  $("#confirmacao").hidden = true;
  $("#form-agendar").hidden = false;
  mostrarErro("");
  atualizarHorarios();
  $("#f-nome").focus();
}

/* ---------- início ---------- */

const campoData = $("#f-data");
campoData.min = isoData(new Date());
campoData.value = isoData(new Date());

for (const id of ["#f-servico", "#f-prof", "#f-data"]) $(id).addEventListener("change", atualizarHorarios);
$("#form-agendar").addEventListener("submit", enviar);
$("#btn-outro").addEventListener("click", novoAgendamento);

carregarCatalogo();
