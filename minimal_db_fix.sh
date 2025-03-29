#!/bin/bash

# Minimal Database Fix Script - Focuses only on fixing the database connection issue
# This script is designed to be simple and straightforward

echo "=== Minimal Database Fix ==="

APP_DIR="/opt/speedtest"
BACKUP_DIR="$APP_DIR/backups/minimal_fix_$(date +%Y%m%d%H%M%S)"
mkdir -p "$BACKUP_DIR"
echo "Created backup directory: $BACKUP_DIR"

# Step 1: Install PostgreSQL driver
echo "Installing PostgreSQL driver..."
cd "$APP_DIR"
npm install pg
echo "✓ Installed pg package"

# Step 2: Find and fix the compiled db.js file
echo "Locating db.js file..."
DB_JS_FILE=""

# Common locations for the db.js file
POSSIBLE_LOCATIONS=(
  "$APP_DIR/dist/server/db.js"
  "$APP_DIR/dist/src/server/db.js"
  "$APP_DIR/dist/server/db/index.js"
)

# Check common locations first
for location in "${POSSIBLE_LOCATIONS[@]}"; do
  if [ -f "$location" ]; then
    DB_JS_FILE="$location"
    break
  fi
done

# If not found in common locations, search for it
if [ -z "$DB_JS_FILE" ]; then
  echo "Searching for db.js file..."
  DB_JS_FILE=$(find "$APP_DIR/dist" -name "db.js" | grep -v "node_modules" | head -1)
fi

if [ -n "$DB_JS_FILE" ]; then
  echo "Found database file: $DB_JS_FILE"
  cp "$DB_JS_FILE" "$BACKUP_DIR/$(basename "$DB_JS_FILE").bak"
  echo "✓ Created backup of original file"
  
  # Create a new db.js file with direct PostgreSQL connection
  cat > "$DB_JS_FILE" << 'EOF'
import pg from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import * as schema from '../shared/schema.js';

console.log('Initializing PostgreSQL connection with direct connection...');

const { Pool } = pg;
export const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

export const db = drizzle(pool, { schema });
EOF

  echo "✓ Updated db.js to use direct PostgreSQL connection"
else
  echo "! Could not find db.js file. Trying to find the source files..."
  
  # Try to find the TypeScript source file
  DB_TS_FILE=$(find "$APP_DIR/server" -name "db.ts" | grep -v "node_modules" | head -1)
  
  if [ -n "$DB_TS_FILE" ]; then
    echo "Found TypeScript database file: $DB_TS_FILE"
    cp "$DB_TS_FILE" "$BACKUP_DIR/$(basename "$DB_TS_FILE").bak"
    echo "✓ Created backup of original TypeScript file"
    
    # Create a new db.ts file with direct PostgreSQL connection
    cat > "$DB_TS_FILE" << 'EOF'
import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "../shared/schema";

console.log("Initializing PostgreSQL connection with direct connection...");

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

export const db = drizzle(pool, { schema });
EOF

    echo "✓ Updated db.ts to use direct PostgreSQL connection"
    
    echo "Rebuilding the application..."
    cd "$APP_DIR"
    if grep -q "\"build\"" package.json; then
      npm run build
      echo "✓ Rebuilt the application"
    else
      echo "! Could not find build script in package.json"
    fi
  else
    echo "! Could not find db.ts file either"
    echo "  Creating minimal db.js file in common location..."
    
    # Create directory if it doesn't exist
    mkdir -p "$APP_DIR/dist/server"
    
    # Create a new db.js file with direct PostgreSQL connection
    cat > "$APP_DIR/dist/server/db.js" << 'EOF'
import pg from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import * as schema from '../shared/schema.js';

console.log('Initializing PostgreSQL connection with direct connection...');

const { Pool } = pg;
export const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

export const db = drizzle(pool, { schema });
EOF

    echo "✓ Created new db.js file with direct PostgreSQL connection"
  fi
fi

# Step 3: Restart the application
echo "Restarting the application..."
cd "$APP_DIR"

if command -v pm2 &> /dev/null; then
  if pm2 list | grep -q speedtest; then
    pm2 restart speedtest
    echo "✓ Restarted application with PM2"
  else
    echo "! Application not running with PM2"
    echo "  Starting application..."
    pm2 start npm --name speedtest -- start
    echo "✓ Started application with PM2"
  fi
else
  echo "! PM2 not found"
  echo "  Please restart the application manually"
fi

echo ""
echo "=== Minimal Fix Complete ==="
echo ""
echo "The database connection should now be working with direct PostgreSQL instead of WebSockets."
echo "Check the application logs with: pm2 logs speedtest"
echo ""
echo "If you're still having issues, you can restore from backups in: $BACKUP_DIR"