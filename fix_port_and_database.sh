#!/bin/bash

# Comprehensive fix script for both Nginx configuration and database connection issues

echo "=== SpeedTest Application Fix ==="
echo "This script will fix both the Nginx configuration and database connection issues."

# Create backup directory
BACKUP_DIR="/opt/speedtest/backups/fix_$(date +%s)"
mkdir -p "$BACKUP_DIR"
echo "Created backup directory: $BACKUP_DIR"

# Step 1: Fix the database connection
echo "Step 1: Fixing database connection..."

# Install required packages
echo "Installing PostgreSQL client package..."
cd /opt/speedtest
npm install pg dotenv

# Find and backup db.ts file
echo "Finding db.ts file..."
DB_TS_FILE=$(find /opt/speedtest -name "db.ts" | grep -v node_modules | head -1)
if [ -n "$DB_TS_FILE" ]; then
  cp "$DB_TS_FILE" "$BACKUP_DIR/$(basename "$DB_TS_FILE").bak"
  echo "Backed up $DB_TS_FILE to $BACKUP_DIR"
  
  # Update database connection to use direct PostgreSQL
  echo "Updating database connection code..."
  cat > "$DB_TS_FILE" << 'EOF'
import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "../shared/schema";

// Set SSL options to handle certificate issues
process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

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
  echo "Updated database connection code."
else
  echo "Warning: Could not find db.ts file."
fi

# Step 2: Fix Nginx configuration
echo "Step 2: Fixing Nginx configuration..."

# Find the actual port the application is running on
echo "Finding the actual port the application is running on..."
APP_PORT=$(netstat -tlnp | grep node | head -1 | awk '{print $4}' | cut -d':' -f2)

if [ -z "$APP_PORT" ]; then
  echo "Could not automatically detect Node.js port. Using default port 5000."
  APP_PORT=5000
fi

echo "Detected Node.js application running on port: $APP_PORT"

# Check Nginx configuration
NGINX_CONFIG="/etc/nginx/sites-available/speedtest"
if [ ! -f "$NGINX_CONFIG" ]; then
  echo "Nginx configuration file not found at $NGINX_CONFIG"
  echo "Checking default Nginx configuration..."
  NGINX_CONFIG="/etc/nginx/sites-available/default"
  if [ ! -f "$NGINX_CONFIG" ]; then
    echo "Default Nginx configuration not found."
    echo "Skipping Nginx configuration update."
    exit 1
  fi
fi

echo "Found Nginx configuration at $NGINX_CONFIG"
echo "Creating backup of Nginx configuration..."
cp "$NGINX_CONFIG" "$BACKUP_DIR/$(basename "$NGINX_CONFIG").bak"
echo "Backup created at $BACKUP_DIR"

# Update the proxy_pass line in the Nginx configuration
echo "Updating Nginx configuration to use port $APP_PORT..."
sed -i "s|proxy_pass http://localhost:[0-9]\+;|proxy_pass http://localhost:$APP_PORT;|g" "$NGINX_CONFIG"
sed -i "s|proxy_pass http://127.0.0.1:[0-9]\+;|proxy_pass http://127.0.0.1:$APP_PORT;|g" "$NGINX_CONFIG"

# Add WebSocket support if it doesn't exist
if ! grep -q "proxy_http_version 1.1;" "$NGINX_CONFIG"; then
  echo "Adding WebSocket support to Nginx configuration..."
  sed -i "/proxy_pass/a \ \ \ \ \ \ \ \ proxy_http_version 1.1;\n        proxy_set_header Upgrade \$http_upgrade;\n        proxy_set_header Connection 'upgrade';\n        proxy_set_header Host \$host;\n        proxy_cache_bypass \$http_upgrade;" "$NGINX_CONFIG"
fi

# Print the updated configuration
echo "Updated Nginx configuration:"
grep -A 10 "location /" "$NGINX_CONFIG"

# Test the Nginx configuration
echo "Testing Nginx configuration..."
nginx -t

if [ $? -eq 0 ]; then
  echo "Nginx configuration test passed. Restarting Nginx..."
  systemctl restart nginx
  echo "Nginx restarted successfully."
else
  echo "Nginx configuration test failed. Please check the error messages above."
  echo "Restoring original configuration..."
  cp "$BACKUP_DIR/$(basename "$NGINX_CONFIG").bak" "$NGINX_CONFIG"
  echo "Original configuration restored."
fi

# Step 3: Create test scripts
echo "Step 3: Creating test scripts..."

# Create database test script
echo "Creating database connection test script..."
cat > /opt/speedtest/test_db.js << 'EOF'
const { Pool } = require('pg');
require('dotenv').config();

// Set SSL options to handle certificate issues
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
echo "Created database test script at /opt/speedtest/test_db.js"

# Step 4: Restart the application
echo "Step 4: Restarting the application..."
if command -v pm2 &> /dev/null; then
  pm2 restart speedtest
  echo "Application restarted with PM2."
else
  echo "PM2 not found. Please restart your application manually."
fi

echo ""
echo "✅ Fix completed!"
echo "Next steps:"
echo "1. Test the database connection: node test_db.js"
echo "2. Test the web application in your browser"
echo "3. If you still see issues, check the application logs: pm2 logs speedtest"