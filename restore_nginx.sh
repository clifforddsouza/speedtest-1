#!/bin/bash

# This script restores a working Nginx configuration to serve the frontend properly
echo "=== Restoring Nginx Configuration ==="

# Check if running as root
if [ "$EUID" -ne 0 ]; then
  echo "Please run as root (sudo ./restore_nginx.sh)"
  exit 1
fi

# Create backup directory
BACKUP_DIR="/opt/speedtest/backups/nginx_restore_$(date +%Y%m%d%H%M%S)"
mkdir -p "$BACKUP_DIR"
echo "Created backup directory: $BACKUP_DIR"

# Identify the Nginx config file
NGINX_CONFIG="/etc/nginx/sites-available/speedtest"
if [ ! -f "$NGINX_CONFIG" ]; then
  NGINX_CONFIG="/etc/nginx/sites-available/default"
fi

# Backup the current config
if [ -f "$NGINX_CONFIG" ]; then
  cp "$NGINX_CONFIG" "$BACKUP_DIR/$(basename $NGINX_CONFIG).bak"
  echo "✓ Backed up current Nginx config"
else
  echo "! Could not find Nginx configuration file"
  
  # Try harder to find it
  POTENTIAL_CONFIGS=$(find /etc/nginx -name "*.conf" -o -name "default" | grep -v "mime.types")
  if [ -n "$POTENTIAL_CONFIGS" ]; then
    echo "Found potential Nginx configuration files:"
    echo "$POTENTIAL_CONFIGS"
    
    # Ask user to select which config to use
    echo "Enter the number of the configuration file to use:"
    select CONFIG in $POTENTIAL_CONFIGS; do
      if [ -n "$CONFIG" ]; then
        NGINX_CONFIG="$CONFIG"
        break
      else
        echo "Invalid selection. Please try again."
      fi
    done
  else
    echo "No Nginx configuration files found. Creating a new one."
    NGINX_CONFIG="/etc/nginx/sites-available/default"
  fi
fi

# Create a new clean configuration
cat > "$NGINX_CONFIG" << 'EOF'
server {
    listen 80;
    server_name 192.168.8.92;
    
    access_log /var/log/nginx/speedtest.access.log;
    error_log /var/log/nginx/speedtest.error.log;

    # Frontend static files
    location / {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 90;
    }

    # API endpoints
    location /api/ {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 90;
    }

    # WebSocket endpoint for packet loss testing
    location /api/ws-packet-test {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_read_timeout 86400;
    }
}
EOF

echo "✓ Created new Nginx configuration using port 5000"

# Enable the site if needed
if [ ! -f "/etc/nginx/sites-enabled/$(basename $NGINX_CONFIG)" ]; then
  ln -sf "$NGINX_CONFIG" "/etc/nginx/sites-enabled/$(basename $NGINX_CONFIG)"
  echo "✓ Enabled Nginx site"
fi

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

# Print current running configuration
echo ""
echo "=== Current Nginx Configuration ==="
echo "Nginx configuration file: $NGINX_CONFIG"
echo "Nginx is now forwarding requests to port 5000"
echo ""
echo "To verify:"
echo "1. Open http://192.168.8.92 in your browser"
echo "2. Check Nginx logs: tail -f /var/log/nginx/speedtest.error.log"
echo "3. Check application logs: pm2 logs speedtest"