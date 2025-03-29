#!/bin/bash

# Simple script to update Nginx configuration to use port 5000
echo "=== Simple Port Fix ==="

# Check if running as root
if [ "$EUID" -ne 0 ]; then
  echo "Please run as root (sudo ./simple_fix.sh)"
  exit 1
fi

# Update the active Nginx config file
CONFIG="/etc/nginx/sites-enabled/speedtest"
if [ -f "$CONFIG" ]; then
  echo "Fixing Nginx configuration at $CONFIG..."
  sed -i 's/proxy_pass http:\/\/localhost:3000;/proxy_pass http:\/\/localhost:5000;/g' "$CONFIG"
  
  # Test and reload Nginx
  nginx -t
  if [ $? -eq 0 ]; then
    systemctl reload nginx
    echo "✓ Nginx configuration updated and reloaded"
  else
    echo "! Nginx configuration test failed"
  fi
else
  echo "! Config file not found at $CONFIG"
fi

echo "Done. Try accessing http://192.168.8.92 now."