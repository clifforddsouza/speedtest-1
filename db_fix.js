// Simple script to fix the server/db.ts file
const fs = require('fs');
const path = require('path');

// Find the db.ts file
const rootDir = '/opt/speedtest';
const dbTsFile = path.join(rootDir, 'server/db.ts');

console.log('Fixing database connection in:', dbTsFile);

// Create backup
const backupFile = dbTsFile + '.bak';
fs.copyFileSync(dbTsFile, backupFile);
console.log('Created backup at:', backupFile);

// New PostgreSQL connection code
const newDbContent = `import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "../shared/schema";

// Set SSL options to handle certificate issues
process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

console.log("Initializing PostgreSQL connection...");
export const pool = new Pool({ 
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

export const db = drizzle(pool, { schema });
`;

// Write the new content
fs.writeFileSync(dbTsFile, newDbContent);
console.log('Updated database connection file');

// Create test script
const testScriptContent = `const { Pool } = require("pg");

// Set SSL options to handle certificate issues
process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

async function testConnection() {
  try {
    console.log("Testing database connection...");
    const pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: {
        rejectUnauthorized: false
      }
    });
    
    const client = await pool.connect();
    console.log("Successfully connected to the database");
    
    const result = await client.query("SELECT NOW()");
    console.log("Query result:", result.rows[0]);
    
    client.release();
    pool.end();
  } catch (err) {
    console.error("Database connection error:", err);
  }
}

testConnection();
`;

// Write the test script
const testScriptPath = path.join(rootDir, 'test_db.js');
fs.writeFileSync(testScriptPath, testScriptContent);
console.log('Created test script at:', testScriptPath);

console.log('\nDone! Next steps:');
console.log('1. Install PostgreSQL client: npm install pg');
console.log('2. Test the connection: node test_db.js');
console.log('3. Restart the application: pm2 restart speedtest');