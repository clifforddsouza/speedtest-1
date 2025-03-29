#!/bin/bash

# Simple script to fix Nginx configuration port mismatch

echo "=== Nginx Configuration Fix ==="

# Check if running as root
if [ "$EUID" -ne 0 ]; then
  echo "Please run as root (with sudo)"
  exit 1
fi

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
    exit 1
  fi
fi

echo "Found Nginx configuration at $NGINX_CONFIG"
echo "Creating backup of Nginx configuration..."
cp "$NGINX_CONFIG" "${NGINX_CONFIG}.bak"
echo "Backup created at ${NGINX_CONFIG}.bak"

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
  echo "Fix completed! Your application should now be accessible."
else
  echo "Nginx configuration test failed. Please check the error messages above."
  echo "Restoring original configuration..."
  cp "${NGINX_CONFIG}.bak" "$NGINX_CONFIG"
  echo "Original configuration restored."
fi