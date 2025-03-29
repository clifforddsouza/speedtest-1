#!/bin/bash

# Simple fix script for SpeedTest app
# This script fixes both database and Nginx issues with minimal complexity

echo "=== SpeedTest Simple Fix Script ==="

# Check if running as root
if [ "$EUID" -ne 0 ]; then
  echo "Please run as root (sudo ./simple_fix.sh)"
  exit 1
fi

APP_DIR="/opt/speedtest"
BACKUP_DIR="$APP_DIR/backups/fix_$(date +%Y%m%d%H%M%S)"
mkdir -p "$BACKUP_DIR"
echo "Created backup directory: $BACKUP_DIR"

# Step 1: Fix the Nginx configuration (port mismatch)
echo "Fixing Nginx configuration..."
NGINX_CONFIG="/etc/nginx/sites-available/speedtest"
if [ ! -f "$NGINX_CONFIG" ]; then
  NGINX_CONFIG="/etc/nginx/sites-available/default"
fi

if [ -f "$NGINX_CONFIG" ]; then
  cp "$NGINX_CONFIG" "$BACKUP_DIR/$(basename $NGINX_CONFIG).bak"
  echo "✓ Backed up Nginx config"
  
  # Replace port 3000 with port 5000 in proxy_pass directives
  sed -i 's|proxy_pass http://localhost:3000|proxy_pass http://localhost:5000|g' "$NGINX_CONFIG"
  sed -i 's|proxy_pass http://127.0.0.1:3000|proxy_pass http://127.0.0.1:5000|g' "$NGINX_CONFIG"
  
  echo "✓ Updated Nginx config to use port 5000"
  
  # Test and reload Nginx
  nginx -t
  if [ $? -eq 0 ]; then
    systemctl reload nginx
    echo "✓ Reloaded Nginx"
  else
    echo "! Nginx config test failed. Restoring backup..."
    cp "$BACKUP_DIR/$(basename $NGINX_CONFIG).bak" "$NGINX_CONFIG"
    echo "✓ Restored Nginx config from backup"
  fi
else
  echo "! Could not find Nginx configuration"
fi

# Step 2: Find and fix the database connection file
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

export const db = drizzle(pool, { schema });
EOF

  echo "✓ Updated database connection to use direct PostgreSQL"
else
  echo "! Could not find database TypeScript file"
fi

# Step 3: Find and fix the compiled db.js file
echo "Fixing compiled database JS file..."

# Find the compiled db.js file
DB_JS_FILE="$APP_DIR/dist/server/db.js"
if [ ! -f "$DB_JS_FILE" ]; then
  DB_JS_FILE=$(find "$APP_DIR" -name "db.js" | grep "dist" | head -1)
fi

if [ -f "$DB_JS_FILE" ]; then
  echo "Found compiled database JS file: $DB_JS_FILE"
  cp "$DB_JS_FILE" "$BACKUP_DIR/db.js.bak"
  
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

export const db = drizzle(pool, { schema });
EOF

  echo "✓ Updated compiled database JS file"
else
  echo "! Could not find compiled database JS file"
fi

# Step 4: Install required PostgreSQL package
echo "Installing required PostgreSQL package..."
cd "$APP_DIR"
npm install pg
npm install --save-dev @types/pg
echo "✓ Installed PostgreSQL packages"

# Step 5: Restart the application
echo "Restarting the application..."
if command -v pm2 &> /dev/null; then
  if pm2 list | grep -q speedtest; then
    pm2 restart speedtest
    echo "✓ Restarted application with PM2"
  else
    cd "$APP_DIR"
    pm2 start npm --name speedtest -- start
    echo "✓ Started application with PM2"
  fi
else
  echo "! PM2 not found, please restart the application manually"
fi

echo ""
echo "=== Fix Complete ==="
echo ""
echo "What this fix did:"
echo "1. Updated Nginx to use port 5000 (matching the app's actual port)"
echo "2. Replaced WebSocket-based database connection with direct PostgreSQL"
echo "3. Installed required PostgreSQL packages"
echo "4. Restarted the application"
echo ""
echo "Your application should now be working correctly."
echo "If you're still having issues:"
echo "1. Check Nginx error logs: tail -f /var/log/nginx/error.log"
echo "2. Check application logs: pm2 logs speedtest"
echo ""
echo "You can restore from backups if needed at: $BACKUP_DIR"