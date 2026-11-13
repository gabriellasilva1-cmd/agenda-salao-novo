-- Esquema do banco: Agenda de Salão (SQLite)

PRAGMA foreign_keys = ON;

DROP TABLE IF EXISTS agendamentos;
DROP TABLE IF EXISTS servicos;
DROP TABLE IF EXISTS profissionais;
DROP TABLE IF EXISTS clientes;

CREATE TABLE clientes (
    id        INTEGER PRIMARY KEY AUTOINCREMENT,
    nome      TEXT NOT NULL,
    telefone  TEXT NOT NULL,
    email     TEXT UNIQUE
);

CREATE TABLE profissionais (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    nome          TEXT NOT NULL,
    especialidade TEXT,
    ativo         INTEGER NOT NULL DEFAULT 1 CHECK (ativo IN (0, 1))
);

CREATE TABLE servicos (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    nome         TEXT NOT NULL UNIQUE,
    preco        REAL NOT NULL CHECK (preco >= 0),
    duracao_min  INTEGER NOT NULL CHECK (duracao_min > 0)
);

CREATE TABLE agendamentos (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    cliente_id      INTEGER NOT NULL,
    profissional_id INTEGER NOT NULL,
    servico_id      INTEGER NOT NULL,
    data_hora       TEXT NOT NULL,  -- formato 'YYYY-MM-DD HH:MM'
    status          TEXT NOT NULL DEFAULT 'agendado'
                    CHECK (status IN ('agendado', 'concluido', 'cancelado')),
    -- RESTRICT: não permite apagar quem já tem histórico de agendamentos
    FOREIGN KEY (cliente_id)      REFERENCES clientes(id)      ON DELETE RESTRICT,
    FOREIGN KEY (profissional_id) REFERENCES profissionais(id) ON DELETE RESTRICT,
    FOREIGN KEY (servico_id)      REFERENCES servicos(id)      ON DELETE RESTRICT
);

-- Impede dois agendamentos ativos do mesmo profissional no mesmo horário.
-- Agendamentos cancelados ficam de fora da regra, então o horário pode ser reaproveitado.
CREATE UNIQUE INDEX idx_horario_unico
    ON agendamentos(profissional_id, data_hora)
    WHERE status != 'cancelado';

CREATE INDEX idx_agendamentos_data ON agendamentos(data_hora);
CREATE INDEX idx_agendamentos_cliente ON agendamentos(cliente_id);
