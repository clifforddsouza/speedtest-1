#!/bin/bash

# Minimal script to fix database connection

echo "=== Minimal Database Fix ==="

# Create backup directory
BACKUP_DIR="/opt/speedtest/backups/fix_$(date +%s)"
mkdir -p "$BACKUP_DIR"
echo "Created backup directory: $BACKUP_DIR"

# Install pg package
echo "Installing PostgreSQL package..."
cd /opt/speedtest
npm install pg dotenv

# Find and fix db.ts file
echo "Fixing db.ts file..."
DB_TS_FILE=$(find /opt/speedtest -name "db.ts" | grep -v node_modules | head -1)
if [ -n "$DB_TS_FILE" ]; then
  cp "$DB_TS_FILE" "$BACKUP_DIR/$(basename "$DB_TS_FILE").bak"
  echo "Backed up $DB_TS_FILE"
  
  # Creating new db.ts file with PostgreSQL connection
  cat > "$DB_TS_FILE" << 'EOT'
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
EOT
  echo "Updated $DB_TS_FILE"
fi

# Create test script
echo "Creating test database script..."
cat > /opt/speedtest/test_db.js << 'EOT'
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
    
    client.release();
    pool.end();
  } catch (err) {
    console.error("! Database connection error:", err);
  }
}

testConnection();
EOT

echo "Fix completed! Now run:"
echo "1. node test_db.js"
echo "2. pm2 restart speedtest"