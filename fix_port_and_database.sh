#!/bin/bash
# Script to fix both port issues and database connection problems
echo "=== SpeedTest Application Fix Script ==="

# Check if running as root
if [ "$EUID" -ne 0 ]; then
  echo "Please run as root (sudo ./fix_port_and_database.sh)"
  exit 1
fi

# Define paths
APP_DIR="/opt/speedtest"
BACKUP_DIR="$APP_DIR/backups/fix_$(date +%Y%m%d%H%M%S)"
mkdir -p "$BACKUP_DIR"
echo "Created backup directory: $BACKUP_DIR"

# Show current application status
echo "Current application status:"
pm2 list | grep speedtest

# First, let's check if the application is actually running
echo "Checking if application is running on expected port..."
if ! ss -tlnp | grep -q ":5000"; then
  echo "! Application is not running on port 5000"
  echo "Checking environment configuration for port..."
  
  # Check .env file for PORT setting
  ENV_FILE="$APP_DIR/.env"
  if [ -f "$ENV_FILE" ]; then
    cp "$ENV_FILE" "$BACKUP_DIR/.env.bak"
    if grep -q "^PORT=" "$ENV_FILE"; then
      sed -i 's/^PORT=.*/PORT=5000/' "$ENV_FILE"
      echo "✓ Updated PORT=5000 in .env file"
    else
      echo "PORT=5000" >> "$ENV_FILE"
      echo "✓ Added PORT=5000 to .env file"
    fi
  else
    echo "! .env file not found"
    echo "Creating basic .env file with PORT=5000"
    touch "$ENV_FILE" 
    echo "PORT=5000" > "$ENV_FILE"
    echo "✓ Created .env file with PORT=5000"
  fi
fi

# Now fix the database connection
echo "Fixing database connection..."
# Find the server/db.ts file
DB_TS_FILE="$APP_DIR/server/db.ts"
if [ ! -f "$DB_TS_FILE" ]; then
  DB_TS_FILE=$(find "$APP_DIR" -name "db.ts" | grep -v "node_modules" | head -1)
fi

if [ -f "$DB_TS_FILE" ]; then
  echo "Found database TypeScript file: $DB_TS_FILE"
  cp "$DB_TS_FILE" "$BACKUP_DIR/db.ts.bak"
  
  # Create a new db.ts file with direct PostgreSQL connection
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
  echo "✓ Updated database connection to use direct PostgreSQL"
else
  echo "! Could not find database TypeScript file"
fi

# Fix the compiled db.js file
echo "Fixing compiled database JS file..."
# Find the compiled db.js file
find "$APP_DIR" -name "db.js" | grep -v "node_modules" | while read DB_JS_FILE; do
  echo "Processing compiled JS file: $DB_JS_FILE"
  cp "$DB_JS_FILE" "$BACKUP_DIR/$(basename $DB_JS_FILE).bak"
  
  # Create a new db.js file with direct PostgreSQL connection
  cat > "$DB_JS_FILE" << 'EOF'
import pg from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "../shared/schema.js";

console.log("Initializing PostgreSQL connection...");
const { Pool } = pg;
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
  echo "✓ Updated compiled JS file: $DB_JS_FILE"
done

# Install required PostgreSQL package
echo "Installing required PostgreSQL package..."
cd "$APP_DIR"
npm install pg
npm install --save-dev @types/pg
echo "✓ Installed PostgreSQL packages"

# Print current database connection string (masked)
echo "Checking database connection..."
ENV_FILE="$APP_DIR/.env"
if [ -f "$ENV_FILE" ] && grep -q "DATABASE_URL=" "$ENV_FILE"; then
  DB_URL=$(grep "DATABASE_URL=" "$ENV_FILE" | sed 's/^DATABASE_URL=//')
  echo "Found DATABASE_URL: ${DB_URL:0:15}...${DB_URL: -15} (masked for security)"
else
  echo "! DATABASE_URL not found in .env file"
  echo "Please make sure your .env file contains a valid DATABASE_URL"
fi

# Validate database connection
echo "Testing database connection..."
cd "$APP_DIR"
cat > test_db.js << 'EOF'
const { Pool } = require('pg');
require('dotenv').config();

async function testConnection() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL
  });
  
  try {
    console.log("Testing database connection...");
    const client = await pool.connect();
    console.log("✓ Successfully connected to the database");
    const result = await client.query('SELECT NOW()');
    console.log("✓ Successfully executed query", result.rows[0]);
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
if command -v pm2 &> /dev/null; then
  if pm2 list | grep -q speedtest; then
    pm2 restart speedtest
    echo "✓ Restarted application with PM2"
    
    # Give the app some time to start
    echo "Waiting for application to start..."
    sleep 5
    
    # Check if app is running on port 5000
    if ss -tlnp | grep -q ":5000"; then
      echo "✓ Application is running on port 5000"
    else
      echo "! Application is not running on port 5000"
      echo "Attempting to start with correct port..."
      cd "$APP_DIR"
      PORT=5000 pm2 start npm --name speedtest -- start
    fi
  else
    cd "$APP_DIR"
    PORT=5000 pm2 start npm --name speedtest -- start
    echo "✓ Started application with PM2"
  fi
else
  echo "! PM2 not found, please restart the application manually"
fi

# Final check
echo ""
echo "=== Final Status Check ==="
echo "Nginx configuration:"
grep -r "proxy_pass" /etc/nginx/sites-enabled
echo ""
echo "Application status:"
pm2 list | grep speedtest
echo ""
echo "Listening ports:"
ss -tlnp | grep -E ':(3000|5000)'
echo ""

echo "=== Fix Complete ==="
echo "What this script did:"
echo "1. Updated application to use port 5000"
echo "2. Replaced WebSocket-based database connection with direct PostgreSQL"
echo "3. Installed required PostgreSQL packages"
echo "4. Tested database connection"
echo "5. Restarted the application"
echo ""
echo "If you're still having issues:"
echo "1. Check the application logs: pm2 logs speedtest"
echo "2. Check Nginx error logs: tail -f /var/log/nginx/error.log"
echo "3. Check the database connection test results above"
echo ""
echo "Backup of original files is in: $BACKUP_DIR"
echo "Try accessing http://192.168.8.92 now and attempt to log in."