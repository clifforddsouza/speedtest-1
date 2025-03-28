#!/bin/bash

# This script fixes Neon Database connection issues in production
# Updated to use a simpler approach that skips TypeScript compilation

echo "Fixing Neon Database connection issues..."

# Create a backup directory
mkdir -p /opt/speedtest/backups

# Install pg package if not already installed
echo "Installing pg package..."
cd /opt/speedtest
npm install pg

# Backup the original db.js file before overwriting
DB_JS_PATH="/opt/speedtest/dist/server/db.js"
if [ -f "$DB_JS_PATH" ]; then
  cp "$DB_JS_PATH" /opt/speedtest/backups/db.js.bak
  echo "Backed up original db.js file"
else
  echo "Warning: Original db.js file not found at $DB_JS_PATH"
fi

# Create modified db.js file directly (skip TypeScript compilation)
echo "Creating modified db.js file that uses direct connection instead of WebSockets..."
cat > "$DB_JS_PATH" << 'EOF'
import pg from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import * as schema from '../shared/schema.js';

const { Pool } = pg;

console.log('Initializing PostgreSQL connection with direct connection (without WebSockets)...');

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

// Configure the database pool with robust error handling and optimized settings
export const pool = new Pool({ 
  connectionString: process.env.DATABASE_URL,
  max: 10,                      // Reduced max connections to avoid overwhelming the service
  idleTimeoutMillis: 30000,     // How long a client is allowed to remain idle before being closed
  connectionTimeoutMillis: 5000 // Increased timeout for connection
});

// Add error handling for the pool
pool.on('error', (err) => {
  console.error('Unexpected error on database pool:', err);
});

// Create Drizzle instance with schema
export const db = drizzle(pool, { schema });
EOF

echo ""
echo "Database connection fix applied. Restart your application with: pm2 restart speedtest"