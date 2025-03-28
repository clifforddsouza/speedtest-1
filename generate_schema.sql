-- Get schema definition for all tables
SELECT 
  'CREATE TABLE IF NOT EXISTS ' || tablename || ' (' ||
  string_agg(
    column_name || ' ' || data_type || 
    CASE WHEN character_maximum_length IS NOT NULL 
         THEN '(' || character_maximum_length || ')' 
         ELSE '' END ||
    CASE WHEN is_nullable = 'NO' THEN ' NOT NULL' ELSE '' END ||
    CASE WHEN column_default IS NOT NULL 
         THEN ' DEFAULT ' || column_default 
         ELSE '' END,
    ', '
  ) || ');'
FROM information_schema.columns
WHERE table_schema = 'public'
GROUP BY tablename;

-- Get all data from users table
SELECT 'INSERT INTO users (id, username, password, role, is_active, created_at) VALUES (' ||
       id || ', ' ||
       '''' || username || ''', ' ||
       '''' || password || ''', ' ||
       '''' || role || ''', ' ||
       is_active || ', ' ||
       '''' || created_at || '''' ||
       ');'
FROM users;

-- Get data from internet_plans table
SELECT 'INSERT INTO internet_plans (id, name, download_speed, upload_speed, price, description, created_at) VALUES (' ||
       id || ', ' ||
       '''' || name || ''', ' ||
       download_speed || ', ' ||
       upload_speed || ', ' ||
       price || ', ' ||
       '''' || description || ''', ' ||
       '''' || created_at || '''' ||
       ');'
FROM internet_plans;
