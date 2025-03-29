const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Create backup directory
const backupDir = path.join('/opt/speedtest/backups', `hotfix_js_${Date.now()}`);
if (!fs.existsSync(backupDir)) {
  fs.mkdirSync(backupDir, { recursive: true });
}

console.log('Created backup directory:', backupDir);

// Install the pg package
try {
  console.log('Installing pg package...');
  execSync('cd /opt/speedtest && npm install pg && npm install --save-dev @types/pg', { stdio: 'inherit' });
  console.log('Installed pg packages successfully');
} catch (error) {
  console.error('Error installing packages:', error.message);
}

// Find all compiled db.js files (including in dist directory)
console.log('Searching for compiled db.js files...');
let jsFiles;
try {
  jsFiles = execSync('find /opt/speedtest -name "db.js" | grep -v node_modules', { encoding: 'utf8' }).trim().split('\n');
  console.log(`Found ${jsFiles.length} db.js files:`, jsFiles);
} catch (error) {
  console.error('Error finding db.js files:', error.message);
  process.exit(1);
}

// Update each db.js file
jsFiles.forEach(filePath => {
  if (!filePath) return;
  
  console.log(`Processing file: ${filePath}`);
  
  // Create backup
  const backupPath = path.join(backupDir, `${path.basename(filePath)}.bak`);
  fs.copyFileSync(filePath, backupPath);
  console.log(`Backed up to: ${backupPath}`);
  
  // Determine if it's a ES module or CommonJS
  const fileContent = fs.readFileSync(filePath, 'utf8');
  const isESM = fileContent.includes('export ') || fileContent.includes('import ');
  
  let newContent;
  if (isESM) {
    newContent = `import pg from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "../shared/schema.js";

// Set SSL options for PostgreSQL
process.env.PGSSLMODE = 'require';
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

console.log("Initializing PostgreSQL connection...");
const { Pool } = pg;
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
  } else {
    newContent = `"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.db = exports.pool = void 0;

const pg_1 = require("pg");
const node_postgres_1 = require("drizzle-orm/node-postgres");
const schema = require("../shared/schema");

// Set SSL options for PostgreSQL
process.env.PGSSLMODE = 'require';
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

console.log("Initializing PostgreSQL connection...");
exports.pool = new pg_1.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

// Add connection status logging
exports.pool.on('connect', () => {
  console.log('Connected to PostgreSQL database');
});

exports.pool.on('error', (err) => {
  console.error('PostgreSQL connection error:', err);
});

exports.db = (0, node_postgres_1.drizzle)(exports.pool, { schema });
`;
  }
  
  // Write the new content
  fs.writeFileSync(filePath, newContent);
  console.log(`Updated ${filePath} with direct PostgreSQL connection`);
});

// Create a test script
const testScriptPath = '/opt/speedtest/test_db.js';
const testScript = `const { Pool } = require('pg');
require('dotenv').config();

// Set SSL options for PostgreSQL
process.env.PGSSLMODE = 'require';
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

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
    console.log("✓ Successfully connected to the database");
    
    const result = await client.query('SELECT NOW()');
    console.log("✓ Successfully executed query:", result.rows[0]);
    
    console.log("Checking database tables...");
    const tablesResult = await client.query("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'");
    console.log("Database tables:", tablesResult.rows.map(row => row.table_name).join(', '));
    
    client.release();
    pool.end();
  } catch (err) {
    console.error("! Database connection error:", err);
  }
}

testConnection();
`;

fs.writeFileSync(testScriptPath, testScript);
console.log(`Created test script at: ${testScriptPath}`);

// Install dotenv for test script
try {
  console.log('Installing dotenv...');
  execSync('cd /opt/speedtest && npm install dotenv', { stdio: 'inherit' });
  console.log('Installed dotenv successfully');
} catch (error) {
  console.error('Error installing dotenv:', error.message);
}

console.log('\nHotfix completed successfully!');
console.log('\nNext steps:');
console.log('1. Run the test script: node test_db.js');
console.log('2. Restart the application: pm2 restart speedtest');
console.log('3. Try logging in again');