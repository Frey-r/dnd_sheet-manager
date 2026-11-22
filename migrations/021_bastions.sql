-- +goose Up
-- Bastions (D&D 2024 DMG): facilities, hirelings, defenders, warehouse, construction queue and
-- turn log, plus the editable facility catalogue and d100 events table
-- (openspec/specs/market-bastions.md §6). Rows with campaign_id NULL are the seeded defaults a
-- campaign clones the first time its GM or an owner opens the catalogue.

CREATE TABLE bastion_catalog (
    id BIGSERIAL PRIMARY KEY,
    campaign_id BIGINT REFERENCES campaigns(id) ON DELETE CASCADE,
    name VARCHAR(120) NOT NULL,
    min_level INT NOT NULL DEFAULT 5 CHECK (min_level BETWEEN 1 AND 20),
    prerequisite TEXT NOT NULL DEFAULT '',
    size VARCHAR(10) NOT NULL DEFAULT 'roomy' CHECK (size IN ('cramped', 'roomy', 'vast')),
    description TEXT NOT NULL DEFAULT '',
    hirelings INT NOT NULL DEFAULT 1 CHECK (hirelings >= 0),
    orders TEXT[] NOT NULL DEFAULT '{}',
    options JSONB NOT NULL DEFAULT '[]',
    sort_order INT NOT NULL DEFAULT 0
);
CREATE INDEX bastion_catalog_campaign_idx ON bastion_catalog(campaign_id);

CREATE TABLE bastion_events (
    id BIGSERIAL PRIMARY KEY,
    campaign_id BIGINT REFERENCES campaigns(id) ON DELETE CASCADE,
    roll_min INT NOT NULL CHECK (roll_min BETWEEN 1 AND 100),
    roll_max INT NOT NULL CHECK (roll_max BETWEEN 1 AND 100),
    name VARCHAR(120) NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    reward_dice VARCHAR(20) NOT NULL DEFAULT '',
    reward_mult_cp BIGINT NOT NULL DEFAULT 0
);
CREATE INDEX bastion_events_campaign_idx ON bastion_events(campaign_id);

CREATE TABLE bastions (
    id BIGSERIAL PRIMARY KEY,
    campaign_id BIGINT NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
    character_id BIGINT NOT NULL UNIQUE REFERENCES characters(id) ON DELETE CASCADE,
    name VARCHAR(160) NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX bastions_campaign_idx ON bastions(campaign_id);

CREATE TABLE bastion_facilities (
    id BIGSERIAL PRIMARY KEY,
    bastion_id BIGINT NOT NULL REFERENCES bastions(id) ON DELETE CASCADE,
    kind VARCHAR(10) NOT NULL CHECK (kind IN ('basic', 'special')),
    catalog_id BIGINT REFERENCES bastion_catalog(id) ON DELETE SET NULL,
    name VARCHAR(120) NOT NULL,
    basic_kind VARCHAR(30) NOT NULL DEFAULT '',
    size VARCHAR(10) NOT NULL DEFAULT 'roomy' CHECK (size IN ('cramped', 'roomy', 'vast')),
    order_name VARCHAR(20) NOT NULL DEFAULT '',
    order_option JSONB,
    turns_left INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX bastion_facilities_bastion_idx ON bastion_facilities(bastion_id);

CREATE TABLE bastion_hirelings (
    id BIGSERIAL PRIMARY KEY,
    bastion_id BIGINT NOT NULL REFERENCES bastions(id) ON DELETE CASCADE,
    facility_id BIGINT REFERENCES bastion_facilities(id) ON DELETE CASCADE,
    name VARCHAR(160) NOT NULL
);
CREATE INDEX bastion_hirelings_bastion_idx ON bastion_hirelings(bastion_id);

CREATE TABLE bastion_defenders (
    id BIGSERIAL PRIMARY KEY,
    bastion_id BIGINT NOT NULL REFERENCES bastions(id) ON DELETE CASCADE,
    name VARCHAR(160) NOT NULL,
    source VARCHAR(200) NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX bastion_defenders_bastion_idx ON bastion_defenders(bastion_id);

CREATE TABLE bastion_warehouse (
    id BIGSERIAL PRIMARY KEY,
    bastion_id BIGINT NOT NULL REFERENCES bastions(id) ON DELETE CASCADE,
    name VARCHAR(200) NOT NULL,
    item_type VARCHAR(50) NOT NULL DEFAULT 'misc',
    rarity VARCHAR(50) NOT NULL DEFAULT 'common',
    quantity INT NOT NULL DEFAULT 1 CHECK (quantity > 0),
    value_cp BIGINT NOT NULL DEFAULT 0 CHECK (value_cp >= 0),
    description TEXT NOT NULL DEFAULT '',
    source VARCHAR(200) NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX bastion_warehouse_bastion_idx ON bastion_warehouse(bastion_id);

CREATE TABLE bastion_construction (
    id BIGSERIAL PRIMARY KEY,
    bastion_id BIGINT NOT NULL REFERENCES bastions(id) ON DELETE CASCADE,
    kind VARCHAR(10) NOT NULL CHECK (kind IN ('add', 'enlarge')),
    facility_id BIGINT REFERENCES bastion_facilities(id) ON DELETE CASCADE,
    basic_kind VARCHAR(30) NOT NULL DEFAULT '',
    target_size VARCHAR(10) NOT NULL CHECK (target_size IN ('cramped', 'roomy', 'vast')),
    days_left INT NOT NULL CHECK (days_left >= 0),
    total_days INT NOT NULL CHECK (total_days > 0),
    cost_cp BIGINT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX bastion_construction_bastion_idx ON bastion_construction(bastion_id);

CREATE TABLE bastion_turn_log (
    id BIGSERIAL PRIMARY KEY,
    bastion_id BIGINT NOT NULL REFERENCES bastions(id) ON DELETE CASCADE,
    campaign_id BIGINT NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
    turn_number INT NOT NULL,
    entries TEXT[] NOT NULL DEFAULT '{}',
    event_name VARCHAR(120) NOT NULL DEFAULT '',
    event_roll INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX bastion_turn_log_bastion_idx ON bastion_turn_log(bastion_id, turn_number DESC);
CREATE INDEX bastion_turn_log_campaign_idx ON bastion_turn_log(campaign_id, turn_number DESC);

-- Seeded 2024 facility catalogue (short paraphrases, the GM book is the reference).
-- Option fields: kind item|gold|defender|narrative, turns, cost_cp, value_cp, gold_dice × gold_mult_cp.
INSERT INTO bastion_catalog (name, min_level, prerequisite, size, description, hirelings, orders, options, sort_order) VALUES
('Estudio arcano', 5, 'Poder usar un foco arcano', 'roomy', 'Sala de estudio y práctica mágica con libros y herramientas de lanzador.', 1, ARRAY['craft'],
 '[{"id":"craft-focus","order":"craft","name":"Foco arcano","description":"Fabrica un foco arcano.","turns":1,"cost_cp":0,"kind":"item","item_name":"Foco arcano","item_type":"gear","rarity":"common","qty":1,"value_cp":1000},{"id":"craft-book","order":"craft","name":"Libro de conjuros","description":"Copia un libro de conjuros en blanco.","turns":2,"cost_cp":5000,"kind":"item","item_name":"Libro de conjuros","item_type":"gear","rarity":"common","qty":1,"value_cp":5000}]', 10),
('Armería', 5, '', 'roomy', 'Almacena y mantiene armas y armaduras para los defensores.', 1, ARRAY['trade'],
 '[{"id":"trade-ammo","order":"trade","name":"Abastecer munición","description":"Llena las aljabas del bastión.","turns":1,"cost_cp":0,"kind":"item","item_name":"Munición","item_type":"ammunition","rarity":"common","qty":20,"value_cp":5}]', 20),
('Cuartel', 5, '', 'roomy', 'Alojamiento y entrenamiento para defensores del bastión.', 1, ARRAY['recruit'],
 '[{"id":"recruit-4","order":"recruit","name":"Reclutar defensores","description":"Cuatro defensores se unen al bastión.","turns":1,"cost_cp":0,"kind":"defender","defenders":4}]', 30),
('Jardín', 5, '', 'roomy', 'Huertos y plantas útiles, medicinales o venenosas.', 1, ARRAY['harvest'],
 '[{"id":"harvest-heal","order":"harvest","name":"Hierbas curativas","description":"Cosecha plantas con las que preparar pociones.","turns":1,"cost_cp":0,"kind":"item","item_name":"Poción de curación","item_type":"potion","rarity":"common","qty":2,"value_cp":5000},{"id":"harvest-poison","order":"harvest","name":"Veneno","description":"Destila veneno de plantas del jardín.","turns":1,"cost_cp":0,"kind":"item","item_name":"Vial de veneno","item_type":"misc","rarity":"common","qty":1,"value_cp":10000}]', 40),
('Biblioteca', 5, '', 'roomy', 'Colección de libros y pergaminos para investigar.', 1, ARRAY['research'],
 '[{"id":"research-topic","order":"research","name":"Investigar un tema","description":"Los empleados buscan información sobre un tema que elija el dueño.","turns":1,"cost_cp":0,"kind":"narrative","text":"La biblioteca reúne información útil sobre el tema investigado. El DM la revela."}]', 50),
('Santuario', 5, 'Poder usar un foco sagrado o druídico', 'roomy', 'Espacio consagrado a una deidad o a la naturaleza.', 1, ARRAY['craft'],
 '[{"id":"craft-holy","order":"craft","name":"Agua bendita","description":"Prepara frascos de agua bendita.","turns":1,"cost_cp":0,"kind":"item","item_name":"Agua bendita","item_type":"potion","rarity":"common","qty":2,"value_cp":2500},{"id":"craft-symbol","order":"craft","name":"Foco sagrado","description":"Talla un foco sagrado.","turns":1,"cost_cp":0,"kind":"item","item_name":"Foco sagrado","item_type":"gear","rarity":"common","qty":1,"value_cp":500}]', 60),
('Herrería', 5, '', 'roomy', 'Fragua y yunque para trabajar el metal.', 1, ARRAY['craft'],
 '[{"id":"craft-gear","order":"craft","name":"Equipo de herrero","description":"Forja herramientas y piezas de equipo.","turns":2,"cost_cp":5000,"kind":"item","item_name":"Herramientas reforzadas","item_type":"gear","rarity":"common","qty":1,"value_cp":15000},{"id":"craft-armor","order":"craft","name":"Armadura pesada","description":"Forja una armadura a medida.","turns":3,"cost_cp":20000,"kind":"item","item_name":"Armadura de placas","item_type":"armor","rarity":"common","qty":1,"value_cp":150000}]', 70),
('Almacén', 5, '', 'roomy', 'Bodega para guardar mercancías y comerciar con ellas.', 1, ARRAY['trade'],
 '[{"id":"trade-goods","order":"trade","name":"Comerciar mercancías","description":"Invierte en mercancías y revéndelas.","turns":1,"cost_cp":10000,"kind":"gold","gold_dice":"1d6","gold_mult_cp":3000}]', 80),
('Taller', 5, '', 'roomy', 'Mesas de trabajo y herramientas para oficios variados.', 1, ARRAY['craft'],
 '[{"id":"craft-gear","order":"craft","name":"Equipo de aventurero","description":"Fabrica equipo de aventurero.","turns":1,"cost_cp":1000,"kind":"item","item_name":"Equipo de aventurero","item_type":"gear","rarity":"common","qty":1,"value_cp":3000}]', 90),
('Sala de juegos', 9, '', 'roomy', 'Mesas de juego que atraen a clientes con dinero.', 1, ARRAY['trade'],
 '[{"id":"trade-games","order":"trade","name":"Organizar partidas","description":"Las apuestas dejan beneficios a la casa.","turns":1,"cost_cp":0,"kind":"gold","gold_dice":"2d6","gold_mult_cp":1000}]', 100),
('Invernadero', 9, '', 'roomy', 'Plantas raras cultivadas en condiciones controladas.', 1, ARRAY['harvest'],
 '[{"id":"harvest-greater","order":"harvest","name":"Hierbas raras","description":"Cosecha ingredientes para pociones potentes.","turns":1,"cost_cp":0,"kind":"item","item_name":"Poción de curación mayor","item_type":"potion","rarity":"uncommon","qty":1,"value_cp":15000}]', 110),
('Laboratorio', 9, '', 'roomy', 'Alambiques y probetas para alquimia.', 1, ARRAY['craft'],
 '[{"id":"craft-antitoxin","order":"craft","name":"Antitoxina","description":"Destila antitoxina.","turns":1,"cost_cp":0,"kind":"item","item_name":"Antitoxina","item_type":"potion","rarity":"common","qty":2,"value_cp":5000},{"id":"craft-acid","order":"craft","name":"Fuego de alquimista","description":"Prepara frascos de fuego de alquimista.","turns":1,"cost_cp":2000,"kind":"item","item_name":"Fuego de alquimista","item_type":"gear","rarity":"common","qty":3,"value_cp":5000}]', 120),
('Sacristía', 9, 'Poder usar un foco sagrado', 'roomy', 'Taller de objetos litúrgicos y reliquias menores.', 1, ARRAY['craft'],
 '[{"id":"craft-relic","order":"craft","name":"Objeto litúrgico","description":"Prepara un objeto ritual bendecido.","turns":2,"cost_cp":10000,"kind":"item","item_name":"Objeto litúrgico bendecido","item_type":"misc","rarity":"uncommon","qty":1,"value_cp":40000}]', 130),
('Scriptorium', 9, '', 'roomy', 'Escritorios para copiar textos, mapas y pergaminos.', 1, ARRAY['craft'],
 '[{"id":"craft-scroll","order":"craft","name":"Pergamino de conjuro","description":"Copia un pergamino de conjuro de nivel bajo.","turns":2,"cost_cp":10000,"kind":"item","item_name":"Pergamino de conjuro","item_type":"scroll","rarity":"common","qty":1,"value_cp":15000}]', 140),
('Establo', 9, '', 'roomy', 'Cuadras para monturas y animales de tiro.', 1, ARRAY['trade'],
 '[{"id":"trade-animals","order":"trade","name":"Criar y vender animales","description":"Cría y vende monturas.","turns":1,"cost_cp":5000,"kind":"gold","gold_dice":"1d6","gold_mult_cp":4000}]', 150),
('Círculo de teletransporte', 9, 'Poder lanzar conjuros', 'roomy', 'Círculo permanente que enlaza con otros círculos conocidos.', 1, ARRAY['empower'],
 '[{"id":"empower-link","order":"empower","name":"Sintonizar el círculo","description":"El círculo queda sintonizado con un destino.","turns":1,"cost_cp":0,"kind":"narrative","text":"El círculo queda listo para viajar al destino sintonizado."}]', 160),
('Teatro', 9, '', 'roomy', 'Escenario y gradas para representar obras.', 1, ARRAY['empower'],
 '[{"id":"empower-play","order":"empower","name":"Estrenar una obra","description":"La compañía ensaya y estrena una obra.","turns":1,"cost_cp":0,"kind":"narrative","text":"La obra triunfa y mejora la fama del bastión. El DM decide el beneficio."}]', 170),
('Zona de entrenamiento', 9, '', 'roomy', 'Espacio para entrenar combate y habilidades.', 1, ARRAY['empower'],
 '[{"id":"empower-drill","order":"empower","name":"Entrenamiento intensivo","description":"Los defensores y el dueño entrenan.","turns":1,"cost_cp":0,"kind":"narrative","text":"Quienes entrenaron obtienen un beneficio temporal. El DM lo detalla."}]', 180),
('Sala de trofeos', 9, '', 'roomy', 'Exhibe trofeos y objetos de aventuras pasadas.', 1, ARRAY['research'],
 '[{"id":"research-lore","order":"research","name":"Estudiar un trofeo","description":"Investiga la historia de un trofeo.","turns":1,"cost_cp":0,"kind":"narrative","text":"El estudio del trofeo revela información o un secreto. El DM la revela."}]', 190),
('Archivo', 13, '', 'roomy', 'Registros ordenados de documentos y noticias.', 1, ARRAY['research'],
 '[{"id":"research-record","order":"research","name":"Consultar archivos","description":"Busca registros sobre un asunto.","turns":1,"cost_cp":0,"kind":"narrative","text":"El archivo contiene datos fiables sobre el asunto. El DM los revela."}]', 200),
('Cámara de meditación', 13, '', 'roomy', 'Sala silenciosa para la contemplación.', 1, ARRAY['empower'],
 '[{"id":"empower-focus","order":"empower","name":"Meditar","description":"La meditación concede serenidad.","turns":1,"cost_cp":0,"kind":"narrative","text":"El dueño obtiene un beneficio de serenidad. El DM lo detalla."}]', 210),
('Casa de fieras', 13, '', 'vast', 'Recinto con criaturas amaestradas.', 1, ARRAY['recruit'],
 '[{"id":"recruit-beasts","order":"recruit","name":"Reclutar criaturas","description":"Una criatura amaestrada se une como defensor.","turns":2,"cost_cp":50000,"kind":"defender","defenders":1}]', 220),
('Observatorio', 13, '', 'roomy', 'Telescopios y cartas estelares.', 1, ARRAY['empower'],
 '[{"id":"empower-stars","order":"empower","name":"Leer las estrellas","description":"Las estrellas ofrecen una guía.","turns":1,"cost_cp":0,"kind":"narrative","text":"El observatorio revela un presagio o una guía. El DM la detalla."}]', 230),
('Taberna', 13, '', 'roomy', 'Local público donde corren rumores.', 1, ARRAY['research'],
 '[{"id":"research-rumor","order":"research","name":"Escuchar rumores","description":"Los clientes hablan de lo que oyen.","turns":1,"cost_cp":0,"kind":"narrative","text":"Los parroquianos traen rumores útiles. El DM los revela."}]', 240),
('Relicario', 13, '', 'roomy', 'Guarda objetos sagrados o poderosos.', 1, ARRAY['harvest'],
 '[{"id":"harvest-relic","order":"harvest","name":"Reunir ofrendas","description":"Las ofrendas dejan objetos valiosos.","turns":1,"cost_cp":0,"kind":"item","item_name":"Ofrenda valiosa","item_type":"misc","rarity":"uncommon","qty":1,"value_cp":50000}]', 250),
('Demiplano', 17, 'Poder lanzar conjuros', 'vast', 'Espacio extradimensional propio del bastión.', 1, ARRAY['empower'],
 '[{"id":"empower-plane","order":"empower","name":"Moldear el demiplano","description":"Altera el entorno del demiplano.","turns":1,"cost_cp":0,"kind":"narrative","text":"El demiplano cambia según la voluntad del dueño. El DM lo detalla."}]', 260),
('Sede gremial', 17, '', 'vast', 'Salón de un gremio con numerosos contactos.', 1, ARRAY['recruit'],
 '[{"id":"recruit-guild","order":"recruit","name":"Reclutar especialistas","description":"Especialistas del gremio se unen como defensores.","turns":1,"cost_cp":20000,"kind":"defender","defenders":2}]', 270),
('Sanctasanctórum', 17, 'Poder usar un foco sagrado o druídico', 'vast', 'Santuario mayor de poder divino.', 1, ARRAY['empower'],
 '[{"id":"empower-sanctum","order":"empower","name":"Invocar bendición","description":"Una bendición recae sobre el bastión.","turns":1,"cost_cp":0,"kind":"narrative","text":"El bastión recibe una bendición. El DM la detalla."}]', 280),
('Sala de guerra', 17, '', 'vast', 'Mesa de mando y mapas estratégicos.', 1, ARRAY['recruit'],
 '[{"id":"recruit-troops","order":"recruit","name":"Alistar tropas","description":"Una tropa se une al bastión.","turns":1,"cost_cp":50000,"kind":"defender","defenders":6}]', 290);

-- Seeded d100 events table.
INSERT INTO bastion_events (roll_min, roll_max, name, description, reward_dice, reward_mult_cp) VALUES
(1, 50, 'Todo en calma', 'No ocurre nada notable esta semana.', '', 0),
(51, 55, 'Ataque', 'Atacantes asaltan el bastión. Los defensores resisten y se pierden algunos.', '', 0),
(56, 58, 'Empleado criminal', 'Un empleado resulta ser un delincuente. El DM decide las consecuencias.', '', 0),
(59, 63, 'Oportunidad extraordinaria', 'Surge una oportunidad especial que el dueño puede aprovechar.', '', 0),
(64, 71, 'Visitas amistosas', 'Visitantes amistosos llegan y ofrecen noticias o un pequeño regalo.', '', 0),
(72, 76, 'Huésped', 'Un huésped pide alojamiento en el bastión.', '', 0),
(77, 79, 'Empleados perdidos', 'Algunos empleados desaparecen y hay que encontrarlos.', '', 0),
(80, 83, 'Descubrimiento mágico', 'Se descubre algo mágico en los terrenos del bastión.', '', 0),
(84, 91, 'Refugiados', 'Refugiados piden asilo en el bastión.', '', 0),
(92, 98, 'Petición de ayuda', 'Un vecino pide ayuda al dueño del bastión.', '', 0),
(99, 100, 'Tesoro', 'Los empleados desentierran un tesoro.', '4d6', 10000);

-- +goose Down
DROP TABLE IF EXISTS bastion_turn_log;
DROP TABLE IF EXISTS bastion_construction;
DROP TABLE IF EXISTS bastion_warehouse;
DROP TABLE IF EXISTS bastion_defenders;
DROP TABLE IF EXISTS bastion_hirelings;
DROP TABLE IF EXISTS bastion_facilities;
DROP TABLE IF EXISTS bastions;
DROP TABLE IF EXISTS bastion_events;
DROP TABLE IF EXISTS bastion_catalog;
