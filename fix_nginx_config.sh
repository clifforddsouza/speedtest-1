#!/bin/bash

# This script fixes Nginx configuration for the SpeedTest application
# It ensures proper proxy settings for both API and WebSocket endpoints
# and fixes port forwarding issues

echo "=== SpeedTest Nginx Configuration Fix ==="

# Check if script is run as root
if [ "$EUID" -ne 0 ]; then
  echo "Error: This script must be run as root (with sudo)"
  exit 1
fi

# Backup directory
BACKUP_DIR="/opt/speedtest/backups"
mkdir -p "$BACKUP_DIR"

# Find the Nginx configuration file for the site
NGINX_SITES="/etc/nginx/sites-available"
NGINX_ENABLED="/etc/nginx/sites-enabled"

# Look for speedtest-specific configuration first
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

# Find the actual port used by the application
echo "Checking the application port..."
APP_PORT=$(pm2 describe speedtest | grep -oP "port.*?\K\d+" || echo "3000")
echo "Detected application running on port: $APP_PORT"

# Fix any existing proxy_pass settings with incorrect port
echo "Fixing any incorrect proxy_pass settings..."

# Create a sed script to replace incorrect port in proxy_pass directives
sed -i "s|proxy_pass http://localhost:5000|proxy_pass http://localhost:$APP_PORT|g" "$SITE_CONFIG"
sed -i "s|proxy_pass http://127.0.0.1:5000|proxy_pass http://127.0.0.1:$APP_PORT|g" "$SITE_CONFIG"

# Check if the configuration has proxy settings for /api/
if grep -q "location /api/" "$SITE_CONFIG"; then
  echo "API proxy settings exist, updating port to $APP_PORT"
  # The sed commands above should have fixed this already
else
  echo "Adding API proxy settings to $SITE_CONFIG"
  
  # Find server block closing brace
  SERVER_END=$(grep -n "}" "$SITE_CONFIG" | tail -1 | cut -d: -f1)
  
  # Create temporary file with API location block
  TMP_FILE=$(mktemp)
  
  cat > "$TMP_FILE" << EOF

    # API endpoints
    location /api/ {
        proxy_pass http://localhost:$APP_PORT;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_read_timeout 90;
    }
EOF

  # Insert the API configuration before the server block closing brace
  head -n $((SERVER_END - 1)) "$SITE_CONFIG" > "$SITE_CONFIG.new"
  cat "$TMP_FILE" >> "$SITE_CONFIG.new"
  tail -n $(($(wc -l < "$SITE_CONFIG") - SERVER_END + 1)) "$SITE_CONFIG" >> "$SITE_CONFIG.new"
  
  # Replace the old configuration with the new one
  mv "$SITE_CONFIG.new" "$SITE_CONFIG"
  rm "$TMP_FILE"
  
  echo "✓ Added API proxy settings"
fi

# Check if the configuration already has WebSocket support
if grep -q "location /api/ws-packet-test" "$SITE_CONFIG"; then
  echo "WebSocket endpoint configuration exists, updating port to $APP_PORT"
  # The sed commands above should have fixed this already
else
  echo "Adding WebSocket endpoint configuration to $SITE_CONFIG"
  
  # Find server block closing brace
  SERVER_END=$(grep -n "}" "$SITE_CONFIG" | tail -1 | cut -d: -f1)
  
  # Create temporary file with WebSocket location block
  TMP_FILE=$(mktemp)
  
  cat > "$TMP_FILE" << EOF

    # WebSocket endpoint for packet loss testing
    location /api/ws-packet-test {
        proxy_pass http://localhost:$APP_PORT;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_read_timeout 86400;
    }
EOF

  # Insert the WebSocket configuration before the server block closing brace
  head -n $((SERVER_END - 1)) "$SITE_CONFIG" > "$SITE_CONFIG.new"
  cat "$TMP_FILE" >> "$SITE_CONFIG.new"
  tail -n $(($(wc -l < "$SITE_CONFIG") - SERVER_END + 1)) "$SITE_CONFIG" >> "$SITE_CONFIG.new"
  
  # Replace the old configuration with the new one
  mv "$SITE_CONFIG.new" "$SITE_CONFIG"
  rm "$TMP_FILE"
  
  echo "✓ Added WebSocket endpoint configuration"
fi

# Test Nginx configuration
echo "Testing Nginx configuration..."
nginx -t

if [ $? -eq 0 ]; then
  echo "✓ Nginx configuration is valid"
  
  # Reload Nginx to apply changes
  echo "Reloading Nginx..."
  systemctl reload nginx
  
  if [ $? -eq 0 ]; then
    echo "✓ Nginx reloaded successfully"
  else
    echo "! Error reloading Nginx. Please check the logs with: journalctl -u nginx"
  fi
else
  echo "! Error in Nginx configuration. Please fix manually."
  echo "  Restore the backup with: cp $BACKUP_FILE $SITE_CONFIG"
fi

echo ""
echo "=== Checking Application Status ==="
if pm2 list | grep -q speedtest; then
  echo "✓ Speedtest application is running"
  pm2 restart speedtest
  echo "✓ Restarted application to apply changes"
else
  echo "! Speedtest application is not running in PM2"
  echo "  Start it with: cd /opt/speedtest && pm2 start npm --name speedtest -- start"
fi

echo ""
echo "=== Fix Complete ==="
echo "1. Try logging in through the application now"
echo "2. If issues persist, check these logs:"
echo "   - Application logs: pm2 logs speedtest"
echo "   - Nginx error logs: tail -f /var/log/nginx/error.log"
echo "   - Nginx access logs: tail -f /var/log/nginx/access.log"
echo ""