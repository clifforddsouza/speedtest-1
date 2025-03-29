#!/bin/bash
# Minimal script to fix database connection issues by replacing @neondatabase/serverless with pg
echo "=== Minimal Database Fix ==="

# Check if running as root
if [ "$EUID" -ne 0 ]; then
  echo "Please run as root (sudo ./minimal_db_fix.sh)"
  exit 1
fi

APP_DIR="/opt/speedtest"
BACKUP_DIR="$APP_DIR/backups/db_fix_$(date +%Y%m%d%H%M%S)"
mkdir -p "$BACKUP_DIR"
echo "Created backup directory: $BACKUP_DIR"

# Find and update db.ts file
DB_TS_FILE="$APP_DIR/server/db.ts"
if [ ! -f "$DB_TS_FILE" ]; then
  DB_TS_FILE=$(find "$APP_DIR" -name "db.ts" | grep -v "node_modules" | head -1)
fi

if [ -f "$DB_TS_FILE" ]; then
  echo "Found database TypeScript file: $DB_TS_FILE"
  cp "$DB_TS_FILE" "$BACKUP_DIR/db.ts.bak"
  
  # Create a new db.ts file
  cat > "$DB_TS_FILE" << 'EOF'
import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "../shared/schema";

console.log("Initializing PostgreSQL connection...");
export const pool = new Pool({ 
  connectionString: process.env.DATABASE_URL 
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
  echo "✓ Updated database connection code in $DB_TS_FILE"
else
  echo "! Could not find database TypeScript file"
fi

# Install required package
echo "Installing pg package..."
cd "$APP_DIR"
npm install pg
npm install --save-dev @types/pg
echo "✓ Installed PostgreSQL packages"

# Backup and fix package.json to make sure @neondatabase/serverless is not used
PACKAGE_JSON="$APP_DIR/package.json"
if [ -f "$PACKAGE_JSON" ]; then
  cp "$PACKAGE_JSON" "$BACKUP_DIR/package.json.bak"
  # Remove @neondatabase/serverless dependency if it exists
  if grep -q '"@neondatabase/serverless"' "$PACKAGE_JSON"; then
    echo "Found @neondatabase/serverless in package.json, removing..."
    # Use a temporary file to avoid sed issues
    cat "$PACKAGE_JSON" | grep -v '"@neondatabase/serverless"' > "$BACKUP_DIR/package.json.tmp"
    cp "$BACKUP_DIR/package.json.tmp" "$PACKAGE_JSON"
    echo "✓ Removed @neondatabase/serverless from package.json"
  fi
fi

# Test database connection
echo "Testing database connection..."
cd "$APP_DIR"
cat > test_db.js << 'EOF'
const { Pool } = require('pg');
require('dotenv').config();

async function testConnection() {
  try {
    console.log("Using DATABASE_URL:", process.env.DATABASE_URL || "Not found");
    const pool = new Pool({
      connectionString: process.env.DATABASE_URL
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
  } catch (err) {
    console.error("! Database connection error:", err);
  }
}

testConnection();
EOF

npm install dotenv
node test_db.js

# Restart the application
echo "Restarting the application..."
cd "$APP_DIR"
if command -v pm2 &> /dev/null; then
  if pm2 list | grep -q speedtest; then
    pm2 restart speedtest
    echo "✓ Restarted application with PM2"
  else
    pm2 start npm --name speedtest -- start
    echo "✓ Started application with PM2"
  fi
fi

echo "Database fix complete. Try logging in again."
echo "If you still have issues, check the application logs with: pm2 logs speedtest"