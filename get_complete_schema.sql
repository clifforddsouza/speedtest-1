-- Get complete schema for speed_tests table
SELECT column_name, data_type, character_maximum_length, column_default, is_nullable
FROM information_schema.columns 
WHERE table_name = 'speed_tests' AND table_schema = 'public'
ORDER BY ordinal_position;

-- Get internet plans data
SELECT * FROM internet_plans;
