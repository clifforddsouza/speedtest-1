-- Get schema for users table
SELECT column_name, data_type, character_maximum_length, column_default, is_nullable
FROM information_schema.columns 
WHERE table_name = 'users' AND table_schema = 'public'
ORDER BY ordinal_position;

-- Get schema for internet_plans table
SELECT column_name, data_type, character_maximum_length, column_default, is_nullable
FROM information_schema.columns 
WHERE table_name = 'internet_plans' AND table_schema = 'public'
ORDER BY ordinal_position;

-- Get schema for speed_tests table
SELECT column_name, data_type, character_maximum_length, column_default, is_nullable
FROM information_schema.columns 
WHERE table_name = 'speed_tests' AND table_schema = 'public'
ORDER BY ordinal_position;

-- Get schema for session table
SELECT column_name, data_type, character_maximum_length, column_default, is_nullable
FROM information_schema.columns 
WHERE table_name = 'session' AND table_schema = 'public'
ORDER BY ordinal_position;
