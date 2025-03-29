#!/bin/bash

# Ultra simple script to fix Nginx configuration

echo "=== Simple Port Fix ==="

# Create backup
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
cp "$NGINX_CONFIG" "${NGINX_CONFIG}.bak"
echo "Backup created at ${NGINX_CONFIG}.bak"

# Simply change port to 5000 - our app is most likely running on 5000
echo "Updating Nginx to use port 5000..."
sed -i 's|proxy_pass http://localhost:[0-9]*;|proxy_pass http://localhost:5000;|g' "$NGINX_CONFIG"
sed -i 's|proxy_pass http://127.0.0.1:[0-9]*;|proxy_pass http://127.0.0.1:5000;|g' "$NGINX_CONFIG"

# Add WebSocket support
echo "Adding WebSocket support..."
sed -i '/proxy_pass/a \ \ \ \ \ \ \ \ proxy_http_version 1.1;\n        proxy_set_header Upgrade $http_upgrade;\n        proxy_set_header Connection "upgrade";\n        proxy_set_header Host $host;\n        proxy_cache_bypass $http_upgrade;' "$NGINX_CONFIG"

# Test and restart Nginx
echo "Testing Nginx configuration..."
nginx -t

if [ $? -eq 0 ]; then
  echo "Nginx configuration test passed. Restarting Nginx..."
  systemctl restart nginx
  echo "Nginx restarted successfully."
else
  echo "Nginx configuration test failed. Reverting changes..."
  cp "${NGINX_CONFIG}.bak" "$NGINX_CONFIG"
  echo "Changes reverted."
fi

echo "Fix complete! Try accessing your application now."