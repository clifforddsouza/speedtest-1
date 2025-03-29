#!/usr/bin/env node

// This script directly replaces the Neon WebSocket connection with
// a direct PostgreSQL connection
// It's designed to be run as a standalone script to immediately
// fix the database connection
// Run with: node hotfix_db.cjs

const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');

// Create backup directory
const backupDir = path.join('/opt/speedtest/backups', `hotfix_js_${Date.now()}`);
if (!fs.existsSync(backupDir)) {
  fs.mkdirSync(backupDir, { recursive: true });
}

console.log('Created backup directory:', backupDir);

// Install the pg package
console.log('Installing pg package...');
exec('cd /opt/speedtest && npm install pg', (error, stdout, stderr) => {
  if (error) {
    console.error('Error installing pg package:', error.message);
  } else {
    console.log('Installed pg package');
  }
  
  // Find all db.js files
  exec('find /opt/speedtest -name "db.js" | grep -v node_modules', (error, stdout, stderr) => {
    if (error) {
      console.error('Error finding db.js files:', error.message);
      return;
    }
    
    const files = stdout.trim().split('\n').filter(Boolean);
    console.log(`Found ${files.length} db.js files:`, files);
    
    files.forEach(filePath => {
      // Backup the file
      const fileName = path.basename(filePath);
      const backupPath = path.join(backupDir, `${fileName}.bak`);
      fs.copyFileSync(filePath, backupPath);
      console.log(`Backed up ${filePath} to ${backupPath}`);
      
      // Detect if it's ES module or CommonJS
      const content = fs.readFileSync(filePath, 'utf8');
      const isESM = content.includes('export') || content.includes('import');
      
      // Create the new content
      let newContent;
      if (isESM) {
        newContent = `import pg from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "../shared/schema.js";

// Set SSL options to handle any certificate issues
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

// Set SSL options to handle any certificate issues
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
      console.log(`Updated ${filePath}`);
    });
    
    // Also update the TypeScript source file if it exists
    exec('find /opt/speedtest -name "db.ts" | grep -v node_modules', (error, stdout, stderr) => {
      if (error) {
        console.error('Error finding db.ts file:', error.message);
        return;
      }
      
      const tsFiles = stdout.trim().split('\n').filter(Boolean);
      console.log(`Found ${tsFiles.length} db.ts files:`, tsFiles);
      
      tsFiles.forEach(filePath => {
        // Backup the file
        const fileName = path.basename(filePath);
        const backupPath = path.join(backupDir, `${fileName}.bak`);
        fs.copyFileSync(filePath, backupPath);
        console.log(`Backed up ${filePath} to ${backupPath}`);
        
        // Update the TypeScript file
        const newTsContent = `import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "../shared/schema";

// Set SSL options to handle any certificate issues
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
        
        fs.writeFileSync(filePath, newTsContent);
        console.log(`Updated ${filePath}`);
      });
      
      // Create a test script
      const testScriptPath = '/opt/speedtest/test_db.js';
      const testScriptContent = `const { Pool } = require('pg');
require('dotenv').config();

// Set SSL options to handle any certificate issues
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

testConnection();`;
      
      fs.writeFileSync(testScriptPath, testScriptContent);
      console.log(`Created test script at ${testScriptPath}`);
      
      // Install dotenv for the test script
      exec('cd /opt/speedtest && npm install dotenv', (error, stdout, stderr) => {
        if (error) {
          console.error('Error installing dotenv:', error.message);
        } else {
          console.log('Installed dotenv for test script');
        }
        
        console.log('\nFix completed! Now:');
        console.log('1. Run the test script: node test_db.js');
        console.log('2. Restart the application: pm2 restart speedtest');
      });
    });
  });
});