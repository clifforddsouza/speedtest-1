#!/bin/bash

# This script inspects the default Nginx configuration to find any automatic port handling
# It's useful for debugging why Nginx might be using port 5000 despite configuration showing port 3000

echo "=== Checking Nginx Default Configuration ==="

# First, check if there are any default upstream configurations
echo "Checking for upstream configurations..."
if grep -r "upstream" /etc/nginx/ | grep -v "#"; then
  echo "Found upstream configurations (these could override direct proxy_pass settings)"
else
  echo "No upstream configurations found"
fi

# Check for any map directives that might be setting ports
echo ""
echo "Checking for map directives..."
if grep -r "map" /etc/nginx/ | grep -v "#" | grep -v "map \$http_upgrade"; then
  echo "Found map directives (these could be setting ports dynamically)"
else
  echo "No relevant map directives found"
fi

# Check for any include directives that might be bringing in other configs
echo ""
echo "Checking for include directives..."
INCLUDE_FILES=$(grep -r "include" /etc/nginx/ | grep -v "#" | grep -v "include mime.types" | grep -v "include fastcgi")
if [ -n "$INCLUDE_FILES" ]; then
  echo "Found include directives:"
  echo "$INCLUDE_FILES"
  echo ""
  echo "Checking included files for proxy_pass directives..."
  INCLUDED_PATHS=$(echo "$INCLUDE_FILES" | grep -o "include [^;]*" | cut -d' ' -f2-)
  for path in $INCLUDED_PATHS; do
    # Expand wildcards if present
    if [[ $path == *"*"* ]]; then
      expanded_path=$(eval echo $path)
      for file in $expanded_path; do
        if [ -f "$file" ]; then
          if grep -q "proxy_pass" "$file"; then
            echo "Found proxy_pass in included file: $file"
            grep "proxy_pass" "$file"
          fi
        fi
      done
    else
      if [ -f "$path" ]; then
        if grep -q "proxy_pass" "$path"; then
          echo "Found proxy_pass in included file: $path"
          grep "proxy_pass" "$path"
        fi
      fi
    fi
  done
else
  echo "No include directives found that might be bringing in other configurations"
fi

# Check for any environment variables that might be setting the port
echo ""
echo "Checking for environment variables used in Nginx configuration..."
if grep -r "\$" /etc/nginx/ | grep -v "#" | grep -v "\$host" | grep -v "\$request_uri" | grep -v "\$remote_addr" | grep -v "\$proxy_add_x_forwarded_for" | grep -v "\$scheme" | grep -v "\$http_upgrade" | grep -v "\$server_name" | grep -v "\$uri"; then
  echo "Found environment variables that might be used for dynamic configuration"
else
  echo "No custom environment variables found in Nginx configuration"
fi

# Check if there's a default_server directive
echo ""
echo "Checking for default_server directives..."
if grep -r "default_server" /etc/nginx/; then
  echo "Found default_server directives (these handle requests when no specific server matches)"
else
  echo "No default_server directives found"
fi

# Check for any suspicious location blocks
echo ""
echo "Checking for location blocks related to API endpoints..."
grep -r "location /api" /etc/nginx/
grep -r "location /" /etc/nginx/ | grep -v "location /api"

# Check for any port 5000 references in Nginx configuration
echo ""
echo "Checking for any references to port 5000..."
if grep -r ":5000" /etc/nginx/; then
  echo "Found direct references to port 5000"
else
  echo "No direct references to port 5000 found in configuration files"
fi

# Looking for any server directives that might be causing the issue
echo ""
echo "Checking all server blocks..."
SERVERS=$(grep -r "server {" /etc/nginx/ --include="*.conf")
echo "$SERVERS"

# Output the full Nginx configuration
echo ""
echo "=== Full Nginx Configuration ==="
echo "To see the full effective Nginx configuration, run:"
echo "nginx -T"
echo ""
echo "This will show you exactly what Nginx is using, including all included files and expansions."