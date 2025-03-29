#!/bin/bash

# This script fixes port mismatch issues between the application and Nginx
# by checking which port the application is using and updating all components to match

echo "=== SpeedTest Port Mismatch Fix ==="

# Check if running as root
if [ "$EUID" -ne 0 ]; then
  echo "Error: This script must be run as root (with sudo)"
  exit 1
fi

# Create backup directory
BACKUP_DIR="/opt/speedtest/backups"
mkdir -p "$BACKUP_DIR"

# Step 1: Check the application's actual port
echo "Checking which port the application is actually running on..."
APP_PORT=""

# Method 1: Check PM2
if command -v pm2 &> /dev/null; then
  if pm2 list | grep -q speedtest; then
    PM2_PORT=$(pm2 describe speedtest | grep -oP "port.*?\K\d+" || echo "")
    if [ -n "$PM2_PORT" ]; then
      echo "PM2 reports application running on port: $PM2_PORT"
      APP_PORT=$PM2_PORT
    fi
  else
    echo "Speedtest application is not running in PM2"
  fi
fi

# Method 2: Use lsof or netstat to find Node.js processes
if [ -z "$APP_PORT" ]; then
  echo "Checking for Node.js processes listening on ports..."
  
  if command -v lsof &> /dev/null; then
    NODE_PORTS=$(lsof -i -P -n | grep node | grep LISTEN | awk '{print $9}' | cut -d: -f2 | sort -u)
  elif command -v netstat &> /dev/null; then
    NODE_PORTS=$(netstat -tlnp 2>/dev/null | grep node | awk '{print $4}' | cut -d: -f2 | sort -u)
  elif command -v ss &> /dev/null; then
    NODE_PORTS=$(ss -tlnp | grep node | awk '{print $4}' | cut -d: -f2 | sort -u)
  fi
  
  if [ -n "$NODE_PORTS" ]; then
    echo "Found Node.js processes running on these ports: $NODE_PORTS"
    # If there's just one port, use it
    if [ "$(echo "$NODE_PORTS" | wc -w)" -eq 1 ]; then
      APP_PORT=$NODE_PORTS
      echo "Using detected port: $APP_PORT"
    else
      echo "Multiple Node.js ports detected. Please choose from: $NODE_PORTS"
      read -p "Enter the correct port (or press Enter for default 3000): " USER_PORT
      if [ -n "$USER_PORT" ]; then
        APP_PORT=$USER_PORT
      else
        APP_PORT=3000
      fi
    fi
  fi
fi

# If we still don't have a port, ask the user
if [ -z "$APP_PORT" ]; then
  echo "Could not automatically detect the application port."
  read -p "Enter the correct port (or press Enter for default 3000): " USER_PORT
  if [ -n "$USER_PORT" ]; then
    APP_PORT=$USER_PORT
  else
    APP_PORT=3000
  fi
fi

echo "Using application port: $APP_PORT"

# Step 2: Check and update the Nginx configuration
echo "Checking Nginx configuration..."
NGINX_SITES="/etc/nginx/sites-available"
SITE_CONFIG=""
SITE_NAMES=("speedtest" "default")

for site in "${SITE_NAMES[@]}"; do
  if [ -f "$NGINX_SITES/$site" ]; then
    SITE_CONFIG="$NGINX_SITES/$site"
    echo "Found Nginx configuration: $SITE_CONFIG"
    break
  fi
done

if [ -z "$SITE_CONFIG" ]; then
  echo "Error: Could not find Nginx site configuration"
  echo "Please check your /etc/nginx/sites-available directory"
  exit 1
fi

# Create backup of original configuration
BACKUP_FILE="$BACKUP_DIR/nginx-$(basename $SITE_CONFIG)-$(date +%Y%m%d%H%M%S).bak"
cp "$SITE_CONFIG" "$BACKUP_FILE"
echo "Created backup at $BACKUP_FILE"

# Fix proxy_pass directives to use the correct port
echo "Updating proxy_pass directives in Nginx configuration to use port $APP_PORT..."
NGINX_CHANGED=0

# Check if there are any incorrect proxy_pass settings
if grep -q "proxy_pass http://localhost:[0-9]\+" "$SITE_CONFIG" || grep -q "proxy_pass http://127.0.0.1:[0-9]\+" "$SITE_CONFIG"; then
  # Update any proxy_pass to localhost with any port
  sed -i -E "s|(proxy_pass http://localhost:)[0-9]+|\1$APP_PORT|g" "$SITE_CONFIG"
  sed -i -E "s|(proxy_pass http://127.0.0.1:)[0-9]+|\1$APP_PORT|g" "$SITE_CONFIG"
  NGINX_CHANGED=1
fi

# Step 3: Check and update PM2 configuration if needed
echo "Checking if PM2 ecosystem file exists..."
PM2_ECO_FILE="/opt/speedtest/ecosystem.config.js"

if [ -f "$PM2_ECO_FILE" ]; then
  echo "Found PM2 ecosystem file: $PM2_ECO_FILE"
  # Create backup
  cp "$PM2_ECO_FILE" "$BACKUP_DIR/ecosystem.config.js.bak"
  
  # Update port in ecosystem file if it exists
  if grep -q "PORT" "$PM2_ECO_FILE"; then
    sed -i -E "s|PORT: ['\"]?[0-9]+['\"]?|PORT: '$APP_PORT'|g" "$PM2_ECO_FILE"
    echo "Updated PORT in PM2 ecosystem file to $APP_PORT"
  fi
fi

# Step 4: Check for .env file and update
ENV_FILE="/opt/speedtest/.env"
if [ -f "$ENV_FILE" ]; then
  echo "Found .env file: $ENV_FILE"
  # Create backup
  cp "$ENV_FILE" "$BACKUP_DIR/.env.bak"
  
  # Update PORT in .env file
  if grep -q "^PORT=" "$ENV_FILE"; then
    sed -i -E "s|^PORT=[0-9]+|PORT=$APP_PORT|g" "$ENV_FILE"
    echo "Updated PORT in .env file to $APP_PORT"
  else
    # Add PORT if it doesn't exist
    echo "PORT=$APP_PORT" >> "$ENV_FILE"
    echo "Added PORT=$APP_PORT to .env file"
  fi
fi

# Step 5: Reload services if changes were made
if [ $NGINX_CHANGED -eq 1 ]; then
  echo "Testing Nginx configuration..."
  nginx -t
  
  if [ $? -eq 0 ]; then
    echo "✓ Nginx configuration is valid"
    echo "Reloading Nginx..."
    systemctl reload nginx
  else
    echo "! Error in Nginx configuration. Please fix manually."
    echo "  Restore the backup with: cp $BACKUP_FILE $SITE_CONFIG"
  fi
fi

echo "Restarting the application to apply changes..."
if pm2 list | grep -q speedtest; then
  pm2 restart speedtest
  echo "✓ Application restarted"
else
  echo "! Application is not running in PM2"
  echo "  Start it with: cd /opt/speedtest && pm2 start npm --name speedtest -- start"
fi

echo ""
echo "=== Fix Complete ==="
echo "The application and Nginx should now be using the same port: $APP_PORT"
echo ""
echo "To verify, check:"
echo "1. Nginx error logs: tail -f /var/log/nginx/error.log"
echo "2. Application logs: pm2 logs speedtest"
echo ""
echo "Try accessing the application and logging in now."