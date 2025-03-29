const fs = require('fs');
const path = require('path');
const {exec} = require('child_process');

// Find and fix the db.ts file
console.log("Hotfix for database connection issues");

// Paths to check
const possiblePaths = [
  '/opt/speedtest/server/db.ts',
  '/opt/speedtest/src/server/db.ts'
];

// Find the db.ts file
let dbFilePath = null;
for (const filePath of possiblePaths) {
  if (fs.existsSync(filePath)) {
    dbFilePath = filePath;
    break;
  }
}

if (!dbFilePath) {
  console.log("Could not find db.ts file in expected locations");
  // Try searching elsewhere
  exec('find /opt/speedtest -name "db.ts" | grep -v node_modules', (error, stdout, stderr) => {
    if (error) {
      console.error(`Error searching for db.ts: ${error.message}`);
      return;
    }
    if (stderr) {
      console.error(`Search error: ${stderr}`);
      return;
    }
    const files = stdout.trim().split('\n');
    if (files.length > 0) {
      console.log(`Found db.ts at: ${files[0]}`);
      fixDbFile(files[0]);
    } else {
      console.log("Could not find db.ts anywhere in the project");
    }
  });
} else {
  console.log(`Found db.ts at: ${dbFilePath}`);
  fixDbFile(dbFilePath);
}

function fixDbFile(filePath) {
  // Backup the original file
  const backupDir = path.join('/opt/speedtest/backups', `hotfix_${Date.now()}`);
  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
  }
  
  const backupPath = path.join(backupDir, 'db.ts.bak');
  fs.copyFileSync(filePath, backupPath);
  console.log(`Original file backed up to: ${backupPath}`);
  
  // Fix it
  const newContent = `import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "../shared/schema";

// Set SSL mode and reject unauthorized to false
process.env.PGSSLMODE = 'require';
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

console.log("Initializing PostgreSQL connection...");
export const pool = new Pool({ 
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

// Add connection status logging
pool.on('connect', () => {
  console.log('Connected to PostgreSQL database');
});

pool.on('error', (err) => {
  console.error('PostgreSQL connection error:', err);
});

export const db = drizzle(pool, { schema });
`;

  fs.writeFileSync(filePath, newContent);
  console.log("Updated db.ts with direct PostgreSQL connection");
  
  // Install pg package
  console.log("Installing pg package...");
  exec('cd /opt/speedtest && npm install pg && npm install --save-dev @types/pg', (error, stdout, stderr) => {
    if (error) {
      console.error(`Error installing pg package: ${error.message}`);
      return;
    }
    console.log("Installed pg and @types/pg packages");
    
    // Create a simple test script
    createTestScript();
    
    // Rebuild if necessary
    if (fs.existsSync('/opt/speedtest/tsconfig.json')) {
      console.log("Building the project...");
      exec('cd /opt/speedtest && npm run build', (error, stdout, stderr) => {
        console.log("Build complete, restart the application with: pm2 restart speedtest");
      });
    } else {
      console.log("No TypeScript config found, restart the application with: pm2 restart speedtest");
    }
  });
}

function createTestScript() {
  const testScriptPath = '/opt/speedtest/test_db.js';
  const testScript = `const { Pool } = require('pg');
require('dotenv').config();

// Set SSL mode and reject unauthorized to false
process.env.PGSSLMODE = 'require';
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

async function testConnection() {
  try {
    // Mask the connection string when printing
    const dbUrl = process.env.DATABASE_URL || '';
    const maskedUrl = dbUrl ? 
      dbUrl.replace(/\\/\\/([^:]+):([^@]+)@/, '//***:***@') : 
      'Not defined';
    
    console.log("Using DATABASE_URL:", maskedUrl);
    
    const pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: {
        rejectUnauthorized: false
      }
    });
    
    console.log("Testing database connection...");
    const client = await pool.connect();
    console.log("✓ Successfully connected to the database");
    
    const result = await client.query('SELECT NOW()');
    console.log("✓ Successfully executed query:", result.rows[0]);
    
    console.log("Checking database tables...");
    const tablesResult = await client.query("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'");
    console.log("Database tables:", tablesResult.rows.map(row => row.table_name).join(', '));
    
    client.release();
    pool.end();
    return true;
  } catch (err) {
    console.error("! Database connection error:", err);
    return false;
  }
}

testConnection().then(success => {
  if (success) {
    console.log("Database connection test passed successfully.");
  } else {
    console.log("Database connection test failed.");
  }
});
`;

  fs.writeFileSync(testScriptPath, testScript);
  console.log(`Created test script at: ${testScriptPath}`);
  console.log("Run it with: node test_db.js");
  
  // Install dotenv
  exec('cd /opt/speedtest && npm install dotenv', (error, stdout, stderr) => {
    if (error) {
      console.error(`Error installing dotenv: ${error.message}`);
      return;
    }
    console.log("Installed dotenv package for test script");
  });
}