-- Create sequence for users table
CREATE SEQUENCE IF NOT EXISTS users_id_seq;

-- Create users table
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY DEFAULT nextval('users_id_seq'),
  username TEXT NOT NULL,
  password TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'user',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT now()
);

-- Create sequence for internet_plans table
CREATE SEQUENCE IF NOT EXISTS internet_plans_id_seq;

-- Create internet_plans table
CREATE TABLE IF NOT EXISTS internet_plans (
  id INTEGER PRIMARY KEY DEFAULT nextval('internet_plans_id_seq'),
  name TEXT NOT NULL,
  download_speed INTEGER NOT NULL,
  upload_speed INTEGER NOT NULL,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  is_active BOOLEAN NOT NULL DEFAULT true
);

-- Create sequence for speed_tests table
CREATE SEQUENCE IF NOT EXISTS speed_tests_id_seq;

-- Create speed_tests table
CREATE TABLE IF NOT EXISTS speed_tests (
  id INTEGER PRIMARY KEY DEFAULT nextval('speed_tests_id_seq'),
  customer_id TEXT NOT NULL,
  test_location TEXT,
  internet_plan TEXT,
  timestamp TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT now(),
  download_speed REAL NOT NULL,
  upload_speed REAL NOT NULL,
  ping REAL NOT NULL,
  jitter REAL NOT NULL,
  packet_loss REAL NOT NULL,
  isp TEXT,
  ip_address TEXT,
  server TEXT,
  distance TEXT,
  user_agent TEXT,
  download_data REAL,
  upload_data REAL,
  test_duration REAL,
  download_percentile REAL,
  upload_percentile REAL,
  username TEXT
);

-- Create session table
CREATE TABLE IF NOT EXISTS session (
  sid VARCHAR PRIMARY KEY,
  sess JSON NOT NULL,
  expire TIMESTAMP(6) NOT NULL
);

-- Insert user data
INSERT INTO users (id, username, password, role, is_active, created_at) VALUES (1, 'admin', 'd417e68ebc536ffdb74e90fb37be2867f7880a4ab2c3c836554f998f2c0a8bfee6cd0b441cb114dffd0e611f919cf6db0eaf7f069209f022d343c6bf6ca8a8c8.3d207507646baaa64ed2389b8c12b0c5', 'super_admin', true, '2025-03-26 07:16:22.941');
INSERT INTO users (id, username, password, role, is_active, created_at) VALUES (2, 'clifford', '5f2f6e12cd470fa9b2855c8476a93805f498a7b1a8559ae1810f6026e74387a729542608a3d87b39b381b03c4f098a95e1d099885de08ea47ce41b53942a68c5.5dc54825075427c2bac1708965b86237', 'super_admin', true, '2025-03-26 07:19:11.371');
INSERT INTO users (id, username, password, role, is_active, created_at) VALUES (3, 'santosh', '0dd3d63faf5564b67ce4f63cdb9d380b6b7bf5595548a9e3d8484e5892e1b4b204296820a32f06c0f1f83604a41d59b17afd4f1e0b2bdedfa3fb5c8df08ab649.cfc102feb38fb3652db7d2b0d047d0a6', 'user', true, '2025-03-26 07:20:12.621');
INSERT INTO users (id, username, password, role, is_active, created_at) VALUES (5, 'dipesh', '05d189dbea50e6b10aada2fd7a6e1e72154c114c31a74997fb57a792dcbeca09eb75810d66d549a02b2792e4d39836d75bd8153d38b22efaefc33077fba5b204.b406ffeeaa1b017c305520dd29f585bf', 'user', true, '2025-03-28 07:58:10.639');
INSERT INTO users (id, username, password, role, is_active, created_at) VALUES (4, 'jatin', 'b3628da96189d875dd6587f24a5e8ded9e205c5c1fedd910864edca4a8cd54ef8616442a082591375ee968cd5beff8e6c411fc0e9a6afd9424d45d07650704e3.3b9620689b41d6c3c8273684bc462ed4', 'user', true, '2025-03-26 08:51:35.464');
INSERT INTO users (id, username, password, role, is_active, created_at) VALUES (6, 'akshay', '802b11937e12cdd4f32848ed5effabf0bed9ffb81d20de0a8dc0f08d62759c7ceec452720b88caeb458212ced8b9cfcbf3da55065f385cd94cc3b4a808950a45.f4f0e2bdd5ef18c81c939a560711b8bf', 'user', true, '2025-03-28 10:23:46.625');

-- Insert internet plans data
INSERT INTO internet_plans (id, name, download_speed, upload_speed, description, created_at, is_active) VALUES (1, 'Basic 50Mbps', 50, 50, NULL, '2025-03-27 07:18:08.992+00', true);
INSERT INTO internet_plans (id, name, download_speed, upload_speed, description, created_at, is_active) VALUES (2, 'Premium 1 Gbps', 1024, 1024, NULL, '2025-03-27 07:45:09.771+00', true);
INSERT INTO internet_plans (id, name, download_speed, upload_speed, description, created_at, is_active) VALUES (3, 'Premium 200 Mbps', 200, 200, NULL, '2025-03-28 07:21:52.601+00', true);
INSERT INTO internet_plans (id, name, download_speed, upload_speed, description, created_at, is_active) VALUES (4, 'Premium 50 Mbps', 500, 500, NULL, '2025-03-28 07:59:08.302+00', true);
INSERT INTO internet_plans (id, name, download_speed, upload_speed, description, created_at, is_active) VALUES (5, 'Basic 1 Gbps', 1024, 1024, NULL, '2025-03-28 10:24:21.932+00', true);

-- Reset sequences
SELECT setval('users_id_seq', (SELECT MAX(id) FROM users));
SELECT setval('internet_plans_id_seq', (SELECT MAX(id) FROM internet_plans));
SELECT setval('speed_tests_id_seq', (SELECT COALESCE(MAX(id), 0) FROM speed_tests));
