const { Pool } = require('pg');
require('dotenv').config();

console.log("Testing database connection...");
console.log("Database URL format:", process.env.DATABASE_URL ? 
            process.env.DATABASE_URL.replace(/(.*?\/\/)(.*?):(.*?)@/, '$1[USER]:[PASSWORD]@') : 
            "Not found in environment");

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

async function testConnection() {
  try {
    console.log("Attempting to connect to database...");
    const client = await pool.connect();
    console.log('✓ Database connection successful');
    
    console.log("Executing test query...");
    const result = await client.query('SELECT NOW() as current_time');
    console.log('✓ Query successful');
    console.log('Database time:', result.rows[0].current_time);
    
    // Test a simple query to users table
    try {
      console.log("Testing query to users table...");
      const usersResult = await client.query('SELECT COUNT(*) FROM users');
      console.log('✓ Users table test successful');
      console.log('User count:', usersResult.rows[0].count);
    } catch (tableErr) {
      console.error('✗ Users table test failed:', tableErr.message);
    }
    
    client.release();
  } catch (err) {
    console.error('✗ Database connection failed!');
    console.error('Error details:', err.message);
    
    if (err.message.includes('no pg_hba.conf entry')) {
      console.error('This appears to be an authentication issue. Check that your DATABASE_URL has correct credentials.');
    } else if (err.message.includes('connect ECONNREFUSED')) {
      console.error('Could not connect to the database server. Check that the server is running and accessible.');
    } else if (err.message.includes('password authentication failed')) {
      console.error('Password authentication failed. Check your database credentials.');
    }
  } finally {
    pool.end();
  }
}

testConnection();