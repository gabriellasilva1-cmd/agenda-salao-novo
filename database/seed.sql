-- Dados de exemplo para testes

INSERT INTO clientes (nome, telefone, email) VALUES
    ('Maria Souza',   '(19) 99999-1111', 'maria@email.com'),
    ('Ana Oliveira',  '(19) 98888-2222', 'ana@email.com'),
    ('Carla Lima',    '(19) 97777-3333', NULL),
    ('Débora Martins','(19) 96666-4444', 'debora@email.com');  -- ainda sem agendamento

INSERT INTO profissionais (nome, especialidade) VALUES
    ('Juliana Costa',  'Cabelo'),
    ('Fernanda Alves', 'Unhas'),
    ('Patrícia Rocha', 'Sobrancelha e estética');  -- ainda sem agendamento

INSERT INTO servicos (nome, preco, duracao_min) VALUES
    ('Corte feminino',  80.00, 60),
    ('Escova',          50.00, 45),
    ('Coloração',      150.00, 120),
    ('Manicure',        35.00, 40),
    ('Sobrancelha',     40.00, 30);  -- ainda não contratado

INSERT INTO agendamentos (cliente_id, profissional_id, servico_id, data_hora, status) VALUES
    (1, 1, 1, '2026-11-10 09:00', 'agendado'),
    (2, 2, 4, '2026-11-10 10:00', 'agendado'),
    (3, 1, 2, '2026-11-10 14:00', 'agendado'),
    (1, 1, 3, '2026-11-03 15:00', 'concluido');
