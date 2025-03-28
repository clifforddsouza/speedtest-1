const { Client } = require('@neondatabase/serverless');
const fs = require('fs');

async function dumpDatabase() {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  
  // Get all table names
  const tablesResult = await client.query(`
    SELECT tablename 
    FROM pg_tables 
    WHERE schemaname = 'public'
  `);
  
  const tables = tablesResult.rows.map(row => row.tablename);
  console.log('Tables found:', tables);
  
  let dumpData = {};
  
  // Get data from each table
  for (const table of tables) {
    const dataResult = await client.query(`SELECT * FROM "${table}"`);
    dumpData[table] = dataResult.rows;
    console.log(`Exported ${dataResult.rows.length} rows from ${table}`);
  }
  
  // Write to file
  fs.writeFileSync('database_dump.json', JSON.stringify(dumpData, null, 2));
  console.log('Database dump completed to database_dump.json');
  
  await client.end();
}

dumpDatabase().catch(err => {
  console.error('Error dumping database:', err);
  process.exit(1);
});
