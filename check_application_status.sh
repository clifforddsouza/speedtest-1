#!/bin/bash

# This script performs a comprehensive check of the SpeedTest application status
# It's useful for debugging issues with the application not starting or being inaccessible

echo "=== SpeedTest Application Status Check ==="

# Step 1: Check if PM2 is running the application
echo "Checking PM2 processes..."
if command -v pm2 &> /dev/null; then
  echo "PM2 found on the system"
  PM2_OUTPUT=$(pm2 list)
  echo "$PM2_OUTPUT"
  
  if echo "$PM2_OUTPUT" | grep -q speedtest; then
    echo "✓ SpeedTest application is running in PM2"
    echo ""
    echo "Detailed application information:"
    pm2 describe speedtest
  else
    echo "✗ SpeedTest application is NOT running in PM2"
  fi
else
  echo "! PM2 not found on the system"
fi

# Step 2: Check if the application is bound to any ports
echo ""
echo "Checking for Node.js processes and bound ports..."
if command -v lsof &> /dev/null; then
  NODE_PORTS=$(lsof -i -P -n | grep node | grep LISTEN)
  if [ -n "$NODE_PORTS" ]; then
    echo "Found Node.js processes listening on ports:"
    echo "$NODE_PORTS"
  else
    echo "No Node.js processes found listening on any ports"
  fi
elif command -v ss &> /dev/null; then
  NODE_PORTS=$(ss -tlnp | grep node)
  if [ -n "$NODE_PORTS" ]; then
    echo "Found Node.js processes listening on ports:"
    echo "$NODE_PORTS"
  else
    echo "No Node.js processes found listening on any ports"
  fi
elif command -v netstat &> /dev/null; then
  NODE_PORTS=$(netstat -tlnp 2>/dev/null | grep node)
  if [ -n "$NODE_PORTS" ]; then
    echo "Found Node.js processes listening on ports:"
    echo "$NODE_PORTS"
  else
    echo "No Node.js processes found listening on any ports"
  fi
else
  echo "! Could not find lsof, ss, or netstat to check bound ports"
fi

# Step 3: Check application configuration files
echo ""
echo "Checking application configuration files..."
APP_DIR="/opt/speedtest"
if [ -d "$APP_DIR" ]; then
  echo "Application directory found at: $APP_DIR"
  
  # Check package.json
  if [ -f "$APP_DIR/package.json" ]; then
    echo "✓ package.json found"
    echo "Start script: $(grep "\"start\":" "$APP_DIR/package.json" | head -1)"
  else
    echo "✗ package.json not found"
  fi
  
  # Check .env file
  if [ -f "$APP_DIR/.env" ]; then
    echo "✓ .env file found"
    echo "PORT setting: $(grep "^PORT=" "$APP_DIR/.env" | head -1)"
    echo "DATABASE_URL present: $(if grep -q "^DATABASE_URL=" "$APP_DIR/.env"; then echo "Yes"; else echo "No"; fi)"
  else
    echo "✗ .env file not found"
  fi
  
  # Check if dist directory exists (for built application)
  if [ -d "$APP_DIR/dist" ]; then
    echo "✓ dist directory found (application is built)"
  else
    echo "✗ dist directory not found (application might not be built)"
  fi
else
  echo "! Application directory not found at: $APP_DIR"
fi

# Step 4: Check Nginx configuration
echo ""
echo "Checking Nginx configuration..."
if command -v nginx &> /dev/null; then
  echo "Nginx found on the system"
  
  # Check if Nginx is running
  if systemctl is-active --quiet nginx; then
    echo "✓ Nginx is running"
  else
    echo "✗ Nginx is NOT running"
  fi
  
  # Check for speedtest site configuration
  SITE_CONFIG=""
  if [ -f "/etc/nginx/sites-available/speedtest" ]; then
    SITE_CONFIG="/etc/nginx/sites-available/speedtest"
  elif [ -f "/etc/nginx/sites-available/default" ]; then
    SITE_CONFIG="/etc/nginx/sites-available/default"
  fi
  
  if [ -n "$SITE_CONFIG" ]; then
    echo "Found Nginx configuration: $SITE_CONFIG"
    
    # Check for proxy_pass directives
    PROXY_PASS=$(grep -n "proxy_pass" "$SITE_CONFIG")
    if [ -n "$PROXY_PASS" ]; then
      echo "Proxy pass directives:"
      echo "$PROXY_PASS"
    else
      echo "! No proxy_pass directives found in Nginx configuration"
    fi
    
    # Check if site is enabled
    if [ -f "/etc/nginx/sites-enabled/$(basename "$SITE_CONFIG")" ]; then
      echo "✓ Site is enabled in Nginx"
    else
      echo "✗ Site is NOT enabled in Nginx"
    fi
  else
    echo "! Could not find Nginx site configuration for SpeedTest"
  fi
else
  echo "! Nginx not found on the system"
fi

# Step 5: Check connectivity to the application
echo ""
echo "Checking connectivity to the application..."

# Try port 3000 first (the expected port)
if command -v curl &> /dev/null; then
  echo "Testing connection to http://localhost:3000..."
  CURL_OUTPUT=$(curl -s -I http://localhost:3000)
  CURL_STATUS=$?
  
  if [ $CURL_STATUS -eq 0 ]; then
    echo "✓ Successfully connected to port 3000"
    echo "Response headers:"
    echo "$CURL_OUTPUT"
  else
    echo "✗ Could not connect to port 3000"
    
    # Try port 5000 as a fallback (the port mentioned in error logs)
    echo "Testing connection to http://localhost:5000..."
    CURL_OUTPUT=$(curl -s -I http://localhost:5000)
    CURL_STATUS=$?
    
    if [ $CURL_STATUS -eq 0 ]; then
      echo "✓ Successfully connected to port 5000"
      echo "Response headers:"
      echo "$CURL_OUTPUT"
    else
      echo "✗ Could not connect to port 5000 either"
    fi
  fi
else
  echo "! curl not found, cannot test connectivity"
fi

# Step 6: Check database connectivity
echo ""
echo "Checking database connectivity..."
if [ -f "$APP_DIR/.env" ] && grep -q "^DATABASE_URL=" "$APP_DIR/.env"; then
  echo "Database URL is configured in .env file"
  
  # Create a temporary script to test database connection
  TMP_SCRIPT=$(mktemp)
  cat > "$TMP_SCRIPT" << 'EOF'
const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function testConnection() {
  try {
    const client = await pool.connect();
    console.log('✓ Database connection successful');
    
    const result = await client.query('SELECT current_timestamp');
    console.log(`Current database time: ${result.rows[0].current_timestamp}`);
    
    client.release();
  } catch (err) {
    console.error('✗ Database connection failed:', err.message);
  } finally {
    pool.end();
  }
}

testConnection();
EOF

  # Run the test script
  echo "Testing database connection..."
  if [ -f "$APP_DIR/node_modules/pg/package.json" ]; then
    cd "$APP_DIR" && node "$TMP_SCRIPT"
  else
    echo "! pg module not found, cannot test database connection"
  fi
  
  # Clean up
  rm "$TMP_SCRIPT"
else
  echo "! Database URL not configured in .env file"
fi

echo ""
echo "=== Status Check Complete ==="
echo ""
echo "Based on this information, you can:"
echo "1. If PM2 is not running the application: cd /opt/speedtest && pm2 start npm --name speedtest -- start"
echo "2. If Nginx is not configured correctly: Run the fix_nginx_and_restart_app.sh script"
echo "3. If database connection is failing: Check your DATABASE_URL setting in .env"
echo ""
echo "For more detailed application logs: pm2 logs speedtest"
echo "For Nginx error logs: tail -f /var/log/nginx/error.log"