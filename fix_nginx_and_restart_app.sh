#!/bin/bash

# This script restores a working Nginx configuration and restarts the application
# It's designed to recover from a situation where the login page is gone (502 Bad Gateway)

echo "=== SpeedTest Application Recovery ==="

# Check if running as root
if [ "$EUID" -ne 0 ]; then
  echo "Error: This script must be run as root (with sudo)"
  exit 1
fi

# Create backup directory
BACKUP_DIR="/opt/speedtest/backups/recovery_$(date +%Y%m%d%H%M%S)"
mkdir -p "$BACKUP_DIR"
echo "Created backup directory: $BACKUP_DIR"

# Step 1: Check if the application is running
echo "Checking if the application is running..."
APP_RUNNING=0

if command -v pm2 &> /dev/null; then
  if pm2 list | grep -q speedtest; then
    APP_RUNNING=1
    echo "✓ Application is running in PM2"
  else
    echo "✗ Application is not running in PM2"
  fi
else
  echo "! PM2 not found, cannot check application status"
fi

# Step 2: Restore a clean Nginx configuration
echo "Creating a clean Nginx configuration..."

# Backup current config if it exists
NGINX_CONFIG="/etc/nginx/sites-available/speedtest"
if [ ! -f "$NGINX_CONFIG" ]; then
  NGINX_CONFIG="/etc/nginx/sites-available/default"
fi

if [ -f "$NGINX_CONFIG" ]; then
  cp "$NGINX_CONFIG" "$BACKUP_DIR/$(basename $NGINX_CONFIG).bak"
  echo "✓ Backed up current Nginx configuration"
else
  echo "! Could not find Nginx configuration"
  NGINX_CONFIG="/etc/nginx/sites-available/default"
  echo "Using default location: $NGINX_CONFIG"
fi

# Create a new clean configuration
cat > "$NGINX_CONFIG" << 'EOF'
server {
    listen 80;
    listen [::]:80;
    
    server_name 192.168.8.92;
    
    access_log /var/log/nginx/speedtest.access.log;
    error_log /var/log/nginx/speedtest.error.log;

    # Frontend static files
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 90;
    }

    # API endpoints
    location /api/ {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 90;
    }

    # WebSocket endpoint for packet loss testing
    location /api/ws-packet-test {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_read_timeout 86400;
    }
}
EOF

echo "✓ Created clean Nginx configuration"

# Make sure the symlink exists in sites-enabled
if [ -f "/etc/nginx/sites-enabled/$(basename $NGINX_CONFIG)" ]; then
  echo "✓ Symlink already exists in sites-enabled"
else
  ln -s "$NGINX_CONFIG" "/etc/nginx/sites-enabled/"
  echo "✓ Created symlink in sites-enabled"
fi

# Step 3: Make sure the application is configured correctly
echo "Checking application configuration..."

# Find app directory
APP_DIR="/opt/speedtest"
if [ ! -d "$APP_DIR" ]; then
  echo "! Application directory not found at $APP_DIR"
  echo "  Please specify the correct application directory:"
  read -p "> " USER_APP_DIR
  if [ -d "$USER_APP_DIR" ]; then
    APP_DIR="$USER_APP_DIR"
  else
    echo "! Invalid directory. Using default: $APP_DIR"
  fi
fi

# Check for .env file and ensure PORT is set to 3000
ENV_FILE="$APP_DIR/.env"
if [ -f "$ENV_FILE" ]; then
  cp "$ENV_FILE" "$BACKUP_DIR/.env.bak"
  echo "✓ Backed up .env file"
  
  # Update or add PORT=3000
  if grep -q "^PORT=" "$ENV_FILE"; then
    sed -i 's/^PORT=.*/PORT=3000/' "$ENV_FILE"
  else
    echo "PORT=3000" >> "$ENV_FILE"
  fi
  echo "✓ Updated PORT=3000 in .env file"
else
  echo "! .env file not found, creating a minimal one"
  echo "PORT=3000" > "$ENV_FILE"
  echo "DATABASE_URL=$DATABASE_URL" >> "$ENV_FILE"
  echo "✓ Created new .env file with PORT=3000"
fi

# Step 4: Restart the application
echo "Restarting the application..."

if [ $APP_RUNNING -eq 1 ]; then
  # Application is running in PM2, just restart it
  pm2 restart speedtest
  echo "✓ Restarted application in PM2"
else
  # Try to start the application
  if [ -f "$APP_DIR/package.json" ]; then
    cd "$APP_DIR"
    if grep -q "\"start\":" package.json; then
      echo "Starting application with PM2..."
      pm2 start npm --name speedtest -- start
      echo "✓ Started application with PM2"
    else
      echo "! No start script found in package.json"
      echo "  Please start the application manually"
    fi
  else
    echo "! Could not find package.json in $APP_DIR"
    echo "  Please start the application manually"
  fi
fi

# Step 5: Test and reload Nginx
echo "Testing Nginx configuration..."
nginx -t

if [ $? -eq 0 ]; then
  echo "✓ Nginx configuration is valid"
  echo "Reloading Nginx..."
  systemctl reload nginx
  
  if [ $? -eq 0 ]; then
    echo "✓ Nginx reloaded successfully"
  else
    echo "! Error reloading Nginx. Please check the logs with: journalctl -u nginx"
  fi
else
  echo "! Error in Nginx configuration. Please fix manually."
  echo "  Restore the backup from: $BACKUP_DIR/$(basename $NGINX_CONFIG).bak"
fi

echo ""
echo "=== Recovery Complete ==="
echo "The login page should now be accessible at http://192.168.8.92"
echo ""
echo "If you still see issues:"
echo "1. Check the Nginx error logs: tail -f /var/log/nginx/speedtest.error.log"
echo "2. Check the application logs: pm2 logs speedtest"
echo "3. Verify the application is actually running on port 3000: ss -tlnp | grep :3000"
echo ""
echo "If all else fails, you can restore from the backup with:"
echo "cp $BACKUP_DIR/$(basename $NGINX_CONFIG).bak $NGINX_CONFIG"
echo "and then reload Nginx: systemctl reload nginx"