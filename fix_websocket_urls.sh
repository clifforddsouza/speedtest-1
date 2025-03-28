#!/bin/bash

# This script fixes WebSocket connection issues in the client-side code
# especially for setups behind Nginx or other proxies

echo "=== Fixing WebSocket URL Construction ==="

# Find all JavaScript files in the dist directory
echo "Searching for JavaScript files in your application..."
DIST_BASE="/opt/speedtest/dist"
SEARCH_DIRS=("$DIST_BASE" "$DIST_BASE/client" "$DIST_BASE/assets" "$DIST_BASE/public")
JS_FILES=()

for dir in "${SEARCH_DIRS[@]}"; do
  if [ -d "$dir" ]; then
    echo "Searching in $dir..."
    FOUND_FILES=$(find "$dir" -type f -name "*.js" 2>/dev/null)
    if [ -n "$FOUND_FILES" ]; then
      while IFS= read -r file; do
        JS_FILES+=("$file")
      done <<< "$FOUND_FILES"
    fi
  fi
done

# Also search any directories that contain index-*.js files
INDEX_DIRS=$(find /opt/speedtest -type f -name "index-*.js" -exec dirname {} \; 2>/dev/null | sort -u)
if [ -n "$INDEX_DIRS" ]; then
  while IFS= read -r dir; do
    echo "Found potential JS bundle directory: $dir"
    FOUND_FILES=$(find "$dir" -type f -name "*.js" 2>/dev/null)
    if [ -n "$FOUND_FILES" ]; then
      while IFS= read -r file; do
        JS_FILES+=("$file")
      done <<< "$FOUND_FILES"
    fi
  done <<< "$INDEX_DIRS"
fi

if [ ${#JS_FILES[@]} -eq 0 ]; then
  echo "Error: No JavaScript files found. Your application may have a different structure."
  echo "Please manually search for your JavaScript files with:"
  echo "  find /opt/speedtest -type f -name \"*.js\" | grep -v node_modules"
  exit 1
fi

echo "Found ${#JS_FILES[@]} JavaScript files to check"

# Function to patch WebSocket URL if found
patch_websocket_url() {
  local file="$1"
  local backup="${file}.bak"
  
  echo "Checking $file for WebSocket URLs..."
  
  # Check if file contains WebSocket constructor
  if grep -q "new WebSocket" "$file"; then
    echo "✓ Found WebSocket usage in $file"
    
    # Create backup
    cp "$file" "$backup"
    echo "  Created backup at $backup"
    
    # First attempt: Try to fix complete WebSocket URL pattern
    sed -i 's|wsUrl = `${protocol}//${window\.location\.host}/api/ws-packet-test`|wsUrl = `${protocol}//${window.location.host}/api/ws-packet-test`|g' "$file"
    sed -i 's|wsUrl=`${protocol}//${window\.location\.host}/api/ws-packet-test`|wsUrl=`${protocol}//${window.location.host}/api/ws-packet-test`|g' "$file"
    
    # Second attempt: Look for various ways the URL might be constructed
    sed -i 's|ws://" + location.host + "/api/ws-packet-test|ws://" + location.host + "/api/ws-packet-test|g' "$file"
    sed -i 's|wss://" + location.host + "/api/ws-packet-test|wss://" + location.host + "/api/ws-packet-test|g' "$file"
    
    # Third attempt: More general WebSocket URL patterns (if they exist)
    sed -i 's|new WebSocket("ws://localhost|new WebSocket("ws://" + window.location.host|g' "$file"
    sed -i 's|new WebSocket("wss://localhost|new WebSocket("wss://" + window.location.host|g' "$file"
    
    echo "  Updated WebSocket URL construction in $file"
    return 0
  fi
  
  return 1
}

# Try to patch all JavaScript files
PATCHED=0
for file in "${JS_FILES[@]}"; do
  if patch_websocket_url "$file"; then
    PATCHED=$((PATCHED + 1))
  fi
done

if [ $PATCHED -eq 0 ]; then
  echo "! Warning: Could not find WebSocket URLs in any JavaScript files"
  echo "  The WebSocket URL may be constructed differently or in a file not found by this script"
else
  echo "✓ Successfully patched $PATCHED JavaScript files"
fi

echo ""
echo "=== Nginx Configuration for WebSockets ==="
echo "Add the following to your Nginx server configuration:"
echo ""
echo "   location /api/ws-packet-test {"
echo "     proxy_pass http://localhost:3000;"
echo "     proxy_http_version 1.1;"
echo "     proxy_set_header Upgrade \$http_upgrade;"
echo "     proxy_set_header Connection \"upgrade\";"
echo "     proxy_set_header Host \$host;"
echo "   }"
echo ""
echo "=== Fix Applied ==="
echo "Restart your application with: pm2 restart speedtest"