#!/bin/bash

# This script finds and fixes all instances of port 5000 in Nginx configurations
# It's a targeted fix for the specific issue of Nginx trying to connect to port 5000 instead of 3000

echo "=== Nginx Port Configuration Fix ==="

# Check if script is run as root
if [ "$EUID" -ne 0 ]; then
  echo "Error: This script must be run as root (with sudo)"
  exit 1
fi

# Backup directory
BACKUP_DIR="/opt/speedtest/backups/nginx_$(date +%Y%m%d%H%M%S)"
mkdir -p "$BACKUP_DIR"
echo "Created backup directory: $BACKUP_DIR"

# Search all Nginx config files for port 5000
echo "Searching for port 5000 in all Nginx configuration files..."
NGINX_CONF_DIRS=("/etc/nginx/conf.d" "/etc/nginx/sites-available" "/etc/nginx/sites-enabled" "/etc/nginx")
FILES_WITH_PORT_5000=()

for dir in "${NGINX_CONF_DIRS[@]}"; do
  if [ -d "$dir" ]; then
    echo "Searching in $dir..."
    FOUND_FILES=$(grep -l "proxy_pass.*:5000" "$dir"/* 2>/dev/null)
    if [ -n "$FOUND_FILES" ]; then
      while IFS= read -r file; do
        FILES_WITH_PORT_5000+=("$file")
        echo "✓ Found port 5000 in: $file"
      done <<< "$FOUND_FILES"
    fi
  fi
done

if [ ${#FILES_WITH_PORT_5000[@]} -eq 0 ]; then
  echo "Could not find explicit port 5000 in Nginx configurations."
  echo "Searching for inline proxy_pass directives..."
  
  # Check for other proxy_pass formats that might not have the port explicitly
  for dir in "${NGINX_CONF_DIRS[@]}"; do
    if [ -d "$dir" ]; then
      FOUND_FILES=$(grep -l "proxy_pass" "$dir"/* 2>/dev/null)
      if [ -n "$FOUND_FILES" ]; then
        while IFS= read -r file; do
          if grep -q "proxy_pass" "$file" && ! grep -q "proxy_pass.*:3000" "$file"; then
            FILES_WITH_PORT_5000+=("$file")
            echo "? Found potential proxy_pass without explicit port 3000 in: $file"
          fi
        done <<< "$FOUND_FILES"
      fi
    fi
  done
fi

if [ ${#FILES_WITH_PORT_5000[@]} -eq 0 ]; then
  echo "No files found with port 5000 or ambiguous proxy_pass directives."
  echo "This suggests the port might be set in a different configuration."
  
  # Offer the option to create a direct fix
  echo ""
  echo "Would you like to create a direct fix by setting explicit location blocks for API endpoints?"
  read -p "Enter 'yes' to proceed: " CREATE_DIRECT_FIX
  
  if [ "$CREATE_DIRECT_FIX" = "yes" ]; then
    echo "Creating explicit location blocks for API endpoints..."
    
    # Find the main Nginx configuration file
    MAIN_CONFIG="/etc/nginx/sites-available/default"
    if [ ! -f "$MAIN_CONFIG" ]; then
      MAIN_CONFIG=$(find /etc/nginx/sites-available -type f | head -1)
    fi
    
    if [ -f "$MAIN_CONFIG" ]; then
      echo "Using main configuration file: $MAIN_CONFIG"
      
      # Create backup
      cp "$MAIN_CONFIG" "$BACKUP_DIR/$(basename "$MAIN_CONFIG").bak"
      
      # Check if the file already has a custom API location block
      if grep -q "location /api/" "$MAIN_CONFIG"; then
        echo "API location block already exists, updating it..."
        sed -i 's|proxy_pass http://127.0.0.1:5000|proxy_pass http://127.0.0.1:3000|g' "$MAIN_CONFIG"
        sed -i 's|proxy_pass http://localhost:5000|proxy_pass http://localhost:3000|g' "$MAIN_CONFIG"
      else
        echo "Adding API location block..."
        
        # Find the end of the server block
        SERVER_END=$(grep -n "}" "$MAIN_CONFIG" | tail -1 | cut -d: -f1)
        
        # Create temporary file with API location block
        TMP_FILE=$(mktemp)
        
        cat > "$TMP_FILE" << 'EOF'

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
EOF

        # Insert the API configuration before the server block closing brace
        head -n $((SERVER_END - 1)) "$MAIN_CONFIG" > "$MAIN_CONFIG.new"
        cat "$TMP_FILE" >> "$MAIN_CONFIG.new"
        tail -n $(($(wc -l < "$MAIN_CONFIG") - SERVER_END + 1)) "$MAIN_CONFIG" >> "$MAIN_CONFIG.new"
        
        # Replace the old configuration with the new one
        mv "$MAIN_CONFIG.new" "$MAIN_CONFIG"
        rm "$TMP_FILE"
      fi
      
      echo "✓ Updated configuration with explicit API endpoint settings"
    else
      echo "! Could not find a suitable Nginx configuration file"
    fi
  fi
else
  echo ""
  echo "Found ${#FILES_WITH_PORT_5000[@]} files with port 5000 or ambiguous proxy_pass directives"
  echo "Backing up and fixing these files..."
  
  for file in "${FILES_WITH_PORT_5000[@]}"; do
    # Create backup
    cp "$file" "$BACKUP_DIR/$(basename "$file").bak"
    
    # Replace port 5000 with 3000 in proxy_pass directives
    sed -i 's|proxy_pass http://127.0.0.1:5000|proxy_pass http://127.0.0.1:3000|g' "$file"
    sed -i 's|proxy_pass http://localhost:5000|proxy_pass http://localhost:3000|g' "$file"
    
    echo "✓ Updated $file to use port 3000"
  done
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
  echo "  Restore the backup from: $BACKUP_DIR"
fi

# Restart the application
echo "Restarting the application..."
if pm2 list | grep -q speedtest; then
  pm2 restart speedtest
  echo "✓ Application restarted"
else
  echo "! Application is not running in PM2"
  echo "  Start it with: cd /opt/speedtest && pm2 start npm --name speedtest -- start"
fi

echo ""
echo "=== Fix Applied ==="
echo "Nginx should now correctly route API requests to port 3000"
echo ""
echo "To verify the fix is working:"
echo "1. Try to log in through the application"
echo "2. Check Nginx error logs: tail -f /var/log/nginx/error.log"
echo "3. If you see any remaining issues with port 5000, run this tool again with the 'yes' option"