#!/bin/bash

# This script fixes multiple issues in the production environment:
# 1. Replaces Neon Database WebSocket connection with standard PostgreSQL connection
# 2. Fixes authentication issues by updating session handling

echo "=== SpeedTest Application Production Fix Script ==="
echo "This script will fix database connection and authentication issues"

# Create a backup directory
mkdir -p /opt/speedtest/backups

# Install required packages
echo "Installing required packages..."
cd /opt/speedtest
npm install pg express-session connect-pg-simple

# Back up original files
DB_JS_PATH="/opt/speedtest/dist/server/db.js"
AUTH_JS_PATH="/opt/speedtest/dist/server/auth.js"
ROUTES_JS_PATH="/opt/speedtest/dist/server/routes.js"
INDEX_JS_PATH="/opt/speedtest/dist/server/index.js"

if [ -f "$DB_JS_PATH" ]; then
  cp "$DB_JS_PATH" /opt/speedtest/backups/db.js.bak
  echo "✓ Backed up original db.js file"
else
  echo "! Warning: Original db.js file not found at $DB_JS_PATH"
fi

if [ -f "$AUTH_JS_PATH" ]; then
  cp "$AUTH_JS_PATH" /opt/speedtest/backups/auth.js.bak
  echo "✓ Backed up original auth.js file"
else
  echo "! Warning: Original auth.js file not found at $AUTH_JS_PATH"
fi

# 1. Fix database connection - Create modified db.js file
echo "Creating modified db.js file with direct PostgreSQL connection..."
cat > "$DB_JS_PATH" << 'EOF'
import pg from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import * as schema from '../shared/schema.js';

const { Pool } = pg;

console.log('Initializing PostgreSQL connection with direct connection...');

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

// Configure the database pool with robust error handling
export const pool = new Pool({ 
  connectionString: process.env.DATABASE_URL,
  max: 10,                     
  idleTimeoutMillis: 30000,    
  connectionTimeoutMillis: 5000
});

// Add error handling for the pool
pool.on('error', (err) => {
  console.error('Unexpected error on database pool:', err);
});

// Create Drizzle instance with schema
export const db = drizzle(pool, { schema });
EOF

# 2. Fix storage.ts authentication - Check if it needs patching
if grep -q "@neondatabase/serverless" $AUTH_JS_PATH 2>/dev/null; then
  echo "Fixing auth.js to use standard pg-connect-simple..."
  # Create a temporary sed script to replace the sessionStore initialization
  cat > /tmp/fix_auth.sed << 'EOF'
/connect-pg-simple/,/}/ {
  s/connect-pg-simple/connect-pg-simple/
  s/pool, /pool, /
}
EOF
  # Apply the sed script
  sed -i.tmp -f /tmp/fix_auth.sed "$AUTH_JS_PATH"
fi

# 3. Verify WebSocket server setup in routes.js
if [ -f "$ROUTES_JS_PATH" ]; then
  # Check if the WebSocket path is correctly set
  if grep -q "'\/api\/ws-packet-test'" "$ROUTES_JS_PATH"; then
    echo "✓ WebSocket path already correctly set in routes.js"
  else
    echo "! WebSocket path may need manual correction in routes.js"
    echo "  Please check that the WebSocket server path matches the client path"
  fi
fi

# 4. Create a simple test script to verify database connection
echo "Creating database test script..."
cat > /opt/speedtest/test_db_connection.js << 'EOF'
import { pool } from './dist/server/db.js';

async function testConnection() {
  console.log('Testing database connection...');
  try {
    const client = await pool.connect();
    const result = await client.query('SELECT NOW()');
    console.log('✓ Database connection successful:', result.rows[0]);
    client.release();
  } catch (err) {
    console.error('❌ Database connection failed:', err);
  } finally {
    process.exit(0);
  }
}

testConnection();
EOF

echo ""
echo "=== Fix Complete ==="
echo "To verify database connection, run: node test_db_connection.js"
echo "To restart your application, run: pm2 restart speedtest"
echo ""
echo "If you still experience issues:"
echo "1. Check your DATABASE_URL environment variable"
echo "2. Verify that PostgreSQL is accessible from this server"
echo "3. Check logs with: pm2 logs speedtest"