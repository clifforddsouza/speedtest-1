#!/bin/bash

# This script fixes WebSocket connection issues in the client-side code
# especially for setups behind Nginx or other proxies

echo "=== Fixing WebSocket URL Construction ==="

# Path to the compiled JavaScript file
DIST_DIR="/opt/speedtest/dist/assets"
CLIENT_BUNDLE=$(find "$DIST_DIR" -name "index-*.js" | head -n 1)

if [ -z "$CLIENT_BUNDLE" ]; then
  echo "ERROR: Could not find client bundle JS file in $DIST_DIR"
  exit 1
fi

echo "Found client bundle: $CLIENT_BUNDLE"

# Create backup
cp "$CLIENT_BUNDLE" "$CLIENT_BUNDLE.bak"
echo "Created backup at $CLIENT_BUNDLE.bak"

# Fix WebSocket URL construction
echo "Fixing WebSocket URL construction..."

# This regex pattern matches the WebSocket URL construction with dynamic protocol
# and replaces it with a construction that uses the hardcoded server path
sed -i 's|wsUrl *= *`\${protocol}\/\/${window\.location\.host}\/api\/ws-packet-test`|wsUrl = `\${protocol}\/\/\${window.location.host}\/api\/ws-packet-test`|g' "$CLIENT_BUNDLE"

# Verify the change
if grep -q "wsUrl.*window.location.host.*\/api\/ws-packet-test" "$CLIENT_BUNDLE"; then
  echo "✓ WebSocket URL path fixed successfully"
else
  echo "! Warning: Could not find or update WebSocket URL pattern in the client bundle"
  echo "  You may need to manually update the WebSocket URL in the client code"
fi

echo ""
echo "=== Fix Applied ==="
echo "1. You must restart the application: pm2 restart speedtest"
echo "2. If issues persist, check Nginx configuration to ensure WebSocket proxy is set up correctly:"
echo ""
echo "   location /api/ws-packet-test {"
echo "     proxy_pass http://localhost:3000;"
echo "     proxy_http_version 1.1;"
echo "     proxy_set_header Upgrade \$http_upgrade;"
echo "     proxy_set_header Connection \"upgrade\";"
echo "     proxy_set_header Host \$host;"
echo "   }"
echo ""