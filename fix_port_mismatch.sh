#!/bin/bash

# This script fixes the port mismatch between Nginx and the application
echo "=== Fixing Port Mismatch ==="

# Check if running as root
if [ "$EUID" -ne 0 ]; then
  echo "Please run as root (sudo ./fix_port_mismatch.sh)"
  exit 1
fi

# Create backup directory
BACKUP_DIR="/opt/speedtest/backups/port_fix_$(date +%Y%m%d%H%M%S)"
mkdir -p "$BACKUP_DIR"
echo "Created backup directory: $BACKUP_DIR"

# Identify the active Nginx config file
NGINX_CONFIG="/etc/nginx/sites-enabled/speedtest"
if [ ! -f "$NGINX_CONFIG" ]; then
  NGINX_CONFIG="/etc/nginx/sites-enabled/default"
fi

# Backup the current config
if [ -f "$NGINX_CONFIG" ]; then
  cp "$NGINX_CONFIG" "$BACKUP_DIR/$(basename $NGINX_CONFIG).bak"
  echo "✓ Backed up current Nginx config"
else
  echo "! Could not find active Nginx configuration file"
  exit 1
fi

# Update the Nginx configuration to use port 5000
echo "Updating Nginx configuration to use port 5000..."
sed -i 's/proxy_pass http:\/\/localhost:3000;/proxy_pass http:\/\/localhost:5000;/g' "$NGINX_CONFIG"
echo "✓ Updated Nginx configuration to use port 5000"

# Test Nginx configuration
echo "Testing Nginx configuration..."
nginx -t
if [ $? -eq 0 ]; then
  systemctl reload nginx
  echo "✓ Nginx configuration reloaded"
else
  echo "! Nginx configuration test failed"
  echo "  Please check the error message above and fix the configuration"
  exit 1
fi

echo ""
echo "=== Port Mismatch Fix Complete ==="
echo ""
echo "The Nginx configuration has been updated to forward to port 5000,"
echo "which is the port your application is currently using."
echo ""
echo "To verify:"
echo "1. Open http://192.168.8.92 in your browser"
echo "2. Check Nginx logs: tail -f /var/log/nginx/speedtest.error.log"
echo "3. Check application logs: pm2 logs speedtest"