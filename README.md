# Sevenella Club — Sistema de agendamento de salão

Projeto Integrado de Desenvolvimento de Websites (DWS), Programação Orientada a Objetos (POO) e Banco de Dados (BD).

O repositório contém o sistema completo: front-end em HTML/CSS/JavaScript, API em Python/Flask e banco SQLite. O front-end utiliza `fetch()` para consumir as rotas da API.

## Tecnologias

- **Front-end:** HTML5, CSS3 e JavaScript.
- **Back-end:** Python 3 e Flask.
- **POO:** classes de Cliente, Profissional, Serviço e Agendamento.
- **Persistência:** SQLite.
- **Acesso a dados:** classes DAO com comandos SQL parametrizados.
- **Testes:** `unittest` e cliente de testes do Flask.

## Estrutura do projeto

```text
agenda-salao-projeto/
├── index.html           # entrada do GitHub Pages (prévia estática)
├── painel.html          # painel no GitHub Pages (requer API Flask)
├── app/
│   ├── __init__.py       # configuração da aplicação Flask e rotas de páginas
│   ├── database.py      # conexão e operações com SQLite
│   ├── models.py        # classes de domínio e validações (POO)
│   ├── dao.py           # operações SQL (DAO)
│   └── routes.py        # endpoints REST em JSON
├── database/
│   ├── schema.sql       # tabelas, chaves e índices
│   └── seed.sql         # registros de demonstração
├── static/
│   ├── index.html       # site público Sevenella Club
│   ├── painel.html      # painel administrativo
│   ├── css/             # estilos do site e do painel
│   ├── js/              # integração Fetch e interações
│   └── img/             # ilustração do salão
├── tests/
│   └── test_api.py      # testes automatizados da API e das páginas
├── init_db.py           # criação inicial do banco
├── run.py               # inicialização local / entrada WSGI
├── Procfile             # comando de inicialização em hospedagem WSGI
└── requirements.txt     # dependências Python
```

## Como executar no Windows (VS Code)

Abra o terminal dentro da pasta que contém `run.py` e execute: 

1. Confira se o Python está instalado: `py --version`. Se esse comando não funcionar, instale o Python 3 e marque a opção **Add Python to PATH** durante a instalação.
2. Crie o ambiente virtual: `py -m venv .venv`.
3. Ative o ambiente: `.venv\Scripts\activate`.
4. Instale as dependências: `py -m pip install -r requirements.txt`.
5. Crie o banco e os dados iniciais: `py init_db.py`.
6. Inicie o sistema: `py run.py`.
7. Abra no navegador: `http://127.0.0.1:5000`.
8. Para acessar o painel, abra: `http://127.0.0.1:5000/painel`.

**Atenção:** `py init_db.py` cria o banco apenas quando ele ainda não existe. Para apagar o banco atual e recriar os registros de demonstração, use `py init_db.py --reset`. Esse comando apaga os dados salvos no banco local.

## Banco de dados

| Tabela | Conteúdo | Relacionamentos |
|---|---|---|
| `clientes` | dados dos clientes | pode ter vários agendamentos |
| `profissionais` | equipe e situação ativa/inativa | pode ter vários agendamentos |
| `servicos` | nome, preço e duração | pode aparecer em vários agendamentos |
| `agendamentos` | data, horário e status | referencia cliente, profissional e serviço |

As relações são garantidas por chaves estrangeiras. O banco também possui índices para consultas e prevenção de horários duplicados. A API verifica sobreposição de duração entre atendimentos do mesmo profissional.

## Organização da POO e do acesso ao banco

- `models.py`: classes que representam as entidades e validam os dados recebidos.
- `dao.py`: classes DAO que concentram os comandos SQL e transformam os registros em objetos.
- `database.py`: classe responsável por abrir, consultar, executar comandos e fechar a conexão SQLite.
- `routes.py`: recebe as requisições HTTP, utiliza modelos e DAOs e devolve respostas JSON.

## Rotas principais da API

| Método | Endpoint | Função |
|---|---|---|
| GET, POST | `/api/clientes` | listar e cadastrar clientes |
| GET, PUT, DELETE | `/api/clientes/<id>` | consultar, editar e excluir cliente |
| GET, POST | `/api/servicos` | listar e cadastrar serviços |
| GET, PUT, DELETE | `/api/servicos/<id>` | consultar, editar e excluir serviço |
| GET, POST | `/api/profissionais` | listar e cadastrar profissionais |
| GET, PUT, DELETE | `/api/profissionais/<id>` | consultar, editar e excluir profissional |
| GET, POST | `/api/agendamentos` | listar e criar agendamentos |
| GET | `/api/agendamentos/<id>` | consultar agendamento |
| PATCH | `/api/agendamentos/<id>/cancelar` | cancelar agendamento |
| PATCH | `/api/agendamentos/<id>/concluir` | concluir agendamento |
| GET | `/api/disponibilidade` | consultar horários ocupados |

A listagem de profissionais aceita `?todos=1` para incluir os inativos. A listagem de agendamentos aceita filtros como `data`, `profissional_id`, `cliente_id` e `status`.

## Testes

Com o ambiente virtual ativado e as dependências instaladas, execute:

```bash
py -m unittest discover -s tests -v
```

Os testes verificam cadastro, consulta, edição, exclusão, validações, conflitos de horários, cancelamento, conclusão e entrega das páginas/arquivos estáticos.

## Publicação e GitHub Pages

O GitHub é usado para versionar e entregar **todo o código-fonte** do projeto. O GitHub Pages hospeda apenas arquivos estáticos (HTML, CSS, JavaScript e imagens); ele **não executa Python/Flask nem mantém o banco SQLite**. Portanto, publicar este repositório no Pages, sozinho, não coloca o sistema integrado para funcionar.

Para demonstrar o sistema completo pela internet, publique a aplicação Flask em uma hospedagem que execute Python/WSGI e configure o banco em armazenamento persistente. O `Procfile` deste projeto informa o comando WSGI (`gunicorn run:app`), mas a hospedagem e a persistência do banco precisam ser configuradas separadamente. Em hospedagens com armazenamento efêmero, os dados SQLite podem ser perdidos quando a aplicação reiniciar ou for implantada novamente.

## Entrega no GitHub conforme as instruções da atividade

1. Envie a pasta completa do projeto para o repositório GitHub. Não envie somente `static/` ou somente o arquivo `index.html`.
2. Faça commits durante o desenvolvimento, registrando as etapas do trabalho.
3. Nas configurações do repositório, adicione o professor como colaborador pelo e-mail informado no documento da atividade: `leonardo.stephan@eaportal.org`.
4. Antes da apresentação, execute o projeto localmente e teste o site, o painel e as operações da API.



## Abrir pelo GitHub Pages

O repositório agora possui `index.html` na raiz. Para publicar a prévia visual:

1. Envie **todo o conteúdo** desta pasta para a raiz do repositório (não envie apenas `static/`).
2. No GitHub, abra **Settings → Pages**.
3. Em **Build and deployment**, escolha **Deploy from a branch**.
4. Selecione a branch `main` e a pasta `/ (root)`, depois clique em **Save**.
5. Aguarde a publicação e abra o endereço mostrado na própria página do GitHub Pages.

Os arquivos `index.html` e `painel.html` na raiz usam caminhos relativos, então funcionam no endereço de projeto do GitHub Pages. A pasta `static/` continua guardando os arquivos originais do front-end usados pelo Flask.

**Limitação importante:** GitHub Pages publica somente arquivos estáticos. Ele não executa Python/Flask, não oferece a API `/api/...` e não hospeda o banco SQLite. Assim, a página visual abre no Pages, mas agendamentos, carregamento de serviços/equipe e painel com dados reais só funcionarão quando o back-end Flask estiver publicado em uma hospedagem Python. O código completo do back-end e do banco permanece neste repositório para a entrega escolar.

## Rodar o sistema completo localmente

No VS Code, abra a pasta que contém `run.py` e execute no terminal:

```powershell
py -m venv .venv
.venv\Scripts\activate
py -m pip install -r requirements.txt
py init_db.py
py run.py
```

Depois acesse `http://127.0.0.1:5000`. O site e o painel completos com API e banco ficam disponíveis localmente.
