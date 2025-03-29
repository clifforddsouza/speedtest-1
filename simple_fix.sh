#!/bin/bash

# This is a simple script to fix the database connection issues
# It replaces the Neon WebSocket database connection with a direct PostgreSQL connection

echo "Creating backup directory..."
BACKUP_DIR="/opt/speedtest/backups/fix_$(date +%s)"
mkdir -p "$BACKUP_DIR"

echo "Installing PostgreSQL client library..."
cd /opt/speedtest
npm install pg

echo "Backing up db.js files..."
find /opt/speedtest -name "db.js" | grep -v node_modules | while read file; do
  cp "$file" "$BACKUP_DIR/$(basename "$file").bak"
  echo "Backed up $file"
  
  # Check if this is an ES module file
  if grep -q "export" "$file" || grep -q "import" "$file"; then
    # ES Module version
    cat > "$file" << 'EOF'
import pg from "pg";
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
EOF
  else
    # CommonJS version
    cat > "$file" << 'EOF'
"use strict";
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
EOF
  fi
  echo "Updated $file"
done

echo "Backing up db.ts files..."
find /opt/speedtest -name "db.ts" | grep -v node_modules | while read file; do
  cp "$file" "$BACKUP_DIR/$(basename "$file").bak"
  echo "Backed up $file"
  
  # Replace TypeScript file
  cat > "$file" << 'EOF'
import { Pool } from "pg";
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
EOF
  echo "Updated $file"
done

# Create a test script
echo "Creating database connection test script..."
cat > /opt/speedtest/test_db.js << 'EOF'
const { Pool } = require('pg');
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

testConnection();
EOF

# Install dotenv
npm install dotenv

echo -e "\nFix completed! Now:"
echo "1. Run the test script: node test_db.js"
echo "2. Restart the application: pm2 restart speedtest"